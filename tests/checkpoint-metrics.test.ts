import { describe, expect, it } from 'vitest';
import type { Application, CaseResult, TestCase, TestRun, TestRunner } from '$lib/types';
import {
	coverageByModule,
	dashboardKpis,
	failingCases,
	passRatePct,
	runCounts,
	runnerHealth,
	untestedModules
} from '$lib/server/checkpoint/metrics';
import { failuresToJson, failuresToMarkdown } from '$lib/server/checkpoint/failuresExport';
import { resultToIssueInput } from '$lib/server/checkpoint/toIssue';

function tc(p: Partial<TestCase> & { id: string }): TestCase {
	return {
		uuid: 'u',
		seq: 1,
		appId: 'charcoal',
		appCode: 'CHR',
		appName: 'Charcoal',
		target: { moduleId: 'billing', moduleCode: 'BILL', moduleName: 'Billing' },
		title: 'T',
		steps: [],
		priority: 'high',
		status: 'active',
		tags: [],
		kind: 'api',
		runnerId: 'RNR-1',
		specPath: null,
		externalTestId: null,
		parentIssueId: null,
		suiteIds: [],
		issueIds: [],
		createdBy: 'kiran',
		createdAt: '',
		updatedAt: '',
		...p
	} as TestCase;
}

function res(testCaseId: string, status: CaseResult['status'], extra: Partial<CaseResult> = {}): CaseResult {
	return { testCaseId, runnerId: 'RNR-1', status, durationMs: 100, message: null, stack: null, artifacts: [], ...extra };
}

function run(p: Partial<TestRun> & { id: string; startedAt: string; results: CaseResult[] }): TestRun {
	return {
		seq: 1,
		appId: 'charcoal',
		appCode: 'CHR',
		appName: 'Charcoal',
		environment: 'staging',
		startedBy: 'kiran',
		invocations: [],
		...p
	} as TestRun;
}

