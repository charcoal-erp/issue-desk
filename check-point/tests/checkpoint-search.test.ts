import { rm } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { seedDataDir } from '$lib/server/store/seed';
import { searchCheckpoint } from '$lib/server/checkpoint/search';
import type { CreateRunnerInput, CreateTestCaseInput } from '$lib/types';

const dir = process.env.DATA_DIR!;

const visualRunner: CreateRunnerInput = {
	name: 'visual walkthrough (playwright)',
	kind: 'visual',
	language: 'node',
	command: 'bash ../platform-testing/tools/runners/visual.sh',
	workingDir: 'charcoal/e2e',
	reportFormat: 'playwright-json',
	reportPath: '/tmp/checkpoint-raw/visual.json',
	matchStrategy: { by: 'testName' },
	enabled: true
};

const taxCase: CreateTestCaseInput = {
	appId: 'charcoal',
	moduleId: 'accounting',
	page: 'Invoice',
	form: 'Line items',
	title: 'Tax computed on discounted subtotal',
	preconditions: '',
	steps: [],
	priority: 'critical',
	status: 'active',
	tags: ['billing'],
	kind: 'api',
	runnerId: null,
	specPath: 'tests/api/billing/test_tax.py',
	externalTestId: null,
	parentIssueId: null,
	suiteIds: []
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

function keys(groups: ReturnType<typeof searchCheckpoint>): string[] {
	return groups.map((g) => g.key);
}

describe('global search', () => {
	it('returns nothing for a blank query rather than everything', () => {
		expect(searchCheckpoint('')).toEqual([]);
		expect(searchCheckpoint('   ')).toEqual([]);
	});

	it('finds a runner by a fragment of its command', async () => {
		await cp.createRunner(visualRunner);
		const groups = searchCheckpoint('visual.sh');
		expect(keys(groups)).toEqual(['runners']);
		expect(groups[0].hits[0].title).toBe('visual walkthrough (playwright)');
	});

	it('finds a case by its spec path and links to it', async () => {
		await cp.createCase(taxCase, 'kiran');
		const groups = searchCheckpoint('test_tax.py');
		const cases = groups.find((g) => g.key === 'cases');
		expect(cases?.total).toBe(1);
		expect(cases?.hits[0].href).toMatch(/^\/cases\?case=TC-/);
		expect(cases?.hits[0].kind).toBe('api');
	});

	it('spans entities, listing suites before cases', async () => {
		await cp.createRunner(visualRunner);
		const c = await cp.createCase({ ...taxCase, title: 'visual regression on invoice' }, 'kiran');
		await cp.createSuite(
			{ appId: 'charcoal', name: 'Visual walkthrough', description: '', defaultEnv: 'local', tags: [], caseIds: [c.id] },
			'kiran'
		);
		expect(keys(searchCheckpoint('visual'))).toEqual(['suites', 'cases', 'runners']);
	});

	it('narrows as words are added', async () => {
		await cp.createRunner(visualRunner);
		await cp.createRunner({
			...visualRunner,
			name: 'e2e walkthrough (playwright)',
			kind: 'e2e',
			command: 'bash ../platform-testing/tools/runners/e2e.sh'
		});
		expect(searchCheckpoint('walkthrough')[0].total).toBe(2);
		expect(searchCheckpoint('walkthrough visual')[0].total).toBe(1);
		expect(searchCheckpoint('walkthrough nonsense')).toEqual([]);
	});

	it('omits groups with no hits instead of showing empty headings', async () => {
		await cp.createRunner(visualRunner);
		expect(keys(searchCheckpoint('visual.sh'))).not.toContain('suites');
	});
});
