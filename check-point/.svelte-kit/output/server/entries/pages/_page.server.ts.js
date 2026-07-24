import { E as runs, T as runners, k as suites, p as ensureLoaded, r as cases } from "../../chunks/checkpoint.js";
import { l as timeAgo, o as formatDuration } from "../../chunks/meta.js";
import { i as recentRuns, n as dashboardKpis, r as failingCases, s as runnerHealth, t as coverageByModule } from "../../chunks/metrics.js";
//#region src/routes/+page.server.ts
var load = async () => {
	await ensureLoaded();
	const cases$1 = cases();
	const runs$1 = runs();
	const runners$1 = runners();
	const now = /* @__PURE__ */ new Date();
	const kpis = dashboardKpis(cases$1, runs$1, runners$1, now);
	const recent = recentRuns(runs$1, 5).map(({ run, counts, passRate }) => ({
		id: run.id,
		label: run.id.split("-").at(-1) ?? run.id,
		pass: counts.pass,
		fail: counts.fail,
		passRate
	}));
	const health = runners$1.map((r) => {
		const h = runnerHealth(r, runs$1);
		return {
			id: r.id,
			name: r.name,
			kind: r.kind,
			command: r.command,
			status: h.health,
			flakeRatePct: h.flakeRatePct,
			avgLabel: formatDuration(h.avgDurationMs),
			last: h.lastOutcome && h.lastInvocationAt ? `${h.lastOutcome} · ${timeAgo(h.lastInvocationAt, now)}` : "no runs"
		};
	});
	const failing = failingCases(cases$1, runs$1).map((f) => ({
		id: f.testCase.id,
		title: f.testCase.title,
		appCode: f.testCase.appCode,
		specPath: f.testCase.specPath,
		moduleName: f.testCase.target.moduleName,
		kind: f.testCase.kind,
		status: f.result.status,
		parentIssueId: f.testCase.parentIssueId
	}));
	const coverage = coverageByModule(cases$1, runs$1);
	const suitesCount = suites().length;
	const lastRun = runs$1[0];
	return {
		kpis,
		recent,
		health,
		failing,
		coverage,
		suitesCount,
		subtitle: lastRun ? `last run ${timeAgo(lastRun.startedAt, now)} · ${runners$1.length} runner${runners$1.length === 1 ? "" : "s"} configured` : `no runs yet · ${runners$1.length} runner${runners$1.length === 1 ? "" : "s"} configured`
	};
};
//#endregion
export { load };
