import type { Issue } from './types';

export interface TrendBucket {
	label: string; // e.g. "Jul 6"
	created: number;
	verify: number; // moved to "To be verified" that week
	resolved: number; // completed in that week (proxied by updatedAt while complete)
}

/** The chart always opens here and only ever grows to the right. */
export const TREND_START = new Date(2026, 6, 1); // 1 July 2026

/** Monday-anchored week start for bucketing. */
function weekStart(d: Date): Date {
	const copy = new Date(d);
	copy.setHours(0, 0, 0, 0);
	const dow = (copy.getDay() + 6) % 7; // 0 = Monday
	copy.setDate(copy.getDate() - dow);
	return copy;
}

/**
 * When an issue moved to "To be verified" — one entry per move, so an issue sent
 * back and re-submitted counts each time. Going by the activity log rather than
 * its current status keeps the history: an issue that has since been verified
 * and completed still counts in the week it was submitted. One filed directly in
 * that status has no such event, so it counts from when it was filed.
 */
function verifyMoves(issue: Issue): string[] {
	const moves = issue.activity
		.filter((a) => a.kind === 'status' && a.to === 'to-be-verified')
		.map((a) => a.at);
	return moves.length || issue.status !== 'to-be-verified' ? moves : [issue.createdAt];
}

/** Weekly created / to-be-verified / resolved counts from TREND_START to `now`. */
export function buildTrend(issues: Issue[], now = new Date()): TrendBucket[] {
	const trend: TrendBucket[] = [];
	const keyIndex = new Map<number, number>();
	const thisWeek = weekStart(now).getTime();
	// Stepped by calendar date: a run this long crosses clock changes, where
	// adding 7×24h would land off the midnight that `bucketFor` looks up.
	for (const start = weekStart(TREND_START); start.getTime() <= thisWeek; start.setDate(start.getDate() + 7)) {
		keyIndex.set(start.getTime(), trend.length);
		// The first week began in June; it still reads as the start of July.
		const shown = start < TREND_START ? TREND_START : start;
		trend.push({
			label: shown.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
			created: 0,
			verify: 0,
			resolved: 0
		});
	}
	const bucketFor = (iso: string): number | undefined =>
		keyIndex.get(weekStart(new Date(iso)).getTime());
	for (const i of issues) {
		const c = bucketFor(i.createdAt);
		if (c !== undefined) trend[c].created += 1;
		for (const at of verifyMoves(i)) {
			const v = bucketFor(at);
			if (v !== undefined) trend[v].verify += 1;
		}
		if (i.status === 'complete') {
			const r = bucketFor(i.updatedAt);
			if (r !== undefined) trend[r].resolved += 1;
		}
	}
	return trend;
}
