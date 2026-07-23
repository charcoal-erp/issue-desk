import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import { executeRun, pendingManualResult, planLaunch } from '$lib/server/checkpoint/launch';
import { activeRunId, trackRun } from '$lib/server/checkpoint/runtime';
import { SUITE_ENVIRONMENTS, type SuiteEnvironment, type TestCase, type TestRun } from '$lib/types';

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('issuedesk_user');
	return store.users().some((u) => u.id === id) ? id! : (store.users()[0]?.id ?? 'system');
}

/**
 * Launch a run (design §8). The run is created, its skipped and manual results
 * are recorded, and the response returns immediately — automated runners then
 * execute in the background, persisting after each invocation. Suites take
 * minutes to hours; holding the HTTP request open for that would tie the run
 * to one browser tab and to the proxy's patience.
 *
 * Only one automated run executes at a time: suites are mutually destructive
 * (one resets the database another's fixtures depend on), so a second launch
 * is refused rather than silently interleaved. Manual-only runs spawn nothing
 * and are never blocked.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	await cp.ensureLoaded();
	const body = await request.json().catch(() => ({}));
	const suiteId = String(body.suiteId ?? '');
	const environment = String(body.environment ?? 'local');
	const kinds: string[] = Array.isArray(body.kinds) ? body.kinds.map(String) : [];

	if (!(SUITE_ENVIRONMENTS as readonly string[]).includes(environment)) {
		error(400, `Unknown environment "${environment}"`);
	}
	const suite = cp.getSuite(suiteId);
	if (!suite) error(400, 'Unknown suite');

	const cases = suite.caseIds.map((id) => cp.getCase(id)).filter(Boolean) as TestCase[];
	const plan = planLaunch(cases, kinds, cp.runners());

	if (plan.groups.length) {
		const busy = activeRunId();
		if (busy) error(409, `${busy} is still running — wait for it to finish before launching another run`);
	}

	const runId = await cp.allocateRunId(suite.appId);
	const run: TestRun = {
		id: runId,
		seq: Number(runId.split('-').at(-1)),
		appId: suite.appId,
		appCode: suite.appCode,
		appName: suite.appName,
		suiteId: suite.id,
		suiteName: suite.name,
		environment: environment as SuiteEnvironment,
		startedBy: actor(cookies),
		startedAt: new Date().toISOString(),
		invocations: [],
		// Everything known before execution: unrunnable cases and the manual
		// checklist, so the run page is complete the moment it opens.
		results: [...plan.skipped, ...plan.manualCases.map((c) => pendingManualResult(c.id))]
	};
	if (!plan.groups.length && !plan.manualCases.length) run.completedAt = new Date().toISOString();
	await cp.saveRun(run);

	if (plan.groups.length) {
		trackRun(runId, executeRun(run, plan, environment));
	}

	return json({
		runId,
		running: plan.groups.length > 0,
		runners: plan.groups.map((g) => ({ id: g.runner.id, name: g.runner.name, cases: g.cases.length }))
	});
};
