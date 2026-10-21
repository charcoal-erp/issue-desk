import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { rotate, snapshot } from '$lib/server/store/backup';
import { seedDataDir } from '$lib/server/store/seed';

const dir = process.env.DATA_DIR!;
const backups = path.join(dir, '.backups');

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
});

describe('data snapshots', () => {
	it('copies config and issues into a timestamped folder', async () => {
		const stamp = await snapshot('test');
		expect(stamp).toBeDefined();
		expect((await readdir(path.join(backups, stamp!))).sort()).toEqual(['config', 'issues']);
	});

	it('skips a scheduled snapshot when nothing changed, and takes one after a write', async () => {
		await snapshot('boot');
		expect(await snapshot('scheduled', { skipUnchanged: true })).toBeUndefined();
		await store.create(
			{ type: 'bug', title: 'New', description: '', appId: 'charcoal', moduleId: 'accounting', priority: 'low', status: 'open', tags: [], attachments: [] },
			'kiran'
		);
		expect(await snapshot('scheduled', { skipUnchanged: true })).toBeDefined();
		expect(await readdir(backups)).toHaveLength(2);
	});
});

describe('snapshot rotation', () => {
	it('keeps the newest N plus the last snapshot of each recent day, and ignores other folders', async () => {
		const names = [
			'2026-10-01T10-00-00-000Z',
			'2026-10-01T23-00-00-000Z', // last of Oct 1
			'2026-10-02T09-00-00-000Z', // last of Oct 2
			'2026-10-03T08-00-00-000Z',
			'2026-10-03T09-00-00-000Z',
			'2026-10-03T10-00-00-000Z',
			'pre-import-2026-09-01'
		];
		for (const n of names) await mkdir(path.join(backups, n), { recursive: true });
		await rotate(backups, 2, 2);
		expect((await readdir(backups)).sort()).toEqual([
			'2026-10-02T09-00-00-000Z',
			'2026-10-03T09-00-00-000Z',
			'2026-10-03T10-00-00-000Z',
			'pre-import-2026-09-01'
		]);
	});
});