const runner: TestRunner = {
	id: 'RNR-1',
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

describe('pass-rate math', () => {
	it('excludes blocked and skipped from the denominator', () => {
		expect(passRatePct(1, 1)).toBe(50);
		expect(passRatePct(3, 0)).toBe(100);
		expect(passRatePct(0, 0)).toBeNull();
		const r = run({
			id: 'RUN-CHR-1',
			startedAt: '2026-07-20T10:00:00Z',
			results: [res('a', 'pass'), res('b', 'fail'), res('c', 'blocked'), res('d', 'skipped')]
		});
		const c = runCounts(r);
		expect(c).toMatchObject({ pass: 1, fail: 1, blocked: 1, skipped: 1, total: 4 });
	});
});

describe('failing cases', () => {
	it('uses the most recent result per case', () => {
		const cases = [tc({ id: 'TC-CHR-1' }), tc({ id: 'TC-CHR-2' })];
		const runs = [
			run({ id: 'RUN-CHR-1', startedAt: '2026-07-19T10:00:00Z', results: [res('TC-CHR-1', 'fail')] }),
			run({ id: 'RUN-CHR-2', startedAt: '2026-07-20T10:00:00Z', results: [res('TC-CHR-1', 'pass'), res('TC-CHR-2', 'fail')] })
		];
		const failing = failingCases(cases, runs);
		expect(failing.map((f) => f.testCase.id)).toEqual(['TC-CHR-2']);
	});
});

describe('coverage', () => {
	const cases = [
		tc({ id: 'TC-CHR-1', kind: 'api' }),
		tc({ id: 'TC-CHR-2', kind: 'manual' }),
		tc({ id: 'TC-CHR-3', target: { moduleId: 'auth', moduleCode: 'AUTH', moduleName: 'Auth' }, kind: 'e2e' })
	];
	it('splits manual vs automated per module and reads the latest pass rate', () => {
		const runs = [
			run({ id: 'RUN-CHR-1', startedAt: '2026-07-20T10:00:00Z', results: [res('TC-CHR-1', 'pass'), res('TC-CHR-2', 'fail')] })
		];
		const cov = coverageByModule(cases, runs);
		const billing = cov.find((c) => c.moduleId === 'billing')!;
		expect(billing.manual).toBe(1);
		expect(billing.automated).toBe(1);
		expect(billing.latestPassRate).toBe(50); // 1 pass, 1 fail
	});

	it('lists modules with no active cases as untested', () => {
		const apps: Application[] = [
			{
				id: 'charcoal',
				code: 'CHR',
				name: 'Charcoal',
				modules: [
					{ id: 'billing', code: 'BILL', name: 'Billing', pages: [] },
					{ id: 'inventory', code: 'INV', name: 'Inventory', pages: [] }
				]
			}
		];
		const untested = untestedModules([tc({ id: 'TC-CHR-1' })], apps);
		expect(untested.map((u) => u.moduleName)).toEqual(['Inventory']);
	});
});

describe('runner health', () => {
	it('is bad after a failing invocation and warns on flake', () => {
		const bad = run({
			id: 'RUN-CHR-2',
			startedAt: '2026-07-20T10:00:00Z',
			invocations: [{ runnerId: 'RNR-1', command: 'x', workingDir: '.', exitCode: 1, startedAt: '2026-07-20T10:00:00Z', finishedAt: '2026-07-20T10:00:42Z', reportPath: 'r', parsedCount: 1, orphanCount: 0 }],
			results: [res('TC-CHR-1', 'fail')]
		});
		const h = runnerHealth(runner, [bad]);
		expect(h.health).toBe('bad');
		expect(h.avgDurationMs).toBe(42000);
		expect(h.consecutiveFailures).toBe(1);

		const flaky = run({
			id: 'RUN-CHR-3',
			startedAt: '2026-07-21T10:00:00Z',
			results: [res('TC-CHR-1', 'pass', { flaky: true })]
		});
		expect(runnerHealth(runner, [flaky]).health).toBe('warn');
		expect(runnerHealth(runner, []).health).toBe('idle');
	});
});

describe('dashboard KPIs', () => {
	it('aggregates recent pass rate, failing count and case split', () => {
		const cases = [tc({ id: 'TC-CHR-1', kind: 'api' }), tc({ id: 'TC-CHR-2', kind: 'manual' })];
		const runs = [
			run({ id: 'RUN-CHR-1', startedAt: '2026-07-22T09:00:00Z', results: [res('TC-CHR-1', 'fail'), res('TC-CHR-2', 'pass')] })
		];
		const k = dashboardKpis(cases, runs, [runner], new Date('2026-07-22T10:00:00Z'));
		expect(k.passRatePct).toBe(50);
		expect(k.failingCases).toBe(1);
		expect(k.totalCases).toBe(2);
		expect(k.automatedCases).toBe(1);
		expect(k.manualCases).toBe(1);
		expect(k.runsLast7Days).toBe(1);
	});
});

describe('failures → markdown / json', () => {
	const c = tc({
		id: 'TC-CHR-12',
		title: 'Tax computed on discounted subtotal',
		kind: 'api',
		specPath: 'tests/api/billing/test_tax.py',
		externalTestId: 'test_tax.py::test_discounted_subtotal',
		parentIssueId: 'CHR-15',
		preconditions: 'An invoice exists with a discounted line item.',
		steps: [{ action: 'POST /invoices with a 10% line discount', expected: 'tax is on the post-discount subtotal' }]
	});
	const result = res('TC-CHR-12', 'fail', { message: 'assert 1800 == 1620', stack: 'AssertionError: assert 1800.0 == 1620.0', artifacts: ['reports/api-junit.xml'] });
	const item = { testCase: c, result, runner, parentIssueTitle: 'Tax computed on pre-discount subtotal' };

	it('is self-sufficient: reproduce command, expected steps, actual error', () => {
		const md = failuresToMarkdown([item], { generatedAt: new Date('2026-07-22T10:00:00Z'), runId: 'RUN-CHR-59', environment: 'staging' });
		expect(md).toContain('## 1. `TC-CHR-12`');
		expect(md).toContain('cd services/api && pytest tests/api');
		expect(md).toContain('POST /invoices with a 10% line discount → _tax is on the post-discount subtotal_');
		expect(md).toContain('AssertionError: assert 1800.0 == 1620.0');
		expect(md).toContain('**Parent issue:** CHR-15 — Tax computed on pre-discount subtotal');
		expect(md).toContain('What I need back');
	});

	it('emits structured JSON for tooling', () => {
		const json = JSON.parse(failuresToJson([item], { generatedAt: new Date('2026-07-22T10:00:00Z') }));
		expect(json.failures[0].id).toBe('TC-CHR-12');
		expect(json.failures[0].runner.reproduce).toContain('pytest');
		expect(json.failures[0].parentIssue).toBe('CHR-15');
	});

	it('maps a failed result to an issue prefill', () => {
		const input = resultToIssueInput(c, result, run({ id: 'RUN-CHR-59', startedAt: '', results: [] }), runner);
		expect(input.type).toBe('bug');
		expect(input.appId).toBe('charcoal');
		expect(input.moduleId).toBe('billing');
		expect(input.priority).toBe('high');
		expect(input.description).toContain('Filed from test **TC-CHR-12**');
		expect(input.description).toContain('cd services/api && pytest');
		expect(input.tags).toContain('from-test');
	});
});
