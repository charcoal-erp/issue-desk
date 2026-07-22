import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { seedDataDir } from '$lib/server/store/seed';
import type { CreateRunnerInput, CreateTestCaseInput, TestRun } from '$lib/types';

const dir = process.env.DATA_DIR!;

const baseCase: CreateTestCaseInput = {
	appId: 'charcoal',
	moduleId: 'accounting',
	page: 'Invoice',
	form: 'Line items',
	title: 'Tax computed on discounted subtotal',
	preconditions: 'An invoice exists',
	steps: [{ action: 'POST /invoices', expected: 'tax on post-discount subtotal' }],
	priority: 'critical',
	status: 'active',
	tags: ['billing'],
	kind: 'api',
	runnerId: 'RNR-1',
	specPath: 'tests/api/billing/test_tax.py',
	externalTestId: 'test_tax.py::test_discounted',
	parentIssueId: null,
	suiteIds: []
};

const baseRunner: CreateRunnerInput = {
	name: 'API contract (pytest)',
	kind: 'api',
	language: 'python',
	command: 'pytest tests/api -q --junitxml=reports/api-junit.xml',
	workingDir: 'services/api',
	reportFormat: 'junit-xml',
	reportPath: 'reports/api-junit.xml',
	matchStrategy: { by: 'nodeid' },
	enabled: true
};

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

describe('boot / empty state', () => {
	it('loads with no runners, cases, suites or runs', () => {
		expect(cp.runners()).toHaveLength(0);
		expect(cp.cases()).toHaveLength(0);
		expect(cp.suites()).toHaveLength(0);
		expect(cp.runs()).toHaveLength(0);
	});

	it('previews the next per-app ids from 1', () => {
		expect(cp.nextCaseId('charcoal')).toBe('TC-CHR-1');
		expect(cp.nextSuiteId('charcoal')).toBe('SUITE-CHR-1');
		expect(cp.nextRunnerId()).toBe('RNR-1');
		expect(cp.nextCaseId('drishti')).toBe('TC-DRS-1');
	});
});

describe('createCase', () => {
	it('allocates the per-app id, denormalises, and persists', async () => {
		const c = await cp.createCase(baseCase, 'kiran');
		expect(c.id).toBe('TC-CHR-1');
		expect(c.seq).toBe(1);
		expect(c.appName).toBe('Charcoal');
		expect(c.target.moduleName).toBe('Accounting');
		expect(c.target.pageName).toBe('Invoice');
		expect(c.target.formName).toBe('Line items');
		expect(c.createdBy).toBe('kiran');

		const seq = JSON.parse(await readFile(path.join(dir, 'tests/charcoal/_sequence.json'), 'utf8'));
		expect(seq.testCase).toBe(2);
		const file = JSON.parse(await readFile(path.join(dir, 'tests/charcoal/accounting.json'), 'utf8'));
		expect(file.some((c: { id: string }) => c.id === 'TC-CHR-1')).toBe(true);
	});

	it('nulls the execution fields for a manual case', async () => {
		const c = await cp.createCase(
			{ ...baseCase, kind: 'manual', runnerId: 'RNR-1', specPath: 'x', externalTestId: 'y' },
			'kiran'
		);
		expect(c.runnerId).toBeNull();
		expect(c.specPath).toBeNull();
		expect(c.externalTestId).toBeNull();
	});

	it('numbers each app independently', async () => {
		const a = await cp.createCase(baseCase, 'kiran');
		const b = await cp.createCase({ ...baseCase, appId: 'drishti', moduleId: 'public-portal' }, 'kiran');
		expect(a.id).toBe('TC-CHR-1');
		expect(b.id).toBe('TC-DRS-1');
	});

	it('never collides under concurrent creates (app lock)', async () => {
		const created = await Promise.all(
			Array.from({ length: 8 }, (_, i) => cp.createCase({ ...baseCase, title: `case ${i}` }, 'kiran'))
		);
		expect(new Set(created.map((c) => c.id)).size).toBe(8);
	});
});

