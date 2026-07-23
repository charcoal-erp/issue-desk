import { describe, expect, it } from 'vitest';
import {
	failuresToJson,
	failuresToMarkdown,
	trimLog,
	type FailureExportCtx,
	type FailureItem,
	type InvocationLog
} from '$lib/server/checkpoint/failuresExport';
import type { CaseResult, TestCase } from '$lib/types';

function testCase(over: Partial<TestCase> = {}): TestCase {
	return {
		id: 'TC-CHR-1',
		seq: 1,
		appId: 'charcoal',
		appCode: 'CHR',
		appName: 'Charcoal',
		target: { moduleId: 'accounting', moduleName: 'Accounting', pageName: 'Invoice', formName: null },
		title: 'Tax computed on discounted subtotal',
		preconditions: 'An invoice exists',
		steps: [{ action: 'POST /invoices', expected: 'tax on post-discount subtotal' }],
		priority: 'critical',
		status: 'active',
		tags: [],
		kind: 'api',
		runnerId: 'RNR-1',
		specPath: 'tests/api/test_tax.py',
		externalTestId: null,
		parentIssueId: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...over
	} as TestCase;
}

function result(over: Partial<CaseResult> = {}): CaseResult {
	return {
		testCaseId: 'TC-CHR-1',
		runnerId: 'RNR-1',
		status: 'fail',
		durationMs: 120,
		message: 'AssertionError: 118.80 != 120.00',
		stack: 'test_tax.py:41 in test_discounted',
		artifacts: [],
		...over
	};
}

const log = (over: Partial<InvocationLog> = {}): InvocationLog => ({
	runnerId: 'RNR-1',
	runnerName: 'accounting · unit tier',
	command: 'npm run test:unit',
	workingDir: 'charcoal/backends',
	exitCode: 1,
	log: 'ECONNREFUSED 127.0.0.1:2001',
	truncated: false,
	...over
});

const ctx = (over: Partial<FailureExportCtx> = {}): FailureExportCtx => ({
	generatedAt: new Date('2026-07-23T10:00:00Z'),
	...over
});

const items: FailureItem[] = [{ testCase: testCase(), result: result() }];

describe('trimLog', () => {
	it('keeps a short log whole and does not flag it truncated', () => {
		const { text, truncated } = trimLog('one\ntwo\nthree');
		expect(text).toBe('one\ntwo\nthree');
		expect(truncated).toBe(false);
	});

	it('keeps the tail of a long log, where the failure surfaces', () => {
		const raw = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
		const { text, truncated } = trimLog(raw);
		expect(truncated).toBe(true);
		expect(text.endsWith('line 499')).toBe(true);
		expect(text).not.toContain('line 0\n');
		expect(text.split('\n')).toHaveLength(120);
	});

	it('caps a single enormous line by characters', () => {
		const { text, truncated } = trimLog('x'.repeat(50_000));
		expect(truncated).toBe(true);
		expect(text.length).toBe(12_000);
	});
});

describe('failure prompt', () => {
	it('carries the runner output when there is any', () => {
		const md = failuresToMarkdown(items, ctx({ logs: [log()] }));
		expect(md).toContain('# Runner output');
		expect(md).toContain('ECONNREFUSED 127.0.0.1:2001');
		expect(md).toContain('**Exit code:** 1');
		expect(md).toContain('`RNR-1` — accounting · unit tier');
	});

	it('omits the whole section when no logs were captured', () => {
		const md = failuresToMarkdown(items, ctx());
		expect(md).not.toContain('# Runner output');
	});

	it('says so when a log was cut, so a missing first error is not a mystery', () => {
		const md = failuresToMarkdown(items, ctx({ logs: [log({ truncated: true })] }));
		expect(md).toMatch(/Last 120 lines; earlier output omitted/);
	});

	it('emits one log per invocation, not one per failure sharing it', () => {
		const many = Array.from({ length: 5 }, (_, i) => ({
			testCase: testCase({ id: `TC-CHR-${i}` }),
			result: result({ testCaseId: `TC-CHR-${i}` })
		}));
		const md = failuresToMarkdown(many, ctx({ logs: [log()] }));
		expect(md.match(/ECONNREFUSED/g)).toHaveLength(1);
		expect(md.match(/^## \d+\. /gm)).toHaveLength(5);
	});

	it('puts the logs in the JSON form too', () => {
		const doc = JSON.parse(failuresToJson(items, ctx({ logs: [log()] })));
		expect(doc.runnerLogs).toHaveLength(1);
		expect(doc.runnerLogs[0]).toMatchObject({ runnerId: 'RNR-1', exitCode: 1, truncated: false });
		expect(doc.runnerLogs[0].log).toContain('ECONNREFUSED');
	});

	it('still names the suite and run it came from', () => {
		const md = failuresToMarkdown(items, ctx({ runId: 'RUN-CHR-9', suiteName: 'Backends unit', environment: 'local' }));
		expect(md).toContain('run RUN-CHR-9');
		expect(md).toContain('suite Backends unit');
	});
});
