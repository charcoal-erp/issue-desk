import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { seedDataDir } from '$lib/server/store/seed';
import type { Attachment } from '$lib/types';

// Matches test.env.DATA_DIR in vite.config.ts ($env snapshots at first import).
const dir = process.env.DATA_DIR!;

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('IssueStore.list', () => {
	it('returns the whole dataset unfiltered', () => {
		expect(store.list({}).total).toBe(15);
	});

	it('intersects app + status + priority facets', () => {
		const { rows } = store.list({ appId: 'charcoal-erp', status: ['open'] });
		expect(rows.map((r) => r.id).sort()).toEqual(['CHR-11', 'CHR-14']);
		const critical = store.list({ status: ['open'], priority: ['critical'] });
		expect(critical.rows.map((r) => r.id).sort()).toEqual(['AMR-07', 'CHR-14']);
	});

	it('unions multi-select facets', () => {
		const { total } = store.list({ status: ['implemented', 'complete'] });
		expect(total).toBe(6);
	});

	it('applies free-text search over id/title/description/module/tags', () => {
		expect(store.list({ q: 'otp' }).rows[0].id).toBe('CHR-14');
		expect(store.list({ q: 'chr-1' }).total).toBe(2); // CHR-11, CHR-14
		expect(store.list({ q: 'compliance' }).rows[0].id).toBe('RLY-03'); // tag
	});

	it('sorts by priority with the intrinsic Critical→Low order', () => {
		const { rows } = store.list({ sort: 'priority', dir: 'desc' });
		expect(rows[0].priority).toBe('critical');
		expect(rows.at(-1)?.priority).toBe('low');
	});

	it('paginates', () => {
		const page2 = store.list({ sort: 'id', dir: 'asc', page: 2, pageSize: 5 });
		expect(page2.total).toBe(15);
		expect(page2.rows).toHaveLength(5);
	});
});

describe('IssueStore.create', () => {
	const input = {
		type: 'bug' as const,
		title: 'Test issue',
		description: 'desc',
		appId: 'charcoal-erp',
		moduleId: 'auth',
		pageId: 'login',
		formId: 'otp',
		priority: 'high' as const,
		status: 'open' as const,
		assigneeId: undefined,
		tags: ['test'],
		attachments: [] as Attachment[]
	};

	it('allocates the per-app sequence and denormalises labels', async () => {
		const issue = await store.create(input, 'kiran');
		expect(issue.id).toBe('CHR-15');
		expect(issue.seq).toBe(15);
		expect(issue.appName).toBe('Charcoal ERP');
		expect(issue.moduleCode).toBe('AUTH');
		expect(issue.pagePath).toBe('/login');
		expect(issue.formName).toBe('OTP Verification');
		expect(issue.activity[0].kind).toBe('created');

		const seq = JSON.parse(
			await readFile(path.join(dir, 'issues/charcoal-erp/_sequence.json'), 'utf8')
		);
		expect(seq.next).toBe(16);
		const file = JSON.parse(
			await readFile(path.join(dir, 'issues/charcoal-erp/auth.json'), 'utf8')
		);
		expect(file.some((i: { id: string }) => i.id === 'CHR-15')).toBe(true);
	});

	it('never collides on numbers under concurrent creates (app lock)', async () => {
		const issues = await Promise.all(
			Array.from({ length: 10 }, (_, i) =>
				store.create({ ...input, title: `Concurrent ${i}` }, 'kiran')
			)
		);
		const ids = new Set(issues.map((i) => i.id));
		expect(ids.size).toBe(10);
		const seq = JSON.parse(
			await readFile(path.join(dir, 'issues/charcoal-erp/_sequence.json'), 'utf8')
		);
		expect(seq.next).toBe(25);
	});

	it('keeps numbering per app while storing per module', async () => {
		const authBug = await store.create(input, 'kiran');
		const billingBug = await store.create({ ...input, moduleId: 'billing' }, 'kiran');
		expect(authBug.seq + 1).toBe(billingBug.seq); // shared counter
		const billing = JSON.parse(
			await readFile(path.join(dir, 'issues/charcoal-erp/billing.json'), 'utf8')
		);
		expect(billing.some((i: { id: string }) => i.id === billingBug.id)).toBe(true);
	});
});

describe('IssueStore.update', () => {
	it('tracks field changes in the activity log and bumps updatedAt', async () => {
		const before = store.get('CHR-14')!;
		const after = await store.update('CHR-14', { status: 'implemented', priority: 'high' }, 'dev');
		expect(after.status).toBe('implemented');
		expect(after.activity.some((a) => a.kind === 'status' && a.to === 'implemented')).toBe(true);
		expect(after.activity.some((a) => a.kind === 'priority' && a.to === 'high')).toBe(true);
		expect(after.updatedAt >= before.updatedAt).toBe(true);
	});

	it('moves the issue file when the module changes, keeping the ID', async () => {
		const moved = await store.update('CHR-14', { moduleId: 'billing' }, 'dev');
		expect(moved.id).toBe('CHR-14');
		expect(moved.moduleName).toBe('Billing');
		const auth = JSON.parse(
			await readFile(path.join(dir, 'issues/charcoal-erp/auth.json'), 'utf8')
		);
		const billing = JSON.parse(
			await readFile(path.join(dir, 'issues/charcoal-erp/billing.json'), 'utf8')
		);
		expect(auth.some((i: { id: string }) => i.id === 'CHR-14')).toBe(false);
		expect(billing.some((i: { id: string }) => i.id === 'CHR-14')).toBe(true);
	});
});

describe('IssueStore.remove / comment', () => {
	it('removes an issue from memory and disk', async () => {
		await store.remove('NBX-03', 'kiran');
		expect(store.get('NBX-03')).toBeUndefined();
		const file = JSON.parse(await readFile(path.join(dir, 'issues/notebox/sync.json'), 'utf8'));
		expect(file).toHaveLength(0);
	});

	it('appends comments to the activity log', async () => {
		const after = await store.comment('CHR-14', 'Reproduced on Firefox too.', 'priya');
		const last = after.activity.at(-1)!;
		expect(last.kind).toBe('comment');
		expect(last.message).toBe('Reproduced on Firefox too.');
	});
});

describe('reference-data mutations', () => {
	it('upserts a user and persists to config', async () => {
		await store.upsertUser({ id: 'maya', name: 'Maya Iyer', role: 'QA' });
		expect(store.users().some((u) => u.id === 'maya')).toBe(true);
		const file = JSON.parse(await readFile(path.join(dir, 'config/users.json'), 'utf8'));
		expect(file.some((u: { id: string }) => u.id === 'maya')).toBe(true);
	});

	it('creates a sequence for a brand-new application', async () => {
		await store.upsertApplication({ id: 'zephyr', code: 'ZPH', name: 'Zephyr', modules: [
			{ id: 'core', code: 'CORE', name: 'Core', pages: [] }
		] });
		expect(store.nextIds()['zephyr']).toBe('ZPH-1');
		const issue = await store.create(
			{
				type: 'feature', title: 'First', description: '', appId: 'zephyr', moduleId: 'core',
				priority: 'low', status: 'open', tags: [], attachments: []
			},
			'kiran'
		);
		expect(issue.id).toBe('ZPH-1');
	});
});
