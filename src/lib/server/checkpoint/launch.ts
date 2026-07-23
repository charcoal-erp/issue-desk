import type { CaseResult, TestCase, TestKind, TestRun, TestRunner } from '$lib/types';
import * as cp from '../store/checkpoint';
import { PENDING_NOTE, dispatchRunner, pendingManualResult } from './dispatch';

/**
 * Planning and executing a run (design §8).
 *
 * Cases are grouped by the runner that will execute them — not by kind. A
 * platform has many runners of the same kind (a unit runner per module, an API
 * runner per topology), and a suite that spans two of them must invoke both;
 * one-runner-per-kind would silently run the wrong one and skip everything it
 * did not report.
 */

export interface LaunchGroup {
	runner: TestRunner;
	cases: TestCase[];
}

export interface LaunchPlan {
	/** One invocation per runner, in the order the suite first reaches them. */
	groups: LaunchGroup[];
	/** Cases of a participating kind with no runner to execute them. */
	skipped: CaseResult[];
	manualCases: TestCase[];
}

/**
 * Which runner executes this case: the one it names, when that runner exists,
 * is enabled and matches the case's kind — otherwise the first enabled runner
 * of that kind. The UI previews use this same function so the execution plan a
 * person sees cannot diverge from what the launch actually does.
 */
export function resolveRunner(c: TestCase, runners: TestRunner[]): TestRunner | undefined {
	if (c.runnerId) {
		const own = runners.find((r) => r.id === c.runnerId);
		if (own?.enabled && own.kind === c.kind) return own;
	}
	return runners.find((r) => r.kind === c.kind && r.enabled);
}

function noRunnerResult(c: TestCase): CaseResult {
	return {
		testCaseId: c.id,
		runnerId: null,
		status: 'skipped',
		durationMs: null,
		message: c.runnerId
			? `runner ${c.runnerId} is not available for ${c.kind} cases`
			: `no ${c.kind} runner configured`,
		stack: null,
		artifacts: []
	};
}

/** Pure: what a launch would do, given the suite's cases and the runner catalogue. */
export function planLaunch(
	cases: TestCase[],
	kinds: readonly string[],
	runners: TestRunner[]
): LaunchPlan {
	const groups = new Map<string, LaunchGroup>();
	const skipped: CaseResult[] = [];
	const manualCases: TestCase[] = [];

	for (const c of cases) {
		if (!kinds.includes(c.kind)) continue; // unticked kinds do not take part at all
		if (c.kind === 'manual') {
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
		else groups.set(runner.id, { runner, cases: [c] });
	}

	return { groups: [...groups.values()], skipped, manualCases };
}

/** Kinds that have no runner, for the launch preview's warning rows. */
export function unrunnableKinds(plan: LaunchPlan, cases: TestCase[]): { kind: TestKind; count: number }[] {
	const byKind = new Map<TestKind, number>();
	for (const r of plan.skipped) {
		const kind = cases.find((c) => c.id === r.testCaseId)?.kind;
		if (kind) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
	}
	return [...byKind].map(([kind, count]) => ({ kind, count }));
}

function errorResults(group: LaunchGroup, e: unknown): CaseResult[] {
	return group.cases.map((c) => ({
		testCaseId: c.id,
		runnerId: group.runner.id,
		status: 'fail' as const,
		durationMs: null,
		message: `runner did not complete: ${(e as Error).message}`,
		stack: null,
		artifacts: []
	}));
}

/**
 * Execute the plan's groups sequentially, persisting after every invocation so
 * a crash or restart leaves an honest partial record rather than nothing.
 * Completion is claimed only when no manual case is still pending.
 */
export async function executeRun(run: TestRun, plan: LaunchPlan, environment: string): Promise<void> {
	for (const group of plan.groups) {
		try {
			const { invocation, results } = await dispatchRunner(
				run.id,
				group.runner,
				group.cases,
				environment
			);
			run.invocations.push(invocation);
			run.results.push(...results);
		} catch (e) {
			// dispatchRunner degrades internally; this is the last-resort net.
			run.results.push(...errorResults(group, e));
		}
		await cp.saveRun({ ...run });
	}

	if (!run.results.some((r) => r.notes === PENDING_NOTE)) {
		run.completedAt = new Date().toISOString();
	}
	await cp.saveRun({ ...run });
}

export { pendingManualResult };
