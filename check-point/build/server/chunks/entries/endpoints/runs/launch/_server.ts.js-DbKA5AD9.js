import { e as ensureLoaded, v as getSuite, g as getCase, O as allocateRunId, s as saveRun, u as users, h as runners } from '../../../../chunks/checkpoint.js-B-fQV2Ix.js';
import { S as SUITE_ENVIRONMENTS } from '../../../../chunks/types.js-BxhiHiuh.js';
import { p as pendingManualResult } from '../../../../chunks/dispatch.js-BCwxfXMS.js';
import { p as planLaunch, e as executeRun } from '../../../../chunks/launch.js-CepkRNc9.js';
import { a as activeRunId, t as trackRun } from '../../../../chunks/runtime.js-BLT4IyOS.js';
import { v as error, j as json } from '../../../../chunks/utils.js-r4C_CEqs.js';
import '../../../../chunks/shared-server.js-9-2j12mp.js';
import 'node:fs/promises';
import 'uuid';
import 'node:path';
import 'zod';
import 'node:child_process';
import '../../../../chunks/shared.js-C8TgK89F.js';
import '../../../../chunks/server.js-CDtqtqwP.js';

//#region src/routes/runs/launch/+server.ts
function actor(cookies) {
	const id = cookies.get("checkpoint_user");
	return users().some((u) => u.id === id) ? id : users()[0]?.id ?? "system";
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
var POST = async ({ request, cookies }) => {
	await ensureLoaded();
	const body = await request.json().catch(() => ({}));
	const suiteId = String(body.suiteId ?? "");
	const environment = String(body.environment ?? "local");
	const kinds = Array.isArray(body.kinds) ? body.kinds.map(String) : [];
	if (!SUITE_ENVIRONMENTS.includes(environment)) error(400, `Unknown environment "${environment}"`);
	const suite = getSuite(suiteId);
	if (!suite) error(400, "Unknown suite");
	const plan = planLaunch(suite.caseIds.map((id) => getCase(id)).filter(Boolean), kinds, runners());
	if (plan.groups.length) {
		const busy = activeRunId();
		if (busy) error(409, `${busy} is still running — wait for it to finish before launching another run`);
	}
	const runId = await allocateRunId(suite.appId);
	const run = {
		id: runId,
		seq: Number(runId.split("-").at(-1)),
		appId: suite.appId,
		appCode: suite.appCode,
		appName: suite.appName,
		suiteId: suite.id,
		suiteName: suite.name,
		environment,
		startedBy: actor(cookies),
		startedAt: (/* @__PURE__ */ new Date()).toISOString(),
		invocations: [],
		results: [...plan.skipped, ...plan.manualCases.map((c) => pendingManualResult(c.id))]
	};
	if (!plan.groups.length && !plan.manualCases.length) run.completedAt = (/* @__PURE__ */ new Date()).toISOString();
	await saveRun(run);
	if (plan.groups.length) trackRun(runId, executeRun(run, plan, environment));
	return json({
		runId,
		running: plan.groups.length > 0,
		runners: plan.groups.map((g) => ({
			id: g.runner.id,
			name: g.runner.name,
			cases: g.cases.length
		}))
	});
};

export { POST };
//# sourceMappingURL=_server.ts.js-DbKA5AD9.js.map
