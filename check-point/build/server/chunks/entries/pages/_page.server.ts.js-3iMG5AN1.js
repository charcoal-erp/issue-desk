import { e as ensureLoaded, i as cases, j as runs, c as suites, h as runners } from '../../chunks/checkpoint.js-B-fQV2Ix.js';
import { f as formatDuration, t as timeAgo } from '../../chunks/meta.js-Drcdnnre.js';
import { d as dashboardKpis, r as recentRuns, a as runnerHealth, f as failingCases, c as coverageByModule } from '../../chunks/metrics.js-CTaKMGSY.js';

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

var _page_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-3iMG5AN1.js.map
