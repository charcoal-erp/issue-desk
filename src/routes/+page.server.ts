import type { PageServerLoad } from './$types';
import * as store from '$lib/server/store';
import { STATUSES, PRIORITIES } from '$lib/types';
import type { Issue, Priority, Status } from '$lib/types';

export interface TrendBucket {
	label: string; // e.g. "Jul 7"
	created: number;
	resolved: number; // completed in that week (proxied by updatedAt while complete)
}

export interface DashboardData {
	issues: Issue[];
	total: number;
	byStatus: Record<Status, number>;
	byPriority: Record<Priority, number>;
	bugs: number;
	features: number;
	criticalOpen: number;
	openTotal: number;
	resolutionRate: number | null; // complete / total, null when no issues
	avgOpenAgeDays: number | null; // null when nothing is open
	topTags: Array<{ tag: string; count: number }>;
	trend: TrendBucket[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Monday-anchored week start for bucketing. */
function weekStart(d: Date): Date {
	const copy = new Date(d);
	copy.setHours(0, 0, 0, 0);
	const dow = (copy.getDay() + 6) % 7; // 0 = Monday
	copy.setDate(copy.getDate() - dow);
	return copy;
}

export const load: PageServerLoad = async () => {
	await store.ensureLoaded();
	const issues = store.list({ sort: 'updated', dir: 'desc' }).rows;
	const now = Date.now();

	const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
	const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<Priority, number>;
	const tagCounts = new Map<string, number>();
	let bugs = 0;
	let features = 0;
	let criticalOpen = 0;
	let openAgeSum = 0;
	let openCount = 0;

	for (const i of issues) {
		byStatus[i.status] += 1;
		byPriority[i.priority] += 1;
		if (i.type === 'bug') bugs += 1;
		else features += 1;
		if (i.status === 'open') {
			openCount += 1;
			openAgeSum += now - new Date(i.createdAt).getTime();
			if (i.priority === 'critical') criticalOpen += 1;
		}
		for (const t of i.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
	}

	const total = issues.length;
	const resolutionRate = total ? byStatus.complete / total : null;
	const avgOpenAgeDays = openCount ? openAgeSum / openCount / DAY : null;

	const topTags = [...tagCounts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 8);

	// Last 8 weeks: created (by createdAt) vs resolved (complete issues by updatedAt).
	const trend: TrendBucket[] = [];
	const keyIndex = new Map<number, number>();
	const thisWeek = weekStart(new Date(now));
	for (let w = 7; w >= 0; w--) {
		const start = new Date(thisWeek.getTime() - w * 7 * DAY);
		keyIndex.set(start.getTime(), trend.length);
		trend.push({
			label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
			created: 0,
			resolved: 0
		});
	}
	const bucketFor = (iso: string): number | undefined =>
		keyIndex.get(weekStart(new Date(iso)).getTime());
	for (const i of issues) {
		const c = bucketFor(i.createdAt);
		if (c !== undefined) trend[c].created += 1;
		if (i.status === 'complete') {
			const r = bucketFor(i.updatedAt);
			if (r !== undefined) trend[r].resolved += 1;
		}
	}

	const data: DashboardData = {
		issues,
		total,
		byStatus,
		byPriority,
		bugs,
		features,
		criticalOpen,
		openTotal: byStatus.open,
		resolutionRate,
		avgOpenAgeDays,
		topTags,
		trend
	};
	return data;
};
