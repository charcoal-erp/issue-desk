import { readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { seedDataDir } from '$lib/server/store/seed';
import { executeRun, planLaunch, resolveRunner, unrunnableKinds } from '$lib/server/checkpoint/launch';
import { dispatchRunner } from '$lib/server/checkpoint/dispatch';
import * as runtime from '$lib/server/checkpoint/runtime';
import { runFile } from '$lib/server/fs/paths';
import type { CreateRunnerInput, CreateTestCaseInput, TestCase, TestRun, TestRunner } from '$lib/types';

const dir = process.env.DATA_DIR!;

function runnerInput(over: Partial<CreateRunnerInput> = {}): CreateRunnerInput {
	return {
		name: 'Runner',
		kind: 'unit',
		language: 'bash',
		command: 'true',
		workingDir: '.',
		env: undefined,
		reportFormat: 'tap',
		reportPath: 'stdout',
		matchStrategy: { by: 'tapName' },
		timeoutSec: undefined,
		enabled: true,
		...over
	};
}

function caseInput(over: Partial<CreateTestCaseInput> = {}): CreateTestCaseInput {
	return {
		appId: 'charcoal',
		moduleId: 'accounting',
		page: '',
		form: '',
		title: 'A case',
		preconditions: undefined,
		steps: [],
		priority: 'medium',
		status: 'active',
		tags: [],
		kind: 'unit',
		runnerId: null,
		specPath: null,
		externalTestId: null,
		parentIssueId: null,
		suiteIds: [],
		...over
	};
}

/** A bare TestCase for the pure planner, without touching the store. */
function fakeCase(id: string, kind: TestCase['kind'], runnerId: string | null): TestCase {
	return {
		id,
		uuid: id,
		seq: 1,
		appId: 'charcoal',
		appCode: 'CHR',
		appName: 'Charcoal',
		target: { moduleId: 'accounting', moduleCode: 'ACCT', moduleName: 'Accounting' },
		title: id,
		steps: [],
		priority: 'medium',
		status: 'active',
		tags: [],
		kind,
		runnerId,
		specPath: null,
		externalTestId: null,
		parentIssueId: null,
		suiteIds: [],
		issueIds: [],
		createdBy: 'kiran',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	};
}

function fakeRunner(id: string, kind: TestRunner['kind'], enabled = true): TestRunner {
	return {
		id,
		name: id,
		kind,
		language: 'bash',
		command: `echo ${id}`,
		workingDir: '.',
		reportFormat: 'tap',
		reportPath: 'stdout',
		matchStrategy: { by: 'tapName' },
		enabled
	};
}

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	cp.__resetForTests();
	runtime.__resetForTests();
	await seedDataDir();
	await store.ensureLoaded();
	await cp.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('planLaunch', () => {
	const unitA = fakeRunner('RNR-1', 'unit');
	const unitB = fakeRunner('RNR-2', 'unit');
	const api = fakeRunner('RNR-3', 'api');

	it('groups by the runner each case names, not by kind', () => {
		const cases = [
			fakeCase('TC-1', 'unit', 'RNR-1'),
			fakeCase('TC-2', 'unit', 'RNR-2'),
			fakeCase('TC-3', 'unit', 'RNR-1')
		];
		const plan = planLaunch(cases, ['unit'], [unitA, unitB]);
		expect(plan.groups.map((g) => g.runner.id)).toEqual(['RNR-1', 'RNR-2']);
		expect(plan.groups[0].cases.map((c) => c.id)).toEqual(['TC-1', 'TC-3']);
		expect(plan.groups[1].cases.map((c) => c.id)).toEqual(['TC-2']);
		expect(plan.skipped).toEqual([]);
	});

	it('orders groups by where the suite first reaches each runner', () => {
		const cases = [fakeCase('TC-1', 'unit', 'RNR-2'), fakeCase('TC-2', 'unit', 'RNR-1')];
		const plan = planLaunch(cases, ['unit'], [unitA, unitB]);
		expect(plan.groups.map((g) => g.runner.id)).toEqual(['RNR-2', 'RNR-1']);
	});

	it('falls back to the first enabled runner of the kind when the named one cannot run', () => {
		const disabled = fakeRunner('RNR-9', 'unit', false);
		const runners = [disabled, unitA];
		expect(resolveRunner(fakeCase('TC-1', 'unit', 'RNR-9'), runners)?.id).toBe('RNR-1'); // disabled
		expect(resolveRunner(fakeCase('TC-2', 'unit', 'RNR-404'), runners)?.id).toBe('RNR-1'); // missing
		expect(resolveRunner(fakeCase('TC-3', 'unit', 'RNR-3'), [api, unitA])?.id).toBe('RNR-1'); // wrong kind
		expect(resolveRunner(fakeCase('TC-4', 'unit', null), runners)?.id).toBe('RNR-1'); // unassigned
	});

	it('excludes unticked kinds entirely and records skips only for participating ones', () => {
		const cases = [fakeCase('TC-1', 'unit', null), fakeCase('TC-2', 'api', null)];
		const plan = planLaunch(cases, ['unit'], [unitA]);
		expect(plan.groups).toHaveLength(1);
		expect(plan.skipped).toEqual([]); // the api case simply does not take part

		const both = planLaunch(cases, ['unit', 'api'], [unitA]);
		expect(both.skipped.map((r) => r.testCaseId)).toEqual(['TC-2']);
		expect(both.skipped[0].message).toBe('no api runner configured');
		expect(unrunnableKinds(both, cases)).toEqual([{ kind: 'api', count: 1 }]);
	});

	it('explains a skip caused by an unusable named runner', () => {
		const plan = planLaunch([fakeCase('TC-1', 'e2e', 'RNR-7')], ['e2e'], [unitA]);
		expect(plan.skipped[0].message).toBe('runner RNR-7 is not available for e2e cases');
	});

	it('separates manual cases from runner groups', () => {
		const cases = [fakeCase('TC-1', 'manual', null), fakeCase('TC-2', 'unit', null)];
		const plan = planLaunch(cases, ['manual', 'unit'], [unitA]);
		expect(plan.manualCases.map((c) => c.id)).toEqual(['TC-1']);
		expect(plan.groups).toHaveLength(1);
	});
});

describe('executeRun', () => {
	async function newRun(): Promise<TestRun> {
		const runId = await cp.allocateRunId('charcoal');
		const run: TestRun = {
			id: runId,
			seq: 1,
			appId: 'charcoal',
			appCode: 'CHR',
			appName: 'Charcoal',
			environment: 'local',
			startedBy: 'kiran',
			startedAt: new Date().toISOString(),
			invocations: [],
			results: []
		};
		await cp.saveRun(run);
		return run;
	}

	it('invokes every runner in the plan and completes the run', async () => {
		const r1 = await cp.createRunner(runnerInput({ name: 'One', command: "echo 'ok 1 - alpha'" }));
		const r2 = await cp.createRunner(runnerInput({ name: 'Two', command: "echo 'not ok 1 - beta'" }));
		const c1 = await cp.createCase(caseInput({ title: 'alpha', externalTestId: 'alpha', runnerId: r1.id }), 'kiran');
		const c2 = await cp.createCase(caseInput({ title: 'beta', externalTestId: 'beta', runnerId: r2.id }), 'kiran');

		const run = await newRun();
		const plan = planLaunch([c1, c2], ['unit'], cp.runners());
		await executeRun(run, plan, 'local');

		const saved = cp.getRun(run.id)!;
		expect(saved.invocations.map((i) => i.runnerId).sort()).toEqual([r1.id, r2.id].sort());
		expect(saved.results.find((r) => r.testCaseId === c1.id)?.status).toBe('pass');
		expect(saved.results.find((r) => r.testCaseId === c2.id)?.status).toBe('fail');
		expect(saved.completedAt).toBeTruthy();
	});

	it('persists after each invocation, so an interruption keeps what finished', async () => {
		const r1 = await cp.createRunner(runnerInput({ name: 'One', command: "echo 'ok 1 - alpha'" }));
		const r2 = await cp.createRunner(runnerInput({ name: 'Two', command: "echo 'ok 1 - beta'" }));
		const c1 = await cp.createCase(caseInput({ title: 'alpha', externalTestId: 'alpha', runnerId: r1.id }), 'kiran');
		const c2 = await cp.createCase(caseInput({ title: 'beta', externalTestId: 'beta', runnerId: r2.id }), 'kiran');

		const run = await newRun();
		const plan = planLaunch([c1, c2], ['unit'], cp.runners());
		// Stop after the first group, as a crash mid-run would.
		await executeRun(run, { ...plan, groups: [plan.groups[0]] }, 'local');

		const onDisk = JSON.parse(await readFile(runFile('charcoal', run.id), 'utf8')) as TestRun;
		expect(onDisk.invocations).toHaveLength(1);
		expect(onDisk.results.map((r) => r.testCaseId)).toEqual([c1.id]);
	});

	it('leaves the run open while manual cases are still pending', async () => {
		const r1 = await cp.createRunner(runnerInput({ command: "echo 'ok 1 - alpha'" }));
		const c1 = await cp.createCase(caseInput({ title: 'alpha', externalTestId: 'alpha', runnerId: r1.id }), 'kiran');
		const manual = await cp.createCase(caseInput({ title: 'by hand', kind: 'manual' }), 'kiran');

		const run = await newRun();
		const plan = planLaunch([c1, manual], ['unit', 'manual'], cp.runners());
		run.results.push({
			testCaseId: manual.id,
			runnerId: null,
			status: 'skipped',
			durationMs: null,
			message: null,
			stack: null,
			artifacts: [],
			notes: 'pending'
		});
		await executeRun(run, plan, 'local');
		expect(cp.getRun(run.id)!.completedAt).toBeUndefined();
	});
});

describe('run registry', () => {
	it('reports the active run and clears it when the work settles', async () => {
		expect(runtime.activeRunId()).toBeUndefined();
		let release: () => void;
		const work = new Promise<void>((r) => (release = r));
		runtime.trackRun('RUN-CHR-1', work);
		expect(runtime.activeRunId()).toBe('RUN-CHR-1');
		expect(runtime.isRunActive('RUN-CHR-1')).toBe(true);
		release!();
		await runtime.whenRunSettles('RUN-CHR-1');
		expect(runtime.activeRunId()).toBeUndefined();
	});

	it('clears the entry even when dispatch throws', async () => {
		runtime.trackRun('RUN-CHR-2', Promise.reject(new Error('boom')));
		await runtime.whenRunSettles('RUN-CHR-2');
		expect(runtime.isRunActive('RUN-CHR-2')).toBe(false);
	});
});

describe('dispatch process handling', () => {
	it('does not hang when the command leaves a grandchild holding stdio', async () => {
		const runner = await cp.createRunner(
			runnerInput({ name: 'Leaky', command: "(sleep 20 &) ; echo 'ok 1 - alpha'", timeoutSec: 30 })
		);
		const c = await cp.createCase(caseInput({ title: 'alpha', externalTestId: 'alpha' }), 'kiran');
		const started = Date.now();
		const { results } = await dispatchRunner('RUN-CHR-1', runner, [c], 'local');
		const elapsed = Date.now() - started;

		// `close` never fires while the orphan holds the pipe; the drain window
		// bounds the wait instead of blocking the run for the full 20s.
		expect(elapsed).toBeLessThan(8000);
		expect(results[0].status).toBe('pass');
	}, 20000);

	it('kills the whole process tree on timeout', async () => {
		const marker = path.join(tmpdir(), `cp-tick-${process.pid}-${Date.now()}`);
		const runner = await cp.createRunner(
			runnerInput({
				name: 'Runaway',
				// A backgrounded loop plus a long foreground wait: killing only the
				// shell would leave the loop writing to the marker forever.
				command: `( while true; do echo tick >> ${marker}; sleep 0.1; done ) & sleep 20`,
				timeoutSec: 1
			})
		);
		const c = await cp.createCase(caseInput({ title: 'alpha', externalTestId: 'alpha' }), 'kiran');

		const { invocation } = await dispatchRunner('RUN-CHR-1', runner, [c], 'local');
		expect(invocation.log).toContain('timed out');

		const sizeAt = async () => (await stat(marker).catch(() => ({ size: -1 }))).size;
		const afterKill = await sizeAt();
		await new Promise((r) => setTimeout(r, 800));
		expect(await sizeAt()).toBe(afterKill); // the grandchild stopped too
		await rm(marker, { force: true });
	}, 20000);
});
