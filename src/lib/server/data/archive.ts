import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import {
	applicationSchema,
	categorySchema,
	issueSchema,
	sequenceSchema,
	settingsSchema,
	userSchema
} from '$lib/schemas';
import { dataDir } from '../fs/paths';
import { loadAllIssues, loadApplications, loadUsers } from '../fs/read';
import { withLock } from '../store/mutex';

/**
 * Full IssueDesk data snapshot as a single zip: `config/` (users, applications,
 * categories, settings), `issues/` (per-module JSON + sequence counters) and `uploads/`
 * (attachment binaries). Checkpoint content (tests/suites/runs/runners/reports)
 * is deliberately NOT included — this is the issue-tracker's data, exportable
 * for backups and re-loadable on another instance.
 *
 * Import REPLACES those three roots wholesale (validated first, previous state
 * moved to `.backups/pre-import-<stamp>/`), then the in-memory stores reload.
 */

export const EXPORT_FORMAT = 'issuedesk-data-export';
export const EXPORT_VERSION = 1;

/** The DATA_DIR roots this archive covers. Order matters for restore. */
const ROOTS = ['config', 'issues', 'uploads'] as const;

export interface ExportSkip {
	name: string; // zip-entry name that was excluded
	reason: string;
}

export interface ExportManifest {
	format: typeof EXPORT_FORMAT;
	version: number;
	exportedAt: string;
	counts: {
		users: number;
		applications: number;
		issues: number;
		attachments: number;
		uploadFiles: number;
	};
	/** Items excluded because they could not be read/parsed (never a silent drop). */
	skipped: ExportSkip[];
}

const manifestSchema = z.object({
	format: z.literal(EXPORT_FORMAT),
	version: z.number().int().min(1).max(EXPORT_VERSION),
	exportedAt: z.string(),
	counts: z
		.object({
			users: z.number(),
			applications: z.number(),
			issues: z.number(),
			attachments: z.number(),
			uploadFiles: z.number()
		})
		.partial()
		.optional(),
	skipped: z.array(z.object({ name: z.string(), reason: z.string() })).optional()
});

