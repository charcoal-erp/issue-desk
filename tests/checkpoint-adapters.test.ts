import { describe, expect, it } from 'vitest';
import {
	parseJUnit,
	parsePlaywright,
	parsePytestJson,
	parseReport,
	parseTap,
	parseVitest
} from '$lib/server/checkpoint/report';
import { exitCodeResults, matchEntries, skippedResult } from '$lib/server/checkpoint/match';
import type { TestCase } from '$lib/types';

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

describe('junit-xml adapter', () => {
	const xml = `<testsuites><testsuite name="api">
    <testcase classname="tests.api.billing.test_tax" name="test_discounted_subtotal" time="0.82">
      <failure message="assert 1800.0 == 1620.0">tests/api/billing/test_tax.py:48: in test_discounted_subtotal</failure>
    </testcase>
    <testcase classname="tests.api.billing.test_tax" name="test_plain" time="0.10"/>
    <testcase classname="tests.api.auth.test_login" name="test_locked" time="0.05"><skipped/></testcase>
  </testsuite></testsuites>`;

	it('normalizes pass / fail / skipped with message and duration', () => {
		const e = parseJUnit(xml);
		expect(e).toHaveLength(3);
		expect(e[0].status).toBe('fail');
		expect(e[0].identifier).toBe('tests.api.billing.test_tax::test_discounted_subtotal');
		expect(e[0].message).toBe('assert 1800.0 == 1620.0');
		expect(e[0].durationMs).toBe(820);
		expect(e[1].status).toBe('pass');
		expect(e[2].status).toBe('skipped');
	});

	it('matches to a case by nodeid across path/dot forms', () => {
		const cases = [tc({ id: 'TC-CHR-12', externalTestId: 'test_tax.py::test_discounted_subtotal' })];
		const { results, orphans, missing } = matchEntries(parseJUnit(xml), cases, { by: 'nodeid' }, 'RNR-1');
		expect(results.find((r) => r.testCaseId === 'TC-CHR-12')?.status).toBe('fail');
		expect(orphans.length).toBe(2); // the two unmapped testcases
		expect(missing).toHaveLength(0);
	});

	it('is resilient to malformed XML', () => {
		expect(parseReport('junit-xml', '<not xml')).toEqual([]);
	});
});

describe('playwright-json adapter', () => {
	const json = JSON.stringify({
		suites: [
			{
				title: 'billing.spec.ts',
				specs: [
					{
						title: 'invoice pdf matches snapshot',
						tests: [
							{
								annotations: [{ type: 'checkpoint', description: 'TC-CHR-09' }],
								results: [
									{
										status: 'failed',
										duration: 2400,
										error: { message: 'Snapshot mismatch: 812 pixels differ', stack: 'at a.ts:3' },
										attachments: [{ name: 'diff', path: 'reports/diff.png' }]
									}
								]
							}
						]
					}
				]
			}
		]
	});

	it('normalizes the last attempt, artifacts and annotations', () => {
		const [e] = parsePlaywright(json);
		expect(e.status).toBe('fail');
		expect(e.durationMs).toBe(2400);
		expect(e.artifacts).toContain('reports/diff.png');
		expect(e.aliases).toContain('TC-CHR-09');
	});

	it('flags flaky when earlier attempts differ', () => {
		const flakyJson = JSON.stringify({
			suites: [
				{
					title: 's',
					specs: [{ title: 'retried', tests: [{ results: [{ status: 'failed' }, { status: 'passed' }] }] }]
				}
			]
		});
		const [e] = parsePlaywright(flakyJson);
		expect(e.status).toBe('pass');
		expect(e.flaky).toBe(true);
	});

	it('matches by annotation to the case id', () => {
		const cases = [tc({ id: 'TC-CHR-09', kind: 'visual' })];
		const { results } = matchEntries(parsePlaywright(json), cases, { by: 'annotation', tag: '@checkpoint' }, 'RNR-4');
		expect(results[0]?.testCaseId).toBe('TC-CHR-09');
		expect(results[0]?.status).toBe('fail');
	});
});

