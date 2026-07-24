import type { RequestHandler } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as issuedesk from '$lib/server/issuedesk';
import {
	failuresToJson,
	failuresToMarkdown,
	trimLog,
	type FailureExportCtx,
	type FailureItem,
	type InvocationLog
} from '$lib/server/checkpoint/failuresExport';
import { failingCases } from '$lib/server/checkpoint/metrics';
import type { CaseResult, ResultStatus, TestCase, TestCaseStatus, TestKind, TestRun } from '$lib/types';
import { RESULT_STATUSES, TEST_CASE_STATUSES, TEST_KINDS } from '$lib/types';

function itemFor(c: TestCase, result: CaseResult): FailureItem {
	return {
		testCase: c,
		result,
		runner: c.runnerId ? (cp.runner(c.runnerId) ?? undefined) : undefined,
		// Resolved in a batch afterwards — see resolveParentTitles. Left null when
		// no IssueDesk is configured.
		parentIssueTitle: null
	};
}

/**
 * Fill in parent-issue titles from the central IssueDesk, resolving each unique
 * id once. A no-op (leaves them null) when no IssueDesk is configured.
 */
async function resolveParentTitles(items: FailureItem[]): Promise<void> {
	if (!issuedesk.isConfigured()) return;
	const ids = [...new Set(items.map((i) => i.testCase.parentIssueId).filter(Boolean) as string[])];
	const titles = new Map<string, string>();
	await Promise.all(
		ids.map(async (id) => {
			const ref = await issuedesk.getIssue(id);
			if (ref) titles.set(id, ref.title);
		})
	);
	for (const item of items) {
		const pid = item.testCase.parentIssueId;
		if (pid) item.parentIssueTitle = titles.get(pid) ?? null;
	}
}

/**
 * Console output for the invocations that matter: the ones that produced a
 * failing case, plus any that exited non-zero — a runner that died before
 * writing a report has no failing case to attach its log to, and that log is
 * usually the one worth reading.
 */
function logsFor(run: TestRun, items: FailureItem[]): InvocationLog[] {
	const failingRunners = new Set(items.map((i) => i.result.runnerId).filter(Boolean) as string[]);
	return run.invocations
		.filter((inv) => inv.log && (failingRunners.has(inv.runnerId) || (inv.exitCode ?? 0) !== 0))
		.map((inv) => {
			const { text, truncated } = trimLog(inv.log!);
			return {
				runnerId: inv.runnerId,
				runnerName: cp.runner(inv.runnerId)?.name ?? inv.runnerId,
				command: inv.command,
				workingDir: inv.workingDir,
				exitCode: inv.exitCode,
				log: text,
				truncated
			};
		});
}

function failuresOf(run: TestRun): FailureItem[] {
	return run.results
		.filter((r) => r.status === 'fail' || r.status === 'blocked')
		.map((r) => {
			const c = cp.getCase(r.testCaseId);
			return c ? itemFor(c, r) : null;
		})
		.filter(Boolean) as FailureItem[];
}

/** GET /api/export/failures?scope=all|run|suite|case|filter&format=md|json */
export const GET: RequestHandler = async ({ url }) => {
	await cp.ensureLoaded();
	const scope = url.searchParams.get('scope') ?? 'all';
	const format = url.searchParams.get('format') === 'json' ? 'json' : 'md';
	const ctx: FailureExportCtx = { generatedAt: new Date() };
	let items: FailureItem[] = [];

	if (scope === 'run' || scope === 'suite') {
		// A suite's failures are its most recent run's failures — asking for "the
		// suite" means the state it is in now, not every failure it ever had.
		const run =
			scope === 'run'
				? cp.getRun(url.searchParams.get('runId') ?? '')
				: cp.runs().find((r) => r.suiteId === url.searchParams.get('suiteId'));
		if (run) {
			ctx.runId = run.id;
			ctx.suiteName = run.suiteName;
			ctx.environment = run.environment;
			items = failuresOf(run);
			ctx.logs = logsFor(run, items);
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

	await resolveParentTitles(items);

	const body = format === 'json' ? failuresToJson(items, ctx) : failuresToMarkdown(items, ctx);
	return new Response(body, {
		headers: { 'content-type': format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8' }
	});
};
