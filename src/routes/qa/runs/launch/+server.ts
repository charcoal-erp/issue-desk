import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import { dispatchRunner, pendingManualResult } from '$lib/server/checkpoint/dispatch';
import type { CaseResult, SuiteEnvironment, TestCase, TestRun } from '$lib/types';

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('issuedesk_user');
	return store.users().some((u) => u.id === id) ? id! : (store.users()[0]?.id ?? 'system');
}

/**
 * Launch a run (design §8): create the TestRun, dispatch each participating
 * automated runner sequentially and ingest its report, and leave manual cases
 * pending for a person. Returns the new run id for the client to navigate to.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	await cp.ensureLoaded();
	const body = await request.json().catch(() => ({}));
	const suiteId = String(body.suiteId ?? '');
	const environment = (String(body.environment ?? 'local')) as SuiteEnvironment;
	const kinds: string[] = Array.isArray(body.kinds) ? body.kinds.map(String) : [];

	const suite = cp.getSuite(suiteId);
	if (!suite) error(400, 'Unknown suite');

	const cases = suite.caseIds.map((id) => cp.getCase(id)).filter(Boolean) as TestCase[];
	const runId = await cp.allocateRunId(suite.appId);
	const run: TestRun = {
		id: runId,
		seq: Number(runId.split('-').at(-1)),
		appId: suite.appId,
		appCode: suite.appCode,
		appName: suite.appName,
		suiteId: suite.id,
		suiteName: suite.name,
		environment,
		startedBy: actor(cookies),
		startedAt: new Date().toISOString(),
		invocations: [],
		results: []
	};
	await cp.saveRun(run);

	// One automated runner per participating non-manual kind present in the suite.
	const suiteKinds = [...new Set(cases.map((c) => c.kind))];
	for (const kind of suiteKinds) {
		if (kind === 'manual' || !kinds.includes(kind)) continue;
		const kindCases = cases.filter((c) => c.kind === kind);
		const runner = cp.runners().find((r) => r.kind === kind && r.enabled);
		if (!runner) {
			run.results.push(
				...kindCases.map(
					(c): CaseResult => ({
						testCaseId: c.id,
						runnerId: null,
						status: 'skipped',
						durationMs: null,
						message: `no ${kind} runner configured`,
						stack: null,
						artifacts: []
					})
				)
			);
			continue;
		}
		const { invocation, results } = await dispatchRunner(runId, runner, kindCases, environment);
		run.invocations.push(invocation);
		run.results.push(...results);
		await cp.saveRun({ ...run });
	}

	// Manual cases become a pending checklist.
	if (kinds.includes('manual')) {
		for (const c of cases.filter((c) => c.kind === 'manual')) run.results.push(pendingManualResult(c.id));
	}

	if (!run.results.some((r) => r.notes === 'pending')) run.completedAt = new Date().toISOString();
	await cp.saveRun(run);

	return json({ runId });
};
