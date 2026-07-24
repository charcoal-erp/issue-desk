// @ts-nocheck
import type { PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import {
	coverageByModule,
	dashboardKpis,
	failingCases,
	recentRuns,
	runnerHealth
} from '$lib/server/checkpoint/metrics';
import { formatDuration, timeAgo } from '$lib/checkpoint/meta';

export const load = async () => {
	await cp.ensureLoaded();
	const cases = cp.cases();
	const runs = cp.runs();
	const runners = cp.runners();
	const now = new Date();

	const kpis = dashboardKpis(cases, runs, runners, now);

	const recent = recentRuns(runs, 5).map(({ run, counts, passRate }) => ({
		id: run.id,
		label: run.id.split('-').at(-1) ?? run.id,
		pass: counts.pass,
		fail: counts.fail,
		passRate
	}));

	const health = runners.map((r) => {
		const h = runnerHealth(r, runs);
		return {
			id: r.id,
			name: r.name,
			kind: r.kind,
			command: r.command,
			status: h.health,
			flakeRatePct: h.flakeRatePct,
			avgLabel: formatDuration(h.avgDurationMs),
			last:
				h.lastOutcome && h.lastInvocationAt
					? `${h.lastOutcome} · ${timeAgo(h.lastInvocationAt, now)}`
					: 'no runs'
		};
	});

	const failing = failingCases(cases, runs).map((f) => ({
		id: f.testCase.id,
		title: f.testCase.title,
		appCode: f.testCase.appCode,
		specPath: f.testCase.specPath,
		moduleName: f.testCase.target.moduleName,
		kind: f.testCase.kind,
		status: f.result.status,
		parentIssueId: f.testCase.parentIssueId
	}));

	const coverage = coverageByModule(cases, runs);
	const suitesCount = cp.suites().length;

	const lastRun = runs[0];
	const subtitle = lastRun
		? `last run ${timeAgo(lastRun.startedAt, now)} · ${runners.length} runner${runners.length === 1 ? '' : 's'} configured`
		: `no runs yet · ${runners.length} runner${runners.length === 1 ? '' : 's'} configured`;

	return { kpis, recent, health, failing, coverage, suitesCount, subtitle };
};
;null as any as PageServerLoad;