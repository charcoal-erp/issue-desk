//#region src/lib/server/checkpoint/metrics.ts
function runCounts(run) {
	const c = {
		pass: 0,
		fail: 0,
		blocked: 0,
		skipped: 0,
		total: run.results.length
	};
	for (const r of run.results) c[r.status]++;
	return c;
}
/** pass / (pass + fail) as an integer percent; null when the denominator is 0. */
function passRatePct(pass, fail) {
	const denom = pass + fail;
	return denom === 0 ? null : Math.round(pass / denom * 100);
}
function runPassRate(run) {
	const c = runCounts(run);
	return passRatePct(c.pass, c.fail);
}
/** caseId → results across runs, oldest run first. */
function resultsByCaseFrom(runs) {
	const map = /* @__PURE__ */ new Map();
	for (const run of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) for (const result of run.results) {
		let list = map.get(result.testCaseId);
		if (!list) map.set(result.testCaseId, list = []);
		list.push({
			run,
			result
		});
	}
	return map;
}
function lastResultOf(caseId, byCase) {
	const list = byCase.get(caseId);
	return list && list.length ? list[list.length - 1] : void 0;
}
/** Cases whose most recent result is a failure or a block (design "Failing now"). */
function failingCases(cases, runs) {
	const byCase = resultsByCaseFrom(runs);
	const out = [];
	for (const c of cases) {
		const last = lastResultOf(c.id, byCase);
		if (last && (last.result.status === "fail" || last.result.status === "blocked")) out.push({
			testCase: c,
			result: last.result,
			run: last.run
		});
	}
	return out;
}
function elapsedMs(startedAt, finishedAt) {
	if (!finishedAt) return null;
	return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
}
function runnerHealth(runner, runs) {
	const involved = runs.filter((r) => r.results.some((x) => x.runnerId === runner.id) || r.invocations.some((i) => i.runnerId === runner.id)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	const durations = [];
	let flakyRuns = 0;
	for (const run of involved) {
		const inv = run.invocations.find((i) => i.runnerId === runner.id);
		const el = inv ? elapsedMs(inv.startedAt, inv.finishedAt) : null;
		const results = run.results.filter((x) => x.runnerId === runner.id);
		const dur = el ?? (results.reduce((s, x) => s + (x.durationMs ?? 0), 0) || null);
		if (dur) durations.push(dur);
		if (results.some((x) => x.flaky)) flakyRuns++;
	}
	const avgDurationMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
	const flakeRatePct = involved.length ? Math.round(flakyRuns / involved.length * 100) : 0;
	let lastOutcome;
	let lastExitCode;
	const latest = involved[0];
	if (latest) {
		const inv = latest.invocations.find((i) => i.runnerId === runner.id);
		lastExitCode = inv?.exitCode ?? null;
		const rs = latest.results.filter((x) => x.runnerId === runner.id).map((x) => x.status);
		if (inv && inv.exitCode != null && inv.exitCode !== 0 && rs.every((s) => s === "pass")) lastOutcome = "error";
		else if (rs.includes("fail")) lastOutcome = "fail";
		else if (rs.length && rs.every((s) => s === "pass")) lastOutcome = "pass";
		else if (rs.length) lastOutcome = "mixed";
	}
	let consecutiveFailures = 0;
	for (const run of involved) if (run.results.filter((x) => x.runnerId === runner.id).map((x) => x.status).includes("fail")) consecutiveFailures++;
	else break;
	let health = "ok";
	if (!involved.length) health = "idle";
	else if (lastOutcome === "fail" || lastOutcome === "error" || lastExitCode != null && lastExitCode !== 0) health = "bad";
	else if (flakeRatePct >= 5) health = "warn";
	return {
		runnerId: runner.id,
		runCount: involved.length,
		lastInvocationAt: latest?.startedAt,
		lastOutcome,
		lastExitCode,
		avgDurationMs,
		flakeRatePct,
		consecutiveFailures,
		health
	};
}
function coverageByModule(cases, runs) {
	const active = cases.filter((c) => c.status === "active");
	const byKey = /* @__PURE__ */ new Map();
	for (const c of active) {
		const key = `${c.appId}/${c.target.moduleId}`;
		let cov = byKey.get(key);
		if (!cov) byKey.set(key, cov = {
			appId: c.appId,
			appCode: c.appCode,
			appName: c.appName,
			moduleId: c.target.moduleId,
			moduleName: c.target.moduleName,
			manual: 0,
			automated: 0,
			latestPassRate: null
		});
		if (c.kind === "manual") cov.manual++;
		else cov.automated++;
	}
	const caseModule = new Map(cases.map((c) => [c.id, `${c.appId}/${c.target.moduleId}`]));
	const runsDesc = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	for (const [key, cov] of byKey) for (const run of runsDesc) {
		const rs = run.results.filter((r) => caseModule.get(r.testCaseId) === key);
		if (rs.length) {
			const pass = rs.filter((r) => r.status === "pass").length;
			const fail = rs.filter((r) => r.status === "fail").length;
			cov.latestPassRate = passRatePct(pass, fail);
			break;
		}
	}
	return [...byKey.values()].sort((a, b) => a.appCode === b.appCode ? a.moduleName.localeCompare(b.moduleName) : a.appCode.localeCompare(b.appCode));
}
function windowPassRate(runs) {
	let pass = 0;
	let fail = 0;
	for (const run of runs) {
		const c = runCounts(run);
		pass += c.pass;
		fail += c.fail;
	}
	return passRatePct(pass, fail);
}
function dashboardKpis(cases, runs, runners, now, windowSize = 5) {
	const runsDesc = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	const recent = runsDesc.slice(0, windowSize);
	const prior = runsDesc.slice(windowSize, windowSize * 2);
	const passRate = windowPassRate(recent);
	const priorRate = windowPassRate(prior);
	const active = cases.filter((c) => c.status === "active");
	const failing = failingCases(cases, runs);
	const weekAgo = now.getTime() - 10080 * 60 * 1e3;
	return {
		passRatePct: passRate,
		passRateTrendPct: passRate != null && priorRate != null ? passRate - priorRate : null,
		failingCases: failing.length,
		failingAcrossApps: new Set(failing.map((f) => f.testCase.appId)).size,
		totalCases: active.length,
		automatedCases: active.filter((c) => c.kind !== "manual").length,
		manualCases: active.filter((c) => c.kind === "manual").length,
		runsLast7Days: runs.filter((r) => new Date(r.startedAt).getTime() >= weekAgo).length,
		flakyRunners: runners.filter((r) => runnerHealth(r, runs).flakeRatePct >= 5).length
	};
}
function recentRuns(runs, n = 5) {
	return [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, n).reverse().map((run) => ({
		run,
		counts: runCounts(run),
		passRate: runPassRate(run)
	}));
}
//#endregion
export { runCounts as a, recentRuns as i, dashboardKpis as n, runPassRate as o, failingCases as r, runnerHealth as s, coverageByModule as t };
