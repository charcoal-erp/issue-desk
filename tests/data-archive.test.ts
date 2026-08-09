import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { seedDataDir } from '$lib/server/store/seed';
import {
	ImportValidationError,
	buildDataExport,
	importDataArchive
} from '$lib/server/data/archive';
import type { Attachment, CreateIssueInput } from '$lib/types';

const dir = process.env.DATA_DIR!;

const base: CreateIssueInput = {
	type: 'bug',
	title: 'Exported issue',
	description: 'desc',
	appId: 'charcoal',
	moduleId: 'accounting',
	page: '/accounting/journal',
	form: 'Journal Entry',
	priority: 'high',
	status: 'open',
	assigneeId: undefined,
	tags: ['export-test'],
	attachments: [] as Attachment[]
};

const attachment: Attachment = {
	id: 'att-1',
	filename: 'shot.png',
	originalName: 'Screen Shot.png',
	mime: 'image/png',
	kind: 'image',
	size: 4,
	url: '/api/files/charcoal/CHR-1/shot.png',
	uploadedBy: 'kiran',
	uploadedAt: new Date().toISOString()
};

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function createIssueWithUpload() {
	const issue = await store.create({ ...base, attachments: [attachment] }, 'kiran');
	const uploadDir = path.join(dir, 'uploads', 'charcoal', issue.id);
	await mkdir(uploadDir, { recursive: true });
	await writeFile(path.join(uploadDir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
	return issue;
}

describe('buildDataExport', () => {
	it('zips manifest, config, issues, sequences and upload binaries', async () => {
		const issue = await createIssueWithUpload();
		const { zip, manifest } = await buildDataExport();
		const entries = unzipSync(zip);

		expect(manifest.counts.issues).toBe(1);
		expect(manifest.counts.attachments).toBe(1);
		expect(manifest.counts.uploadFiles).toBe(1);
		expect(manifest.counts.users).toBe(5);
		expect(manifest.counts.applications).toBe(5);

		const parsedManifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
		expect(parsedManifest.format).toBe('issuedesk-data-export');
		expect(Object.keys(entries)).toEqual(
			expect.arrayContaining([
				'config/users.json',
				'config/applications.json',
				'config/categories.json',
				'config/settings.json',
				'issues/charcoal/_sequence.json',
				'issues/charcoal/accounting.json',
				`uploads/charcoal/${issue.id}/shot.png`
			])
		);
		const issues = JSON.parse(new TextDecoder().decode(entries['issues/charcoal/accounting.json']));
		expect(issues[0].id).toBe(issue.id);
		expect(entries[`uploads/charcoal/${issue.id}/shot.png`]).toEqual(
			new Uint8Array([0x89, 0x50, 0x4e, 0x47])
		);
	});

	it('skips a corrupt collected file and continues, recording it in the manifest', async () => {
		const issue = await createIssueWithUpload();
		// A corrupt JSON sidecar that collectFiles picks up but that fails to parse
		// — it must be excluded (not silently poison a later import) while the rest
		// of the snapshot, including the real binary, still exports.
		const badName = `uploads/charcoal/${issue.id}/broken.json`;
		await writeFile(path.join(dir, ...badName.split('/')), '{ this is not: valid json,');

		const { zip, manifest } = await buildDataExport();
		const names = Object.keys(unzipSync(zip));

		expect(names).not.toContain(badName);
		expect(manifest.skipped.map((s) => s.name)).toContain(badName);
		expect(manifest.skipped[0].reason).toMatch(/invalid JSON/);
		// The real upload and issue data are unaffected.
		expect(names).toContain(`uploads/charcoal/${issue.id}/shot.png`);
		expect(names).toContain('issues/charcoal/accounting.json');
		expect(manifest.counts.issues).toBe(1);
	});

	it('excludes _pending drafts and .tmp intermediates', async () => {
		await createIssueWithUpload();
		await mkdir(path.join(dir, 'uploads', 'charcoal', '_pending', 'draft-1'), { recursive: true });
		await writeFile(path.join(dir, 'uploads', 'charcoal', '_pending', 'draft-1', 'x.png'), 'x');
		await writeFile(path.join(dir, 'issues', 'charcoal', 'accounting.json.tmp'), '[]');
		const { zip } = await buildDataExport();
		const names = Object.keys(unzipSync(zip));
		expect(names.some((n) => n.includes('_pending'))).toBe(false);
		expect(names.some((n) => n.endsWith('.tmp'))).toBe(false);
	});
});

describe('importDataArchive', () => {
	it('round-trips: import restores the exported state and backs up the current one', async () => {
		const kept = await createIssueWithUpload();
		const { zip } = await buildDataExport();

		// Diverge: a second issue that the snapshot predates.
		const later = await store.create({ ...base, title: 'Created after export' }, 'kiran');

		const summary = await importDataArchive(zip);
		await store.reload();

		expect(store.get(kept.id)?.title).toBe('Exported issue');
		expect(store.get(later.id)).toBeUndefined();
		expect(summary.files).toBeGreaterThanOrEqual(6);
		expect(summary.ignored).toEqual([]);

		const restored = await readFile(path.join(dir, 'uploads', 'charcoal', kept.id, 'shot.png'));
		expect(new Uint8Array(restored)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

		// Pre-import backup holds the diverged state.
		const backups = await readdir(path.join(dir, '.backups'));
		const preImport = backups.find((b) => b.startsWith('pre-import-'));
		expect(preImport).toBeTruthy();
		const backedUp = JSON.parse(
			await readFile(
				path.join(dir, '.backups', preImport!, 'issues', 'charcoal', 'accounting.json'),
				'utf8'
			)
		);
		expect(backedUp.map((i: { id: string }) => i.id)).toContain(later.id);
	});

	it('restores sequence counters so new ids continue from the snapshot', async () => {
		await createIssueWithUpload(); // CHR-1
		const { zip } = await buildDataExport();
		await store.create({ ...base, title: 'two' }, 'kiran'); // CHR-2
		await importDataArchive(zip);
		await store.reload();
		const next = await store.create({ ...base, title: 'after import' }, 'kiran');
		expect(next.id).toBe('CHR-2');
	});

	it('rejects a zip without a manifest', async () => {
		const zip = zipSync({ 'config/users.json': strToU8('[]') });
		await expect(importDataArchive(zip)).rejects.toBeInstanceOf(ImportValidationError);
	});

	it('rejects non-zip bytes', async () => {
		await expect(importDataArchive(strToU8('not a zip'))).rejects.toBeInstanceOf(
			ImportValidationError
		);
	});

	it('rejects traversal paths without touching disk', async () => {
		const { zip } = await buildDataExport();
		const entries = unzipSync(zip);
		const evil = zipSync({
			'manifest.json': entries['manifest.json'],
			'config/users.json': entries['config/users.json'],
			'config/applications.json': entries['config/applications.json'],
			'uploads/app/issue/../../../escape.txt': strToU8('evil')
		});
		await expect(importDataArchive(evil)).rejects.toThrow(/Unsafe path/);
		expect(store.get('CHR-1')).toBeUndefined(); // nothing replaced
	});

	it('rejects invalid issue JSON before replacing anything', async () => {
		const current = await createIssueWithUpload();
		const { zip } = await buildDataExport();
		const entries = unzipSync(zip);
		const bad = zipSync({
			'manifest.json': entries['manifest.json'],
			'config/users.json': entries['config/users.json'],
			'config/applications.json': entries['config/applications.json'],
			'issues/charcoal/accounting.json': strToU8('[{"id": "broken"}]')
		});
		await expect(importDataArchive(bad)).rejects.toThrow(/failed validation/);
		// Current state untouched.
		await store.reload();
		expect(store.get(current.id)?.title).toBe('Exported issue');
	});

	it('requires config/users.json and applications.json', async () => {
		const { zip } = await buildDataExport();
		const entries = unzipSync(zip);
		const partial = zipSync({
			'manifest.json': entries['manifest.json'],
			'issues/charcoal/accounting.json': entries['issues/charcoal/accounting.json']
		});
		await expect(importDataArchive(partial)).rejects.toThrow(/missing config/);
	});

	it('leaves Checkpoint content on disk untouched', async () => {
		await createIssueWithUpload();
		await mkdir(path.join(dir, 'tests', 'charcoal'), { recursive: true });
		await writeFile(path.join(dir, 'tests', 'charcoal', 'accounting.json'), '[]\n');
		await writeFile(path.join(dir, 'runners.json'), '[]\n');
		const { zip } = await buildDataExport();
		expect(Object.keys(unzipSync(zip)).some((n) => n.startsWith('tests/'))).toBe(false);
		await importDataArchive(zip);
		expect(await readFile(path.join(dir, 'tests', 'charcoal', 'accounting.json'), 'utf8')).toBe(
			'[]\n'
		);
		expect(await readFile(path.join(dir, 'runners.json'), 'utf8')).toBe('[]\n');
	});
});
