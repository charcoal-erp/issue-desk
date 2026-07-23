import { access, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { seedDataDir } from '$lib/server/store/seed';
import { snapshotOnBoot } from '$lib/server/store/backup';
import { checkpointDataDir, dataDir, runnersFile, testsDir } from '$lib/server/fs/paths';
import type { CreateRunnerInput, CreateTestCaseInput } from '$lib/types';

const issueRoot = process.env.DATA_DIR!;
const cpRoot = '/tmp/issuedesk-vitest-checkpoint-data';

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

async function resetBoth() {
	await rm(issueRoot, { recursive: true, force: true });
	await rm(cpRoot, { recursive: true, force: true });
	store.__resetForTests();
	cp.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
	await cp.ensureLoaded();
}

describe('CHECKPOINT_DATA_DIR split root', () => {
	beforeEach(async () => {
		process.env.CHECKPOINT_DATA_DIR = cpRoot;
		await resetBoth();
	});

	afterAll(async () => {
		delete process.env.CHECKPOINT_DATA_DIR;
		await rm(issueRoot, { recursive: true, force: true });
		await rm(cpRoot, { recursive: true, force: true });
		store.__resetForTests();
		cp.__resetForTests();
	});

	it('path helpers root checkpoint content at the split dir, issue content at DATA_DIR', () => {
		expect(checkpointDataDir()).toBe(cpRoot);
		expect(dataDir()).toBe(path.resolve(issueRoot));
		expect(testsDir('charcoal')).toBe(path.join(cpRoot, 'tests', 'charcoal'));
		expect(runnersFile()).toBe(path.join(cpRoot, 'runners.json'));
	});

	it('falls back to DATA_DIR when the variable is unset', () => {
		delete process.env.CHECKPOINT_DATA_DIR;
		expect(checkpointDataDir()).toBe(path.resolve(issueRoot));
		process.env.CHECKPOINT_DATA_DIR = cpRoot;
	});

	it('writes runners, cases, suites and runs under the checkpoint root only', async () => {
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

		expect(await exists(path.join(cpRoot, 'runners.json'))).toBe(true);
		expect(await exists(path.join(cpRoot, 'tests', 'charcoal', 'accounting.json'))).toBe(true);
		expect(await exists(path.join(cpRoot, 'tests', 'charcoal', '_sequence.json'))).toBe(true);
		expect(await exists(path.join(cpRoot, 'suites', 'charcoal.json'))).toBe(true);
		expect(await exists(path.join(cpRoot, 'runs', 'charcoal', `${runId}.json`))).toBe(true);

		// Nothing Checkpoint-shaped leaks into the issue root…
		for (const stray of ['runners.json', 'tests', 'suites', 'runs', 'reports']) {
			expect(await exists(path.join(issueRoot, stray))).toBe(false);
		}
		// …and nothing issue-shaped leaks into the checkpoint root.
		for (const stray of ['config', 'issues', 'uploads']) {
			expect(await exists(path.join(cpRoot, stray))).toBe(false);
		}
	});

	it('issues keep writing to DATA_DIR while checkpoint content is split out', async () => {
		const issue = await store.create(
			{
				type: 'bug',
				title: 'Issue stays home',
				description: 'd',
				appId: 'charcoal',
				moduleId: 'accounting',
				page: undefined,
				form: undefined,
				priority: 'high',
				status: 'open',
				assigneeId: undefined,
				tags: [],
				attachments: []
			},
			'kiran'
		);
		expect(await exists(path.join(issueRoot, 'issues', 'charcoal', 'accounting.json'))).toBe(true);
		expect(await exists(path.join(cpRoot, 'issues'))).toBe(false);
		expect(issue.id).toBe('CHR-1');
	});

	it('reloads checkpoint content from the split root after reset', async () => {
		await cp.createCase(testCase, 'kiran');
		cp.__resetForTests();
		store.__resetForTests();
		await store.ensureLoaded();
		await cp.ensureLoaded();
		expect(cp.cases().map((c) => c.title)).toContain('Split-root case');
	});

	it('boot snapshots land in each root, covering only that root’s targets', async () => {
		await cp.createRunner(runner);
		await snapshotOnBoot();

		const issueSnaps = await readdir(path.join(issueRoot, '.backups'));
		expect(issueSnaps.length).toBe(1);
		const issueSnap = path.join(issueRoot, '.backups', issueSnaps[0]);
		expect(await exists(path.join(issueSnap, 'config'))).toBe(true);
		expect(await exists(path.join(issueSnap, 'runners.json'))).toBe(false);

		const cpSnaps = await readdir(path.join(cpRoot, '.backups'));
		expect(cpSnaps.length).toBe(1);
		const cpSnap = path.join(cpRoot, '.backups', cpSnaps[0]);
		expect(await exists(path.join(cpSnap, 'runners.json'))).toBe(true);
		expect(await exists(path.join(cpSnap, 'config'))).toBe(false);
	});
});
