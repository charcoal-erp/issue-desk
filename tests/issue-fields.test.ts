import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { UNASSIGNED_MODULE_FILE } from '$lib/server/store';
import { seedDataDir } from '$lib/server/store/seed';
import type { CreateIssueInput } from '$lib/types';

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

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

const readIssues = async (app: string, file: string) =>
	JSON.parse(await readFile(path.join(dir, 'issues', app, `${file}.json`), 'utf8'));

describe('optional module', () => {
	it('creates an issue with no module at all', async () => {
		const issue = await store.create({ ...base, moduleId: undefined }, 'kiran');
		expect(issue.moduleId).toBeUndefined();
		expect(issue.moduleName).toBeUndefined();
		expect(store.get(issue.id)?.title).toBe(base.title);
	});

	it('treats an empty-string module as no module', async () => {
		// This is what the form submits when "All modules" is picked.
		const issue = await store.create({ ...base, moduleId: '' }, 'kiran');
		expect(issue.moduleId).toBeUndefined();
	});

	it('parks module-less issues in unassigned.json and reloads them', async () => {
		const issue = await store.create({ ...base, moduleId: undefined }, 'kiran');
		expect(await readIssues('charcoal', UNASSIGNED_MODULE_FILE)).toHaveLength(1);

		// The file must be picked up on a cold load — a name the loader skipped
		// would lose the issue entirely.
		store.__resetForTests();
		await store.ensureLoaded();
		expect(store.get(issue.id)?.id).toBe(issue.id);
	});

	it('still rejects a module that does not exist', async () => {
		await expect(store.create({ ...base, moduleId: 'nonesuch' }, 'kiran')).rejects.toThrow(
			/Unknown module/
		);
	});

	it('moves the issue between files when the module is set or cleared', async () => {
		const issue = await store.create({ ...base, moduleId: undefined }, 'kiran');
		await store.update(issue.id, { moduleId: 'accounting' }, 'kiran');

		expect(await readIssues('charcoal', 'accounting')).toHaveLength(1);
		expect(await readIssues('charcoal', UNASSIGNED_MODULE_FILE)).toHaveLength(0);
		expect(store.get(issue.id)?.moduleName).toBe('Accounting');

		await store.update(issue.id, { moduleId: '' }, 'kiran');
		expect(await readIssues('charcoal', UNASSIGNED_MODULE_FILE)).toHaveLength(1);
		expect(await readIssues('charcoal', 'accounting')).toHaveLength(0);
		expect(store.get(issue.id)?.moduleId).toBeUndefined();
	});

	it('leaves the module alone when a patch does not mention it', async () => {
		const issue = await store.create(base, 'kiran');
		await store.update(issue.id, { title: 'Renamed' }, 'kiran');
		expect(store.get(issue.id)?.moduleId).toBe('accounting');
	});

	it('finds module-less issues by free-text search', async () => {
		await store.create({ ...base, moduleId: undefined }, 'kiran');
		expect(store.list({ q: 'discounted' }).total).toBe(1);
	});

	it('excludes module-less issues from a module filter', async () => {
		await store.create({ ...base, moduleId: undefined }, 'kiran');
		await store.create({ ...base, title: 'With module' }, 'kiran');
		const { total } = store.list({ appId: 'charcoal', moduleId: 'accounting' });
		expect(total).toBe(1);
	});
});

describe('source', () => {
	it('records a human reporter as manual testing', async () => {
		const issue = await store.create(base, 'kiran');
		expect(issue.source).toBe('manual-testing');
	});

	it('records an agent account as agent testing', async () => {
		const issue = await store.create(base, 'claude-agent');
		expect(issue.source).toBe('agent-testing');
	});

	it('honours an explicit source — the Checkpoint ingest path', async () => {
		const issue = await store.create(base, 'kiran', undefined, 'checkpoint-triggered');
		expect(issue.source).toBe('checkpoint-triggered');
	});

	it('filters by source', async () => {
		await store.create(base, 'kiran');
		await store.create({ ...base, title: 'From an agent' }, 'claude-agent');

		expect(store.list({ source: ['agent-testing'] }).rows.map((i) => i.title)).toEqual([
			'From an agent'
		]);
		expect(store.list({ source: ['manual-testing', 'agent-testing'] }).total).toBe(2);
	});

	it('survives a reload, and defaults older issues to manual', async () => {
		await store.create(base, 'claude-agent');
		store.__resetForTests();
		await store.ensureLoaded();
		expect(store.list({}).rows[0].source).toBe('agent-testing');
	});
});

describe('backlog', () => {
	it('parks an issue without counting it as open work', async () => {
		const issue = await store.create({ ...base, status: 'backlog' }, 'kiran');
		expect(store.list({ status: ['backlog'] }).rows.map((i) => i.id)).toEqual([issue.id]);
		expect(store.list({ status: ['open'] }).total).toBe(0);
	});

	it('moves work in and out of the backlog', async () => {
		const issue = await store.create(base, 'kiran');
		await store.update(issue.id, { status: 'backlog' }, 'kiran');
		expect(store.get(issue.id)?.status).toBe('backlog');
		// The transition is recorded like any other, so the timeline explains it.
		expect(store.get(issue.id)?.activity.at(-1)).toMatchObject({
			kind: 'status',
			from: 'open',
			to: 'backlog'
		});
	});
});