describe('vitest-json adapter', () => {
	const json = JSON.stringify({
		testResults: [
			{
				assertionResults: [
					{ fullName: 'cart adds a line item', title: 'adds a line item', status: 'passed', duration: 18 },
					{
						fullName: 'cart applies discount',
						title: 'applies discount',
						status: 'failed',
						duration: 22,
						failureMessages: ['Error: expected 90 got 100\n    at cart.test.ts:12']
					}
				]
			}
		]
	});

	it('normalizes assertion results by full test name', () => {
		const e = parseVitest(json);
		expect(e).toHaveLength(2);
		expect(e[1].status).toBe('fail');
		expect(e[1].message).toBe('Error: expected 90 got 100');
	});

	it('matches by full test name', () => {
		const cases = [tc({ id: 'TC-CHR-10', kind: 'unit', externalTestId: 'cart applies discount' })];
		const { results } = matchEntries(parseVitest(json), cases, { by: 'testName' }, 'RNR-3');
		expect(results[0]?.status).toBe('fail');
	});
});

describe('pytest-json adapter', () => {
	const json = JSON.stringify({
		tests: [
			{ nodeid: 'tests/api/test_x.py::test_ok', outcome: 'passed', duration: 0.03 },
			{ nodeid: 'tests/api/test_x.py::test_bad', outcome: 'failed', duration: 0.05, call: { longrepr: 'assert 1 == 2' } }
		]
	});

	it('normalizes by nodeid with duration in ms', () => {
		const e = parsePytestJson(json);
		expect(e[0].status).toBe('pass');
		expect(e[0].durationMs).toBe(30);
		expect(e[1].status).toBe('fail');
		expect(e[1].message).toBe('assert 1 == 2');
	});
});

describe('tap adapter', () => {
	const tap = `TAP version 13
1..3
ok 1 - smoke home page
not ok 2 - smoke checkout
  ---
  message: 'HTTP 500 on /checkout'
  ...
ok 3 - flaky path # SKIP unstable env`;

	it('reads ok / not ok / SKIP with YAML diagnostics', () => {
		const e = parseTap(tap);
		expect(e).toHaveLength(3);
		expect(e[0].status).toBe('pass');
		expect(e[1].status).toBe('fail');
		expect(e[1].message).toContain('HTTP 500');
		expect(e[2].status).toBe('skipped');
	});

	it('matches by TAP description', () => {
		const cases = [tc({ id: 'TC-CHR-06', kind: 'shell', externalTestId: 'smoke checkout' })];
		const { results } = matchEntries(parseTap(tap), cases, { by: 'tapName' }, 'RNR-5');
		expect(results[0]?.status).toBe('fail');
	});
});

describe('exit-code adapter + gaps', () => {
	it('synthesizes one result per mapped case', () => {
		const cases = [tc({ id: 'TC-CHR-06', kind: 'shell' }), tc({ id: 'TC-CHR-07', kind: 'shell' })];
		const pass = exitCodeResults(cases, 0, 'all good', 'RNR-5');
		expect(pass.every((r) => r.status === 'pass')).toBe(true);
		const fail = exitCodeResults(cases, 1, 'line1\nboom', 'RNR-5');
		expect(fail.every((r) => r.status === 'fail')).toBe(true);
		expect(fail[0].message).toBe('exit 1');
		expect(fail[0].stack).toContain('boom');
	});

	it('records a case with no report entry as skipped', () => {
		const orphanCase = tc({ id: 'TC-CHR-99', externalTestId: 'nope::never' });
		const { missing } = matchEntries([], [orphanCase], { by: 'nodeid' }, 'RNR-1');
		expect(missing).toHaveLength(1);
		const s = skippedResult(missing[0], 'RNR-1', 'not reported by API contract');
		expect(s.status).toBe('skipped');
		expect(s.message).toContain('not reported');
	});
});
