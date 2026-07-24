import { s as saveRun } from './checkpoint.js-B-fQV2Ix.js';
import { d as dispatchRunner } from './dispatch.js-BCwxfXMS.js';

//#region src/lib/server/checkpoint/launch.ts
/**
* Which runner executes this case: the one it names, when that runner exists,
* is enabled and matches the case's kind — otherwise the first enabled runner
* of that kind. The UI previews use this same function so the execution plan a
* person sees cannot diverge from what the launch actually does.
*/
function resolveRunner(c, runners) {
	if (c.runnerId) {
		const own = runners.find((r) => r.id === c.runnerId);
		if (own?.enabled && own.kind === c.kind) return own;
	}
	return runners.find((r) => r.kind === c.kind && r.enabled);
}
function noRunnerResult(c) {
	return {
		testCaseId: c.id,
		runnerId: null,
		status: "skipped",
		durationMs: null,
		message: c.runnerId ? `runner ${c.runnerId} is not available for ${c.kind} cases` : `no ${c.kind} runner configured`,
		stack: null,
		artifacts: []
	};
}
/** Pure: what a launch would do, given the suite's cases and the runner catalogue. */
function planLaunch(cases, kinds, runners) {
	const groups = /* @__PURE__ */ new Map();
	const skipped = [];
	const manualCases = [];
	for (const c of cases) {
		if (!kinds.includes(c.kind)) continue;
		if (c.kind === "manual") {
			manualCases.push(c);
			continue;
		}
		const runner = resolveRunner(c, runners);
		if (!runner) {
			skipped.push(noRunnerResult(c));
			continue;
		}
		const group = groups.get(runner.id);
		if (group) group.cases.push(c);
		else groups.set(runner.id, {
			runner,
			cases: [c]
		});
	}
	return {
		groups: [...groups.values()],
		skipped,
		manualCases
	};
}
/** Kinds that have no runner, for the launch preview's warning rows. */
function unrunnableKinds(plan, cases) {
	const byKind = /* @__PURE__ */ new Map();
	for (const r of plan.skipped) {
		const kind = cases.find((c) => c.id === r.testCaseId)?.kind;
		if (kind) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
	}
	return [...byKind].map(([kind, count]) => ({
		kind,
		count
	}));
}
function errorResults(group, e) {
	return group.cases.map((c) => ({
		testCaseId: c.id,
		runnerId: group.runner.id,
		status: "fail",
		durationMs: null,
		message: `runner did not complete: ${e.message}`,
		stack: null,
		artifacts: []
	}));
}
/**
* Execute the plan's groups sequentially, persisting after every invocation so
* a crash or restart leaves an honest partial record rather than nothing.
* Completion is claimed only when no manual case is still pending.
*/
async function executeRun(run, plan, environment) {
	for (const group of plan.groups) {
		try {
			const { invocation, results } = await dispatchRunner(run.id, group.runner, group.cases, environment);
			run.invocations.push(invocation);
			run.results.push(...results);
		} catch (e) {
			run.results.push(...errorResults(group, e));
		}
		await saveRun({ ...run });
	}
	if (!run.results.some((r) => r.notes === "pending")) run.completedAt = (/* @__PURE__ */ new Date()).toISOString();
	await saveRun({ ...run });
}

export { executeRun as e, planLaunch as p, unrunnableKinds as u };
//# sourceMappingURL=launch.js-CepkRNc9.js.map
