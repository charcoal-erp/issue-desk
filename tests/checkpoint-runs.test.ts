import { access, rm } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { seedDataDir } from '$lib/server/store/seed';
import { runFile } from '$lib/server/fs/paths';
import type { TestRun } from '$lib/types';

const dir = process.env.DATA_DIR!;
const HOUR = 3600_000;

function at(hoursAgo: number): string {
	return new Date(Date.now() - hoursAgo * HOUR).toISOString();
}

async function makeRun(
	over: Partial<TestRun> & { startedAt: string; suiteId?: string }
): Promise<TestRun> {
	const id = await cp.allocateRunId('charcoal');
	const run: TestRun = {
		id,
		seq: Number(id.split('-').at(-1)),
		appId: 'charcoal',
		appCode: 'CHR',
		appName: 'Charcoal',
		environment: 'local',
		startedBy: 'kiran',
		completedAt: over.completedAt ?? over.startedAt,
		invocations: [],
		results: [],
		...over
	};
	return cp.saveRun(run);
}

async function exists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	cp.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
	await cp.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('archiving a run', () => {
	it('marks it, stamps when, and reverses cleanly', async () => {
		const run = await makeRun({ startedAt: at(1) });
		const archived = await cp.setRunArchived(run.id, true);
		expect(archived.archived).toBe(true);
		expect(archived.archivedAt).toBeTruthy();

		const restored = await cp.setRunArchived(run.id, false);
		expect(restored.archived).toBe(false);
		expect(restored.archivedAt).toBeUndefined();
	});

	it('survives a reload from disk', async () => {
		const run = await makeRun({ startedAt: at(1) });
		await cp.setRunArchived(run.id, true);
		cp.__resetForTests();
		store.__resetForTests();
		await store.ensureLoaded();
		await cp.ensureLoaded();
		expect(cp.getRun(run.id)?.archived).toBe(true);
	});
});

describe('deleting a run', () => {
	it('removes it from the store and from disk', async () => {
		const run = await makeRun({ startedAt: at(1) });
		expect(await exists(runFile('charcoal', run.id))).toBe(true);
		await cp.deleteRun(run.id);
		expect(cp.getRun(run.id)).toBeUndefined();
		expect(await exists(runFile('charcoal', run.id))).toBe(false);
	});

	it('is a no-op for an unknown id', async () => {
		await expect(cp.deleteRun('RUN-CHR-999')).resolves.toBeUndefined();
	});
});

describe('pruning by age', () => {
	it('deletes only runs older than the cutoff', async () => {
		const old = await makeRun({ startedAt: at(48) });
		const recent = await makeRun({ startedAt: at(2) });

		const removed = await cp.pruneRuns({ before: at(24) });
		expect(removed).toEqual([old.id]);
		expect(cp.getRun(old.id)).toBeUndefined();
		expect(cp.getRun(recent.id)).toBeTruthy();
	});

	it('never deletes an archived run, however old', async () => {
		const keep = await makeRun({ startedAt: at(24 * 365) });
		await cp.setRunArchived(keep.id, true);
		const sweep = await makeRun({ startedAt: at(24 * 365) });

		const removed = await cp.pruneRuns({ before: at(1) });
		expect(removed).toEqual([sweep.id]);
		expect(cp.getRun(keep.id)?.archived).toBe(true);
		expect(await exists(runFile('charcoal', keep.id))).toBe(true);
	});

	it('never deletes a run that is still executing', async () => {
		// No completedAt — dispatch is in flight; deleting it would strand the runner.
		const running = await makeRun({ startedAt: at(48), completedAt: undefined });
		const finished = await makeRun({ startedAt: at(48) });

		const removed = await cp.pruneRuns({ before: at(24) });
		expect(removed).toEqual([finished.id]);
		expect(cp.getRun(running.id)).toBeTruthy();
	});

	it('can be scoped to one suite so a noisy suite is cleaned alone', async () => {
		const noisy = await makeRun({ startedAt: at(48), suiteId: 'SUITE-CHR-1' });
		const other = await makeRun({ startedAt: at(48), suiteId: 'SUITE-CHR-2' });

		const removed = await cp.pruneRuns({ before: at(24), suiteId: 'SUITE-CHR-1' });
		expect(removed).toEqual([noisy.id]);
		expect(cp.getRun(other.id)).toBeTruthy();
	});

	it('previews exactly what it would delete, without deleting', async () => {
		const old = await makeRun({ startedAt: at(48) });
		await makeRun({ startedAt: at(2) });

		const preview = cp.prunableRuns({ before: at(24) });
		expect(preview.map((r) => r.id)).toEqual([old.id]);
		expect(cp.getRun(old.id)).toBeTruthy(); // preview is read-only
	});
});
