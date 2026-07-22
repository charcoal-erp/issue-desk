import type { RequestHandler } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import {
	failuresToJson,
	failuresToMarkdown,
	type FailureExportCtx,
	type FailureItem
} from '$lib/server/checkpoint/failuresExport';
import { failingCases } from '$lib/server/checkpoint/metrics';
import type { CaseResult, ResultStatus, TestCase, TestCaseStatus, TestKind } from '$lib/types';
import { RESULT_STATUSES, TEST_CASE_STATUSES, TEST_KINDS } from '$lib/types';

function itemFor(c: TestCase, result: CaseResult): FailureItem {
	return {
		testCase: c,
		result,
		runner: c.runnerId ? (cp.runner(c.runnerId) ?? undefined) : undefined,
		parentIssueTitle: c.parentIssueId ? (store.get(c.parentIssueId)?.title ?? null) : null
	};
}

/** GET /qa/api/export/failures?scope=all|run|case|filter&format=md|json */
export const GET: RequestHandler = async ({ url }) => {
	await cp.ensureLoaded();
	const scope = url.searchParams.get('scope') ?? 'all';
	const format = url.searchParams.get('format') === 'json' ? 'json' : 'md';
	const ctx: FailureExportCtx = { generatedAt: new Date() };
	let items: FailureItem[] = [];

	if (scope === 'run') {
		const run = cp.getRun(url.searchParams.get('runId') ?? '');
		if (run) {
			ctx.runId = run.id;
			ctx.suiteName = run.suiteName;
			ctx.environment = run.environment;
			items = run.results
				.filter((r) => r.status === 'fail' || r.status === 'blocked')
				.map((r) => {
					const c = cp.getCase(r.testCaseId);
					return c ? itemFor(c, r) : null;
				})
				.filter(Boolean) as FailureItem[];
		}
	} else if (scope === 'case') {
		const c = cp.getCase(url.searchParams.get('caseId') ?? '');
		const last = c ? cp.lastResultForCase(c.id) : undefined;
		if (c && last && (last.result.status === 'fail' || last.result.status === 'blocked')) {
			ctx.environment = last.run.environment;
			items = [itemFor(c, last.result)];
		}
	} else if (scope === 'filter') {
		const params = new URLSearchParams(url.searchParams.get('filter') ?? '');
		const kind = params.getAll('kind').filter((k): k is TestKind => (TEST_KINDS as readonly string[]).includes(k));
		const status = params.getAll('status').filter((s): s is TestCaseStatus => (TEST_CASE_STATUSES as readonly string[]).includes(s));
		const result = params
			.getAll('result')
			.filter((r): r is ResultStatus | 'none' => r === 'none' || (RESULT_STATUSES as readonly string[]).includes(r));
		const cases = cp.listCases({
			q: params.get('q') ?? undefined,
			appId: params.get('app') ?? undefined,
			kind: kind.length ? kind : undefined,
			status: status.length ? status : undefined,
			lastResult: result.length ? result : undefined
		});
		for (const c of cases) {
			const last = cp.lastResultForCase(c.id);
			if (last && (last.result.status === 'fail' || last.result.status === 'blocked')) items.push(itemFor(c, last.result));
		}
	} else {
		items = failingCases(cp.cases(), cp.runs()).map((f) => itemFor(f.testCase, f.result));
	}

	const body = format === 'json' ? failuresToJson(items, ctx) : failuresToMarkdown(items, ctx);
	return new Response(body, {
		headers: { 'content-type': format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8' }
	});
};
