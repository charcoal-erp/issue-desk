import { rm } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { seedDataDir } from '$lib/server/store/seed';
import type { CreateIssueInput } from '$lib/types';
import { GET as getList } from '../src/routes/api/issues/+server';
import { GET as getOne } from '../src/routes/api/issues/[id]/+server';

const dir = process.env.DATA_DIR!;

const base: CreateIssueInput = {
	type: 'bug',
	title: 'Tax computed on discounted subtotal',
	description: 'desc',
	appId: 'charcoal',
	moduleId: 'accounting',
	priority: 'high',
	status: 'open',
	tags: [],
	attachments: []
};

// Minimal stand-ins for the bits of RequestEvent each handler reads.
function listEvent(search = '') {
	return { url: new URL(`http://x/api/issues${search}`) } as Parameters<typeof getList>[0];
}
function oneEvent(id: string) {
	return { params: { id } } as unknown as Parameters<typeof getOne>[0];
}

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('GET /api/issues/[id] — link resolution for Checkpoint', () => {
	it('resolves an existing issue to id/title/status', async () => {
		const issue = await store.create(base, 'kiran');
		const res = await getOne(oneEvent(issue.id));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.issue).toMatchObject({ id: issue.id, title: base.title, status: 'open' });
	});

	it('404s an unknown id', async () => {
		const res = await getOne(oneEvent('CHR-999'));
		expect(res.status).toBe(404);
	});
});

describe('GET /api/issues — parent-issue picker', () => {
	it('lists open issues, and filters by app', async () => {
		await store.create(base, 'kiran');
		await store.create({ ...base, title: 'A drishti bug', appId: 'drishti', moduleId: 'public-portal' }, 'kiran');

		const all = await (await getList(listEvent())).json();
		expect(all.issues.length).toBe(2);
		expect(all.issues[0]).toHaveProperty('title');

		const charcoal = await (await getList(listEvent('?app=charcoal'))).json();
		expect(charcoal.issues.map((i: { appId: string }) => i.appId)).toEqual(['charcoal']);
	});

	it('omits non-open issues', async () => {
		const issue = await store.create(base, 'kiran');
		await store.update(issue.id, { status: 'complete' }, 'kiran');
		const body = await (await getList(listEvent())).json();
		expect(body.issues).toEqual([]);
	});
});
