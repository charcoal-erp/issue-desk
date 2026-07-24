import type { TestRun } from '$lib/types';

/**
 * Age buckets for the run list. Run history accumulates one file per run
 * forever, so the first question about an old run is almost always "how old" —
 * and the cleanup offers the same cutoffs, so what you filter to is what you
 * prune.
 *
 * This lives in $lib rather than beside the page because a `+page.server.ts`
 * may only export `load` and `actions`; anything else is rejected at runtime.
 */
export const AGE_WINDOWS = [
	{ key: 'today', label: 'Today', hours: 24 },
	{ key: 'week', label: 'This week', hours: 24 * 7 },
	{ key: 'month', label: 'This month', hours: 24 * 30 },
	{ key: 'older', label: 'Older', hours: 24 * 30 } // everything before that cutoff
] as const;

export type AgeKey = (typeof AGE_WINDOWS)[number]['key'];

export function cutoffIso(hours: number, now: Date = new Date()): string {
	return new Date(now.getTime() - hours * 3600_000).toISOString();
}

/** Does this run fall in the named window? `all` and `archived` are pseudo-windows. */
export function inWindow(run: TestRun, age: string, now: Date): boolean {
	if (age === 'all') return true;
	if (age === 'archived') return !!run.archived;
	const window = AGE_WINDOWS.find((w) => w.key === age);
	if (!window) return true;
	const cutoff = cutoffIso(window.hours, now);
	return window.key === 'older' ? run.startedAt < cutoff : run.startedAt >= cutoff;
}
