import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as config from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { seedDataDir } from '$lib/server/store/seed';
import { checkpointDataDir, dataDir, runnersFile, testsDir } from '$lib/server/fs/paths';
import type { CreateRunnerInput, CreateTestCaseInput } from '$lib/types';

// Checkpoint is now its own app: DATA_DIR *is* the content root. There is no
// separate issue tracker to split from, so this proves content lands under the
// one root and nothing issue-shaped is written.
const cpRoot = process.env.DATA_DIR!;

const runner: CreateRunnerInput = {
	name: 'Manual-less pytest',
	kind: 'api',
	language: 'python',
	command: 'pytest -q',
	workingDir: '.',
	env: undefined,
	reportFormat: 'junit-xml',
	reportPath: 'report.xml',
	matchStrategy: { by: 'nodeid' },
	timeoutSec: undefined,
	enabled: true
};

const testCase: CreateTestCaseInput = {
	appId: 'charcoal',
	moduleId: 'accounting',
	page: '',
	form: '',
	title: 'Split-root case',
	preconditions: undefined,
	steps: [],
	priority: 'medium',
	status: 'active',
	tags: [],
	kind: 'manual',
	runnerId: null,
	specPath: null,
	externalTestId: null,
	parentIssueId: null,
	suiteIds: []
};

async function exists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

async function reset() {
	await rm(cpRoot, { recursive: true, force: true });
	config.__resetForTests();
	cp.__resetForTests();
	await seedDataDir();
	await config.ensureLoaded();
	await cp.ensureLoaded();
}

describe('Checkpoint content root (DATA_DIR)', () => {
	beforeEach(reset);

	afterAll(async () => {
		await rm(cpRoot, { recursive: true, force: true });
		config.__resetForTests();
		cp.__resetForTests();
	});

	it('roots all content at DATA_DIR', () => {
		expect(checkpointDataDir()).toBe(path.resolve(cpRoot));
		expect(dataDir()).toBe(path.resolve(cpRoot));
		expect(testsDir('charcoal')).toBe(path.join(path.resolve(cpRoot), 'tests', 'charcoal'));
		expect(runnersFile()).toBe(path.join(path.resolve(cpRoot), 'runners.json'));
	});

	it('writes runners, cases, suites and runs under the content root', async () => {
		await cp.createRunner(runner);
		const created = await cp.createCase(testCase, 'kiran');
		await cp.createSuite(
			{ appId: 'charcoal', name: 'Split suite', description: undefined, caseIds: [created.id], defaultEnv: 'local', tags: [] },
			'kiran'
		);
		const runId = await cp.allocateRunId('charcoal');
		await cp.saveRun({
			id: runId,
			seq: 1,
			appId: 'charcoal',
			appCode: 'CHR',
			appName: 'Charcoal',
			suiteId: undefined,
			suiteName: undefined,
			environment: 'local',
			startedBy: 'kiran',
			startedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
			invocations: [],
			results: []
		});

		const root = path.resolve(cpRoot);
		expect(await exists(path.join(root, 'runners.json'))).toBe(true);
		expect(await exists(path.join(root, 'tests', 'charcoal', 'accounting.json'))).toBe(true);
		expect(await exists(path.join(root, 'tests', 'charcoal', '_sequence.json'))).toBe(true);
		expect(await exists(path.join(root, 'suites', 'charcoal.json'))).toBe(true);
		expect(await exists(path.join(root, 'runs', 'charcoal', `${runId}.json`))).toBe(true);

		// Nothing issue-tracker-shaped is written — Checkpoint owns no issues.
		for (const stray of ['issues', 'uploads']) {
			expect(await exists(path.join(root, stray))).toBe(false);
		}
	});

	it('reloads content from the root after reset', async () => {
		await cp.createCase(testCase, 'kiran');
		cp.__resetForTests();
		config.__resetForTests();
		await config.ensureLoaded();
		await cp.ensureLoaded();
		expect(cp.cases().map((c) => c.title)).toContain('Split-root case');
	});

	it('denormalises the app code/name from its own applications config', async () => {
		const created = await cp.createCase(testCase, 'kiran');
		expect(created.appCode).toBe('CHR');
		expect(created.appName).toBe('Charcoal');
	});
});
