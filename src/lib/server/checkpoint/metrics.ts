import type {
	Application,
	CaseResult,
	ResultStatus,
	TestCase,
	TestRun,
	TestRunner
} from '$lib/types';

/**
 * Read-time derivations for the dashboard, coverage and runner health
 * (design §14). Everything here is a pure function over the store's arrays so
 * it is trivially testable; nothing extra is persisted.
 */

export interface RunCounts {
	pass: number;
	fail: number;
	blocked: number;
	skipped: number;
	total: number;
}

export function runCounts(run: TestRun): RunCounts {
	const c: RunCounts = { pass: 0, fail: 0, blocked: 0, skipped: 0, total: run.results.length };
	for (const r of run.results) c[r.status]++;
	return c;
}

/** pass / (pass + fail) as an integer percent; null when the denominator is 0. */
export function passRatePct(pass: number, fail: number): number | null {
	const denom = pass + fail;
	return denom === 0 ? null : Math.round((pass / denom) * 100);
}

export function runPassRate(run: TestRun): number | null {
	const c = runCounts(run);
	return passRatePct(c.pass, c.fail);
}

// ---------- last result per case ----------
export interface CaseResultRef {
	run: TestRun;
	result: CaseResult;
}

/** caseId → results across runs, oldest run first. */
export function resultsByCaseFrom(runs: TestRun[]): Map<string, CaseResultRef[]> {
	const map = new Map<string, CaseResultRef[]>();
	for (const run of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
		for (const result of run.results) {
			let list = map.get(result.testCaseId);
			if (!list) map.set(result.testCaseId, (list = []));
			list.push({ run, result });
		}
	}
	return map;
}

export function lastResultOf(
	caseId: string,
	byCase: Map<string, CaseResultRef[]>
): CaseResultRef | undefined {
	const list = byCase.get(caseId);
	return list && list.length ? list[list.length - 1] : undefined;
}

export interface FailingCase {
	testCase: TestCase;
	result: CaseResult;
	run: TestRun;
}

/** Cases whose most recent result is a failure or a block (design "Failing now"). */
export function failingCases(cases: TestCase[], runs: TestRun[]): FailingCase[] {
	const byCase = resultsByCaseFrom(runs);
	const out: FailingCase[] = [];
	for (const c of cases) {
		const last = lastResultOf(c.id, byCase);
		if (last && (last.result.status === 'fail' || last.result.status === 'blocked')) {
			out.push({ testCase: c, result: last.result, run: last.run });
		}
	}
	return out;
}

// ---------- runner health ----------
export type Health = 'ok' | 'warn' | 'bad' | 'idle';

export interface RunnerHealth {
	runnerId: string;
	runCount: number;
	lastInvocationAt?: string;
	lastOutcome?: ResultStatus | 'error' | 'mixed';
	lastExitCode?: number | null;
	avgDurationMs: number | null;
	flakeRatePct: number;
	consecutiveFailures: number;
	health: Health;
}

function elapsedMs(startedAt: string, finishedAt?: string): number | null {
	if (!finishedAt) return null;
	return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
}

