import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('issuedesk_user');
	return store.users().some((u) => u.id === id) ? id! : (store.users()[0]?.id ?? 'system');
}
import { runCounts, runPassRate } from '$lib/server/checkpoint/metrics';
import { PENDING_NOTE } from '$lib/server/checkpoint/dispatch';
import { isRunActive } from '$lib/server/checkpoint/runtime';
import { resultToIssueInput } from '$lib/server/checkpoint/toIssue';
import { timeAgo } from '$lib/checkpoint/meta';
import { RESULT_STATUSES, type CaseResult, type ResultStatus, type TestKind } from '$lib/types';

function enrich(r: CaseResult) {
	const c = cp.getCase(r.testCaseId);
	return {
		testCaseId: r.testCaseId,
		title: c?.title ?? r.testCaseId,
		kind: (c?.kind ?? 'manual') as TestKind,
		specPath: c?.specPath ?? null,
		status: r.status,
		durationMs: r.durationMs,
		message: r.message,
		stack: r.stack,
		artifacts: r.artifacts,
		pending: r.notes === PENDING_NOTE,
		issueId: r.issueId ?? null
	};
}

export const load: PageServerLoad = async ({ params }) => {
	await cp.ensureLoaded();
	const run = cp.getRun(params.runId);
	if (!run) error(404, `Run ${params.runId} not found`);
	const now = new Date();
	const userName = (id: string) => store.users().find((u) => u.id === id)?.name ?? id;

	// One group per automated runner invocation.
	const groups = run.invocations.map((inv) => {
		const runner = cp.runner(inv.runnerId);
		const rows = run.results.filter((r) => r.runnerId === inv.runnerId).map(enrich);
		return {
			runnerId: inv.runnerId,
			name: runner?.name ?? inv.runnerId,
			kind: (runner?.kind ?? 'unit') as TestKind,
			command: inv.command,
			reportFormat: runner?.reportFormat ?? null,
			exitCode: inv.exitCode,
			pass: rows.filter((r) => r.status === 'pass').length,
			fail: rows.filter((r) => r.status === 'fail').length,
			rows
		};
	});

	// Manual + unrun cases (no runner invocation).
	const manualRows = run.results.filter((r) => r.runnerId === null).map(enrich);

	const failingCount = run.results.filter((r) => r.status === 'fail' || r.status === 'blocked').length;

	/**
	 * A run without `completedAt` is running, waiting on a person, or was
	 * interrupted by a restart — only the live registry can tell them apart,
	 * and conflating them is how runs sit "in progress" forever.
	 */
	const pendingManual = run.results.some((r) => r.notes === PENDING_NOTE);
	const state = run.completedAt
		? 'complete'
		: isRunActive(run.id)
			? 'running'
			: pendingManual
				? 'awaiting-manual'
				: 'interrupted';

	return {
		run: {
			id: run.id,
			suiteName: run.suiteName ?? 'Ad-hoc run',
			environment: run.environment,
			by: userName(run.startedBy),
			when: timeAgo(run.startedAt, now),
			counts: runCounts(run),
			passRate: runPassRate(run),
			completed: !!run.completedAt,
			state
		},
		groups,
		manualRows,
		failingCount
	};
};

export const actions: Actions = {
	recordResult: async ({ request, params }) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const caseId = String(form.get('caseId') || '');
		const status = String(form.get('status') || '') as ResultStatus;
		if (!(RESULT_STATUSES as readonly string[]).includes(status)) {
			return fail(400, { error: 'Unknown result status' });
		}
		const notes = String(form.get('notes') || '') || undefined;
		try {
			await cp.recordResult(params.runId, {
				testCaseId: caseId,
				runnerId: null,
				status,
				durationMs: null,
				message: null,
				stack: null,
				artifacts: [],
				notes
			});
			// Auto-complete once nothing is pending.
			const run = cp.getRun(params.runId);
			if (run && !run.results.some((r) => r.notes === PENDING_NOTE)) await cp.completeRun(params.runId);
			return { ok: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	completeRun: async ({ params }) => {
		await cp.ensureLoaded();
		try {
			await cp.completeRun(params.runId);
			return { ok: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	// Fail → bug: create an IssueDesk issue prefilled from the failed result and
	// link both sides (design §13).
	createBugFromResult: async ({ request, cookies, params }) => {
		await cp.ensureLoaded();
		await store.ensureLoaded();
		const form = await request.formData();
		const caseId = String(form.get('caseId') || '');
		const c = cp.getCase(caseId);
		const run = cp.getRun(params.runId);
		const result = run?.results.find((r) => r.testCaseId === caseId);
		if (!c || !run || !result) return fail(400, { error: 'Result not found' });
		try {
			const runner = c.runnerId ? cp.runner(c.runnerId) : undefined;
			const input = { ...resultToIssueInput(c, result, run, runner), testCaseId: c.id, runId: run.id };
			const issue = await store.create(input, actor(cookies));
			await cp.recordResult(run.id, { ...result, issueId: issue.id });
			await cp.addFiledIssueToCase(c.id, issue.id);
			return { issueId: issue.id };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	}
};