describe('suite membership sync', () => {
	it('createSuite with caseIds back-links the cases', async () => {
		const c = await cp.createCase(baseCase, 'kiran');
		const s = await cp.createSuite(
			{ appId: 'charcoal', name: 'Billing release', caseIds: [c.id], defaultEnv: 'staging', tags: [] },
			'kiran'
		);
		expect(s.id).toBe('SUITE-CHR-1');
		expect(cp.getCase(c.id)!.suiteIds).toContain(s.id);
	});

	it('createCase with suiteIds adds the case to the suite', async () => {
		const s = await cp.createSuite(
			{ appId: 'charcoal', name: 'Auth regression', caseIds: [], defaultEnv: 'staging', tags: [] },
			'kiran'
		);
		const c = await cp.createCase({ ...baseCase, suiteIds: [s.id] }, 'kiran');
		expect(cp.getSuite(s.id)!.caseIds).toContain(c.id);
	});

	it('reorders membership and keeps order', async () => {
		const a = await cp.createCase(baseCase, 'kiran');
		const b = await cp.createCase({ ...baseCase, title: 'second' }, 'kiran');
		const s = await cp.createSuite(
			{ appId: 'charcoal', name: 'S', caseIds: [a.id, b.id], defaultEnv: 'ci', tags: [] },
			'kiran'
		);
		const reordered = await cp.updateSuite(s.id, { caseIds: [b.id, a.id] }, 'kiran');
		expect(reordered.caseIds).toEqual([b.id, a.id]);
	});

	it('deleteCase strips the case from its suites', async () => {
		const c = await cp.createCase(baseCase, 'kiran');
		const s = await cp.createSuite(
			{ appId: 'charcoal', name: 'S', caseIds: [c.id], defaultEnv: 'ci', tags: [] },
			'kiran'
		);
		await cp.deleteCase(c.id);
		expect(cp.getSuite(s.id)!.caseIds).not.toContain(c.id);
	});

	it('deleteSuite leaves the cases but strips the suite link', async () => {
		const c = await cp.createCase(baseCase, 'kiran');
		const s = await cp.createSuite(
			{ appId: 'charcoal', name: 'S', caseIds: [c.id], defaultEnv: 'ci', tags: [] },
			'kiran'
		);
		await cp.deleteSuite(s.id);
		expect(cp.getCase(c.id)).toBeTruthy();
		expect(cp.getCase(c.id)!.suiteIds).not.toContain(s.id);
	});

	it('duplicates a suite with its membership', async () => {
		const c = await cp.createCase(baseCase, 'kiran');
		const s = await cp.createSuite(
			{ appId: 'charcoal', name: 'Billing', caseIds: [c.id], defaultEnv: 'ci', tags: ['x'] },
			'kiran'
		);
		const dup = await cp.duplicateSuite(s.id, 'kiran');
		expect(dup.id).not.toBe(s.id);
		expect(dup.caseIds).toEqual([c.id]);
		expect(dup.name).toBe('Billing (copy)');
	});
});

describe('runners', () => {
	it('numbers globally and toggles enabled', async () => {
		const r1 = await cp.createRunner(baseRunner);
		const r2 = await cp.createRunner({ ...baseRunner, name: 'E2E', kind: 'e2e', language: 'node' });
		expect(r1.id).toBe('RNR-1');
		expect(r2.id).toBe('RNR-2');
		const toggled = await cp.toggleRunner(r1.id, false);
		expect(toggled.enabled).toBe(false);
		const file = JSON.parse(await readFile(path.join(dir, 'runners.json'), 'utf8'));
		expect(file).toHaveLength(2);
	});
});

describe('runs + results index', () => {
	async function seedRun(status: 'pass' | 'fail'): Promise<TestRun> {
		const c = await cp.createCase(baseCase, 'kiran');
		const id = await cp.allocateRunId('charcoal');
		const run: TestRun = {
			id,
			seq: Number(id.split('-').at(-1)),
			appId: 'charcoal',
			appCode: 'CHR',
			appName: 'Charcoal',
			environment: 'staging',
			startedBy: 'kiran',
			startedAt: new Date().toISOString(),
			invocations: [],
			results: [
				{
					testCaseId: c.id,
					runnerId: 'RNR-1',
					status,
					durationMs: 820,
					message: status === 'fail' ? 'AssertionError' : null,
					stack: null,
					artifacts: []
				}
			]
		};
		return cp.saveRun(run);
	}

	it('allocates run ids per app and persists the run file', async () => {
		const run = await seedRun('pass');
		expect(run.id).toBe('RUN-CHR-1');
		const file = JSON.parse(await readFile(path.join(dir, `runs/charcoal/${run.id}.json`), 'utf8'));
		expect(file.id).toBe(run.id);
	});

	it('feeds the last-result index used by the cases table', async () => {
		await seedRun('fail');
		const c = cp.listCases({ appId: 'charcoal' })[0];
		expect(cp.lastResultForCase(c.id)!.result.status).toBe('fail');
		expect(cp.listCases({ lastResult: ['fail'] })).toHaveLength(1);
		expect(cp.listCases({ lastResult: ['pass'] })).toHaveLength(0);
	});
});

describe('listCases filters', () => {
	beforeEach(async () => {
		await cp.createCase(baseCase, 'kiran'); // api, active
		await cp.createCase({ ...baseCase, kind: 'manual', status: 'draft', title: 'manual one' }, 'kiran');
		await cp.createCase({ ...baseCase, appId: 'drishti', moduleId: 'public-portal', title: 'drs' }, 'kiran');
	});

	it('filters by app, kind and status', () => {
		expect(cp.listCases({ appId: 'charcoal' })).toHaveLength(2);
		expect(cp.listCases({ kind: ['manual'] })).toHaveLength(1);
		expect(cp.listCases({ status: ['draft'] })).toHaveLength(1);
	});

	it('free-text search hits id/title/spec', () => {
		expect(cp.listCases({ q: 'tc-chr-1' }).length).toBeGreaterThan(0);
		expect(cp.listCases({ q: 'manual one' })).toHaveLength(1);
	});
});

describe('reload', () => {
	it('re-reads cases and suites from disk', async () => {
		const c = await cp.createCase(baseCase, 'kiran');
		await cp.createSuite(
			{ appId: 'charcoal', name: 'S', caseIds: [c.id], defaultEnv: 'ci', tags: [] },
			'kiran'
		);
		await cp.reload();
		expect(cp.getCase(c.id)).toBeTruthy();
		expect(cp.suites('charcoal')).toHaveLength(1);
		expect(cp.getCase(c.id)!.suiteIds).toHaveLength(1);
	});
});