export function runnerHealth(runner: TestRunner, runs: TestRun[]): RunnerHealth {
	// Runs that involved this runner, newest first.
	const involved = runs
		.filter((r) => r.results.some((x) => x.runnerId === runner.id) || r.invocations.some((i) => i.runnerId === runner.id))
		.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

	const durations: number[] = [];
	let flakyRuns = 0;
	for (const run of involved) {
		const inv = run.invocations.find((i) => i.runnerId === runner.id);
		const el = inv ? elapsedMs(inv.startedAt, inv.finishedAt) : null;
		const results = run.results.filter((x) => x.runnerId === runner.id);
		const dur = el ?? (results.reduce((s, x) => s + (x.durationMs ?? 0), 0) || null);
		if (dur) durations.push(dur);
		if (results.some((x) => x.flaky)) flakyRuns++;
	}

	const avgDurationMs = durations.length
		? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
		: null;
	const flakeRatePct = involved.length ? Math.round((flakyRuns / involved.length) * 100) : 0;

	// Last outcome from the most recent involved run.
	let lastOutcome: RunnerHealth['lastOutcome'];
	let lastExitCode: number | null | undefined;
	const latest = involved[0];
	if (latest) {
		const inv = latest.invocations.find((i) => i.runnerId === runner.id);
		lastExitCode = inv?.exitCode ?? null;
		const rs = latest.results.filter((x) => x.runnerId === runner.id).map((x) => x.status);
		if (inv && inv.exitCode != null && inv.exitCode !== 0 && rs.every((s) => s === 'pass'))
			lastOutcome = 'error';
		else if (rs.includes('fail')) lastOutcome = 'fail';
		else if (rs.length && rs.every((s) => s === 'pass')) lastOutcome = 'pass';
		else if (rs.length) lastOutcome = 'mixed';
	}

	// Consecutive failing runs from the most recent backwards.
	let consecutiveFailures = 0;
	for (const run of involved) {
		const rs = run.results.filter((x) => x.runnerId === runner.id).map((x) => x.status);
		if (rs.includes('fail')) consecutiveFailures++;
		else break;
	}

	let health: Health = 'ok';
	if (!involved.length) health = 'idle';
	else if (lastOutcome === 'fail' || lastOutcome === 'error' || (lastExitCode != null && lastExitCode !== 0))
		health = 'bad';
	else if (flakeRatePct >= 5) health = 'warn';

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

// ---------- coverage ----------
export interface ModuleCoverage {
	appId: string;
	appCode: string;
	appName: string;
	moduleId: string;
	moduleName: string;
	manual: number;
	automated: number;
	latestPassRate: number | null;
}

export function coverageByModule(cases: TestCase[], runs: TestRun[]): ModuleCoverage[] {
	const active = cases.filter((c) => c.status === 'active');
	const byKey = new Map<string, ModuleCoverage>();
	for (const c of active) {
		const key = `${c.appId}/${c.target.moduleId}`;
		let cov = byKey.get(key);
		if (!cov) {
			byKey.set(
				key,
				(cov = {
					appId: c.appId,
					appCode: c.appCode,
					appName: c.appName,
					moduleId: c.target.moduleId,
					moduleName: c.target.moduleName,
					manual: 0,
					automated: 0,
					latestPassRate: null
				})
			);
		}
		if (c.kind === 'manual') cov.manual++;
		else cov.automated++;
	}
	// Latest pass rate = pass rate of the most recent run touching that module.
	const caseModule = new Map(cases.map((c) => [c.id, `${c.appId}/${c.target.moduleId}`]));
	const runsDesc = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	for (const [key, cov] of byKey) {
		for (const run of runsDesc) {
			const rs = run.results.filter((r) => caseModule.get(r.testCaseId) === key);
			if (rs.length) {
				const pass = rs.filter((r) => r.status === 'pass').length;
				const fail = rs.filter((r) => r.status === 'fail').length;
				cov.latestPassRate = passRatePct(pass, fail);
				break;
			}
		}
	}
	return [...byKey.values()].sort((a, b) =>
		a.appCode === b.appCode ? a.moduleName.localeCompare(b.moduleName) : a.appCode.localeCompare(b.appCode)
	);
}

/** Modules present in the taxonomy with zero active cases (design "Untested modules"). */
export function untestedModules(
	cases: TestCase[],
	applications: Application[]
): Array<{ appCode: string; appName: string; moduleName: string }> {
	const covered = new Set(
		cases.filter((c) => c.status === 'active').map((c) => `${c.appId}/${c.target.moduleId}`)
	);
	const out: Array<{ appCode: string; appName: string; moduleName: string }> = [];
	for (const app of applications) {
		for (const mod of app.modules) {
			if (!covered.has(`${app.id}/${mod.id}`)) {
				out.push({ appCode: app.code, appName: app.name, moduleName: mod.name });
			}
		}
	}
	return out;
}

// ---------- dashboard KPIs ----------
export interface DashboardKpis {
	passRatePct: number | null;
	passRateTrendPct: number | null;
	failingCases: number;
	failingAcrossApps: number;
	totalCases: number;
	automatedCases: number;
	manualCases: number;
	runsLast7Days: number;
	flakyRunners: number;
}

function windowPassRate(runs: TestRun[]): number | null {
	let pass = 0;
	let fail = 0;
	for (const run of runs) {
		const c = runCounts(run);
		pass += c.pass;
		fail += c.fail;
	}
	return passRatePct(pass, fail);
}

export function dashboardKpis(
	cases: TestCase[],
	runs: TestRun[],
	runners: TestRunner[],
	now: Date,
	windowSize = 5
): DashboardKpis {
	const runsDesc = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	const recent = runsDesc.slice(0, windowSize);
	const prior = runsDesc.slice(windowSize, windowSize * 2);
	const passRate = windowPassRate(recent);
	const priorRate = windowPassRate(prior);

	const active = cases.filter((c) => c.status === 'active');
	const failing = failingCases(cases, runs);
	const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

	return {
		passRatePct: passRate,
		passRateTrendPct: passRate != null && priorRate != null ? passRate - priorRate : null,
		failingCases: failing.length,
		failingAcrossApps: new Set(failing.map((f) => f.testCase.appId)).size,
		totalCases: active.length,
		automatedCases: active.filter((c) => c.kind !== 'manual').length,
		manualCases: active.filter((c) => c.kind === 'manual').length,
		runsLast7Days: runs.filter((r) => new Date(r.startedAt).getTime() >= weekAgo).length,
		flakyRunners: runners.filter((r) => runnerHealth(r, runs).flakeRatePct >= 5).length
	};
}

export interface RecentRun {
	run: TestRun;
	counts: RunCounts;
	passRate: number | null;
}

export function recentRuns(runs: TestRun[], n = 5): RecentRun[] {
	return [...runs]
		.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
		.slice(0, n)
		.reverse()
		.map((run) => ({ run, counts: runCounts(run), passRate: runPassRate(run) }));
}
