import { n as dataDir } from "./paths.js";
import { D as settingsSchema, E as sequenceSchema, S as applicationSchema, b as loadApplications, k as userSchema, v as withLock, w as issueSchema, x as loadUsers, y as loadAllIssues } from "./store.js";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { unzipSync, zipSync } from "fflate";
//#region src/lib/server/data/archive.ts
/**
* Full IssueDesk data snapshot as a single zip: `config/` (users, applications,
* settings), `issues/` (per-module JSON + sequence counters) and `uploads/`
* (attachment binaries). Checkpoint content (tests/suites/runs/runners/reports)
* is deliberately NOT included — this is the issue-tracker's data, exportable
* for backups and re-loadable on another instance.
*
* Import REPLACES those three roots wholesale (validated first, previous state
* moved to `.backups/pre-import-<stamp>/`), then the in-memory stores reload.
*/
var EXPORT_FORMAT = "issuedesk-data-export";
/** The DATA_DIR roots this archive covers. Order matters for restore. */
var ROOTS = [
	"config",
	"issues",
	"uploads"
];
var manifestSchema = z.object({
	format: z.literal(EXPORT_FORMAT),
	version: z.number().int().min(1).max(1),
	exportedAt: z.string(),
	counts: z.object({
		users: z.number(),
		applications: z.number(),
		issues: z.number(),
		attachments: z.number(),
		uploadFiles: z.number()
	}).partial().optional()
});
/** Recursively collect files under `dir`, returned as zip-entry names (posix, relative to DATA_DIR). */
async function collectFiles(dir, rel, out) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const abs = path.join(dir, entry.name);
		const relName = rel ? `${rel}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			if (entry.name === "_pending") continue;
			await collectFiles(abs, relName, out);
		} else if (entry.isFile() && !entry.name.endsWith(".tmp")) out.push(relName);
	}
}
async function buildDataExport() {
	const base = dataDir();
	const names = [];
	for (const root of ROOTS) await collectFiles(path.join(base, root), root, names);
	const users = await loadUsers();
	const applications = await loadApplications();
	const issueFiles = await loadAllIssues();
	const issueCount = issueFiles.reduce((n, f) => n + f.issues.length, 0);
	const attachmentCount = issueFiles.reduce((n, f) => n + f.issues.reduce((m, i) => m + i.attachments.length, 0), 0);
	const manifest = {
		format: EXPORT_FORMAT,
		version: 1,
		exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
		counts: {
			users: users.length,
			applications: applications.length,
			issues: issueCount,
			attachments: attachmentCount,
			uploadFiles: names.filter((n) => n.startsWith("uploads/")).length
		}
	};
	const entries = { "manifest.json": [new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n"), { level: 6 }] };
	for (const name of names) entries[name] = [new Uint8Array(await readFile(path.join(base, ...name.split("/")))), { level: name.startsWith("uploads/") ? 0 : 6 }];
	return {
		zip: zipSync(entries),
		manifest
	};
}
/** Reject traversal/absolute/odd entry names; return posix segments or null if not importable. */
function safeSegments(name) {
	if (name.includes("\\") || name.startsWith("/")) return null;
	const segments = name.split("/");
	if (segments.some((s) => s === "" || s === "." || s === "..")) return null;
	return segments;
}
/** Which archive entries we accept, and how their JSON is validated. */
function classifyEntry(segments) {
	const [root, ...rest] = segments;
	if (root === "config" && rest.length === 1) {
		if (rest[0] === "users.json") return { validate: z.array(userSchema) };
		if (rest[0] === "applications.json") return { validate: z.array(applicationSchema) };
		if (rest[0] === "settings.json") return { validate: settingsSchema };
		return "ignore";
	}
	if (root === "issues" && rest.length === 2 && rest[1].endsWith(".json")) {
		if (rest[1] === "_sequence.json") return { validate: sequenceSchema };
		if (!rest[1].startsWith("_")) return { validate: z.array(issueSchema) };
		return "ignore";
	}
	if (root === "uploads" && rest.length >= 3 && !rest.includes("_pending")) return {};
	return "ignore";
}
var ImportValidationError = class extends Error {};
/**
* Validate and apply an exported archive. All-or-nothing: every entry is
* validated before anything on disk changes; the previous config/issues/uploads
* are moved (not copied) to `.backups/pre-import-<stamp>/` and restored if the
* extraction fails. Caller is responsible for reloading the in-memory stores.
*/
async function importDataArchive(zipBytes) {
	return withLock("data:import", async () => {
		let unzipped;
		try {
			unzipped = unzipSync(zipBytes);
		} catch {
			throw new ImportValidationError("Not a readable zip archive.");
		}
		const rawManifest = unzipped["manifest.json"];
		if (!rawManifest) throw new ImportValidationError("manifest.json missing — not an IssueDesk data export.");
		let manifest;
		try {
			manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode(rawManifest)));
		} catch {
			throw new ImportValidationError("manifest.json is not a supported IssueDesk export manifest.");
		}
		const files = [];
		const ignored = [];
		for (const [name, data] of Object.entries(unzipped)) {
			if (name === "manifest.json" || name.endsWith("/")) continue;
			const segments = safeSegments(name);
			if (!segments) throw new ImportValidationError(`Unsafe path in archive: "${name}"`);
			const kind = classifyEntry(segments);
			if (kind === "ignore") {
				ignored.push(name);
				continue;
			}
			if (kind.validate) {
				let parsed;
				try {
					parsed = JSON.parse(new TextDecoder().decode(data));
				} catch {
					throw new ImportValidationError(`${name} is not valid JSON.`);
				}
				const result = kind.validate.safeParse(parsed);
				if (!result.success) throw new ImportValidationError(`${name} failed validation: ${result.error.issues[0]?.message ?? "invalid shape"}`);
			}
			files.push({
				segments,
				data
			});
		}
		for (const required of ["config/users.json", "config/applications.json"]) if (!files.some((f) => f.segments.join("/") === required)) throw new ImportValidationError(`Archive is missing ${required}.`);
		const base = dataDir();
		const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
		const backupPath = path.join(base, ".backups", `pre-import-${stamp}`);
		await mkdir(backupPath, { recursive: true });
		const moved = [];
		for (const root of ROOTS) try {
			await rename(path.join(base, root), path.join(backupPath, root));
			moved.push(root);
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}
		try {
			for (const file of files) {
				const abs = path.join(base, ...file.segments);
				await mkdir(path.dirname(abs), { recursive: true });
				await writeFile(abs, file.data);
			}
		} catch (e) {
			for (const root of ROOTS) await rm(path.join(base, root), {
				recursive: true,
				force: true
			});
			for (const root of moved) await rename(path.join(backupPath, root), path.join(base, root));
			throw e;
		}
		return {
			importedAt: (/* @__PURE__ */ new Date()).toISOString(),
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
//#endregion
export { buildDataExport as n, importDataArchive as r, ImportValidationError as t };
