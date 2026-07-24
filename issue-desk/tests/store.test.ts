import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { seedDataDir } from '$lib/server/store/seed';
import type { Attachment, CreateIssueInput } from '$lib/types';

// Matches test.env.DATA_DIR in vite.config.ts ($env snapshots at first import).
const dir = process.env.DATA_DIR!;

const base: CreateIssueInput = {
	type: 'bug',
	title: 'Test issue',
	description: 'desc',
	appId: 'charcoal',
	moduleId: 'accounting',
	page: '/accounting/journal',
	form: 'Journal Entry',
	priority: 'high',
	status: 'open',
	assigneeId: undefined,
	tags: ['test'],
	attachments: [] as Attachment[]
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

describe('seed', () => {
	it('seeds five apps and four users, no issues', () => {
		expect(store.applications().map((a) => a.id).sort()).toEqual([
			'charcoal',
			'chattr',
			'coffee-ops',
			'drishti',
			'relay'
		]);
		expect(store.users()).toHaveLength(4);
		expect(store.list({}).total).toBe(0);
	});

	it('gives Charcoal 14 modules and Drishti 6', () => {
		expect(store.applications().find((a) => a.id === 'charcoal')!.modules).toHaveLength(14);
		expect(store.applications().find((a) => a.id === 'drishti')!.modules).toHaveLength(6);
	});

	it('marks only Kiran and Tushar assignable', () => {
		const assignable = store.users().filter((u) => u.assignable).map((u) => u.id).sort();
		expect(assignable).toEqual(['kiran', 'tushar']);
	});

	it('starts each app sequence at 1', () => {
		expect(store.nextIds()['charcoal']).toBe('CHR-1');
		expect(store.nextIds()['drishti']).toBe('DRS-1');
	});
});

describe('IssueStore.create', () => {
	it('allocates the per-app sequence and captures free-text page/form', async () => {
		const issue = await store.create(base, 'kiran');
		expect(issue.id).toBe('CHR-1');
		expect(issue.seq).toBe(1);
		expect(issue.appName).toBe('Charcoal');
		expect(issue.moduleName).toBe('Accounting');
		expect(issue.pagePath).toBe('/accounting/journal');
		expect(issue.formName).toBe('Journal Entry');
		expect(issue.reporterId).toBe('kiran');
		expect(issue.activity[0].kind).toBe('created');

		const seq = JSON.parse(await readFile(path.join(dir, 'issues/charcoal/_sequence.json'), 'utf8'));
		expect(seq.next).toBe(2);
		const file = JSON.parse(await readFile(path.join(dir, 'issues/charcoal/accounting.json'), 'utf8'));
		expect(file.some((i: { id: string }) => i.id === 'CHR-1')).toBe(true);
	});

	it('never collides on numbers under concurrent creates (app lock)', async () => {
		const issues = await Promise.all(
			Array.from({ length: 10 }, (_, i) => store.create({ ...base, title: `Concurrent ${i}` }, 'kiran'))
		);
		expect(new Set(issues.map((i) => i.id)).size).toBe(10);
		const seq = JSON.parse(await readFile(path.join(dir, 'issues/charcoal/_sequence.json'), 'utf8'));
		expect(seq.next).toBe(11);
	});

	it('shares one counter across modules but stores per module', async () => {
		const acct = await store.create(base, 'kiran');
		const hr = await store.create({ ...base, moduleId: 'hr' }, 'kiran');
		expect(acct.seq + 1).toBe(hr.seq);
		const hrFile = JSON.parse(await readFile(path.join(dir, 'issues/charcoal/hr.json'), 'utf8'));
		expect(hrFile.some((i: { id: string }) => i.id === hr.id)).toBe(true);
	});
});

describe('IssueStore.list', () => {
	beforeEach(async () => {
		await store.create({ ...base, moduleId: 'accounting', priority: 'critical', status: 'open' }, 'kiran');
		await store.create({ ...base, moduleId: 'hr', priority: 'low', status: 'complete', tags: ['hr'] }, 'anant');
		await store.create({ ...base, appId: 'drishti', moduleId: 'public-portal', priority: 'medium', status: 'open' }, 'tushar');
	});

	it('filters by app', () => {
		expect(store.list({ appId: 'charcoal' }).total).toBe(2);
		expect(store.list({ appId: 'drishti' }).total).toBe(1);
	});

	it('intersects app + status', () => {
		expect(store.list({ appId: 'charcoal', status: ['open'] }).total).toBe(1);
	});

	it('sorts priority desc Critical→Low', () => {
		const { rows } = store.list({ appId: 'charcoal', sort: 'priority', dir: 'desc' });
		expect(rows[0].priority).toBe('critical');
		expect(rows.at(-1)?.priority).toBe('low');
	});

	it('free-text search hits id/title/tags', () => {
		expect(store.list({ q: 'chr-1' }).total).toBeGreaterThan(0);
		expect(store.list({ q: 'hr' }).rows.some((r) => r.tags.includes('hr'))).toBe(true);
	});
});

describe('IssueStore.update', () => {
	it('tracks changes and can move an issue between modules keeping its ID', async () => {
		const created = await store.create(base, 'kiran');
		const moved = await store.update(created.id, { moduleId: 'hr', status: 'implemented' }, 'tushar');
		expect(moved.id).toBe(created.id);
		expect(moved.moduleName).toBe('HR');
		expect(moved.activity.some((a) => a.kind === 'status' && a.to === 'implemented')).toBe(true);
		const acct = JSON.parse(await readFile(path.join(dir, 'issues/charcoal/accounting.json'), 'utf8'));
		const hr = JSON.parse(await readFile(path.join(dir, 'issues/charcoal/hr.json'), 'utf8'));
		expect(acct.some((i: { id: string }) => i.id === created.id)).toBe(false);
		expect(hr.some((i: { id: string }) => i.id === created.id)).toBe(true);
	});

	it('updates free-text page/form', async () => {
		const created = await store.create(base, 'kiran');
		const edited = await store.update(created.id, { page: '/accounting/ledger', form: 'Ledger Filter' }, 'kiran');
		expect(edited.pagePath).toBe('/accounting/ledger');
		expect(edited.formName).toBe('Ledger Filter');
	});
});

describe('reference-data mutations', () => {
	it('upserts a user with the assignable flag', async () => {
		await store.upsertUser({ id: 'maya', name: 'Maya Iyer', role: 'QA', assignable: true });
		expect(store.users().find((u) => u.id === 'maya')?.assignable).toBe(true);
		const file = JSON.parse(await readFile(path.join(dir, 'config/users.json'), 'utf8'));
		expect(file.some((u: { id: string }) => u.id === 'maya')).toBe(true);
	});

	it('creates a sequence for a brand-new application', async () => {
		await store.upsertApplication({
			id: 'zephyr',
			code: 'ZPH',
			name: 'Zephyr',
			modules: [{ id: 'core', code: 'CORE', name: 'Core', pages: [] }]
		});
		expect(store.nextIds()['zephyr']).toBe('ZPH-1');
		const issue = await store.create(
			{ type: 'feature', title: 'First', description: '', appId: 'zephyr', moduleId: 'core', priority: 'low', status: 'open', tags: [], attachments: [] },
			'kiran'
		);
		expect(issue.id).toBe('ZPH-1');
	});
});