/** Recursively collect files under `dir`, returned as zip-entry names (posix, relative to DATA_DIR). */
async function collectFiles(dir: string, rel: string, out: string[]): Promise<void> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return; // root absent — nothing to collect
	}
	for (const entry of entries) {
		const abs = path.join(dir, entry.name);
		const relName = rel ? `${rel}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			// Draft attachments are transient and swept on boot — never exported.
			if (entry.name === '_pending') continue;
			await collectFiles(abs, relName, out);
		} else if (entry.isFile() && !entry.name.endsWith('.tmp')) {
			out.push(relName);
		}
	}
}

export async function buildDataExport(): Promise<{ zip: Uint8Array; manifest: ExportManifest }> {
	const base = dataDir();
	const names: string[] = [];
	for (const root of ROOTS) {
		await collectFiles(path.join(base, root), root, names);
	}

	const users = await loadUsers();
	const applications = await loadApplications();
	const issueFiles = await loadAllIssues();
	const issueCount = issueFiles.reduce((n, f) => n + f.issues.length, 0);
	const attachmentCount = issueFiles.reduce(
		(n, f) => n + f.issues.reduce((m, i) => m + i.attachments.length, 0),
		0
	);

	// Read every collected file into the archive. A file that has gone missing,
	// become unreadable, or is corrupt is logged and excluded — the export must
	// not fail silently or abort on one bad item (backup/restore requirement).
	const skipped: ExportSkip[] = [];
	const payloads: Array<{ name: string; data: Uint8Array }> = [];
	for (const name of names) {
		try {
			const data = new Uint8Array(await readFile(path.join(base, ...name.split('/'))));
			// A JSON entry that no longer parses would poison a later import — catch it now.
			if (name.endsWith('.json')) {
				try {
					JSON.parse(new TextDecoder().decode(data));
				} catch (e) {
					throw new Error(`invalid JSON — ${(e as Error).message}`);
				}
			}
			payloads.push({ name, data });
		} catch (e) {
			const reason = (e as NodeJS.ErrnoException).code
				? `${(e as NodeJS.ErrnoException).code}: ${(e as Error).message}`
				: (e as Error).message;
			skipped.push({ name, reason });
			console.warn(`[issuedesk] Excluding "${name}" from export — ${reason}`);
		}
	}

	const includedUploadFiles = payloads.filter((p) => p.name.startsWith('uploads/')).length;
	const manifest: ExportManifest = {
		format: EXPORT_FORMAT,
		version: EXPORT_VERSION,
		exportedAt: new Date().toISOString(),
		counts: {
			users: users.length,
			applications: applications.length,
			issues: issueCount,
			attachments: attachmentCount,
			uploadFiles: includedUploadFiles
		},
		skipped
	};

	const entries: Zippable = {
		'manifest.json': [
			new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n'),
			{ level: 6 }
		]
	};
	for (const { name, data } of payloads) {
		// Attachment binaries (png/jpg/pdf/zip/docx) are already compressed — store raw.
		entries[name] = [data, { level: name.startsWith('uploads/') ? 0 : 6 }];
	}
	return { zip: zipSync(entries), manifest };
}

export interface ImportSummary {
	importedAt: string;
	exportedAt: string;
	files: number;
	ignored: string[];
	backupPath: string;
	counts: ExportManifest['counts'];
}

/** Reject traversal/absolute/odd entry names; return posix segments or null if not importable. */
function safeSegments(name: string): string[] | null {
	if (name.includes('\\') || name.startsWith('/')) return null;
	const segments = name.split('/');
	if (segments.some((s) => s === '' || s === '.' || s === '..')) return null;
	return segments;
}

/** Which archive entries we accept, and how their JSON is validated. */
function classifyEntry(segments: string[]): { validate?: z.ZodType<unknown> } | 'ignore' {
	const [root, ...rest] = segments;
	if (root === 'config' && rest.length === 1) {
		if (rest[0] === 'users.json') return { validate: z.array(userSchema) };
		if (rest[0] === 'applications.json') return { validate: z.array(applicationSchema) };
		if (rest[0] === 'settings.json') return { validate: settingsSchema };
		if (rest[0] === 'categories.json') return { validate: z.array(categorySchema) };
		return 'ignore';
	}
	if (root === 'issues' && rest.length === 2 && rest[1].endsWith('.json')) {
		if (rest[1] === '_sequence.json') return { validate: sequenceSchema };
		if (!rest[1].startsWith('_')) return { validate: z.array(issueSchema) };
		return 'ignore';
	}
	// uploads/<app>/<issueId>/<file> — binary, no validation beyond the path shape.
	if (root === 'uploads' && rest.length >= 3 && !rest.includes('_pending')) return {};
	return 'ignore';
}

export class ImportValidationError extends Error {}

/**
 * Validate and apply an exported archive. All-or-nothing: every entry is
 * validated before anything on disk changes; the previous config/issues/uploads
 * are moved (not copied) to `.backups/pre-import-<stamp>/` and restored if the
 * extraction fails. Caller is responsible for reloading the in-memory stores.
 */
export async function importDataArchive(zipBytes: Uint8Array): Promise<ImportSummary> {
	return withLock('data:import', async () => {
		let unzipped: Record<string, Uint8Array>;
		try {
			unzipped = unzipSync(zipBytes);
		} catch {
			throw new ImportValidationError('Not a readable zip archive.');
		}

		const rawManifest = unzipped['manifest.json'];
		if (!rawManifest) {
			throw new ImportValidationError('manifest.json missing — not an IssueDesk data export.');
		}
		let manifest: z.infer<typeof manifestSchema>;
		try {
			manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode(rawManifest)));
		} catch {
			throw new ImportValidationError('manifest.json is not a supported IssueDesk export manifest.');
		}

		// Validate every entry up front — nothing is written until all pass.
		const files: { segments: string[]; data: Uint8Array }[] = [];
		const ignored: string[] = [];
		for (const [name, data] of Object.entries(unzipped)) {
			if (name === 'manifest.json' || name.endsWith('/')) continue;
			const segments = safeSegments(name);
			if (!segments) throw new ImportValidationError(`Unsafe path in archive: "${name}"`);
			const kind = classifyEntry(segments);
			if (kind === 'ignore') {
				ignored.push(name);
				continue;
			}
			if (kind.validate) {
				let parsed: unknown;
				try {
					parsed = JSON.parse(new TextDecoder().decode(data));
				} catch {
					throw new ImportValidationError(`${name} is not valid JSON.`);
				}
				const result = kind.validate.safeParse(parsed);
				if (!result.success) {
					throw new ImportValidationError(
						`${name} failed validation: ${result.error.issues[0]?.message ?? 'invalid shape'}`
					);
				}
			}
			files.push({ segments, data });
		}
		// Without these, the next boot would treat DATA_DIR as empty and reseed demo data.
		for (const required of ['config/users.json', 'config/applications.json']) {
			if (!files.some((f) => f.segments.join('/') === required)) {
				throw new ImportValidationError(`Archive is missing ${required}.`);
			}
		}

		// Move current state out of the way (rename = instant, same filesystem).
		const base = dataDir();
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupPath = path.join(base, '.backups', `pre-import-${stamp}`);
		await mkdir(backupPath, { recursive: true });
		const moved: string[] = [];
		for (const root of ROOTS) {
			try {
				await rename(path.join(base, root), path.join(backupPath, root));
				moved.push(root);
			} catch (e) {
				if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
			}
		}

		try {
			for (const file of files) {
				const abs = path.join(base, ...file.segments);
				await mkdir(path.dirname(abs), { recursive: true });
				await writeFile(abs, file.data);
			}
		} catch (e) {
			// Roll back: drop the partial extraction, restore the moved roots.
			for (const root of ROOTS) {
				await rm(path.join(base, root), { recursive: true, force: true });
			}
			for (const root of moved) {
				await rename(path.join(backupPath, root), path.join(base, root));
			}
			throw e;
		}

		return {
			importedAt: new Date().toISOString(),
			exportedAt: manifest.exportedAt,
			files: files.length,
			ignored,
			backupPath,
			counts: {
				users: manifest.counts?.users ?? 0,
				applications: manifest.counts?.applications ?? 0,
				issues: manifest.counts?.issues ?? 0,
				attachments: manifest.counts?.attachments ?? 0,
				uploadFiles: manifest.counts?.uploadFiles ?? 0
			}
		};
	});
}
