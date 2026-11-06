import type { PageServerLoad } from './$types';
import * as store from '$lib/server/store';
import { STATUSES, PRIORITIES } from '$lib/types';
import type { Issue, Priority, Status } from '$lib/types';
import { buildTrend, type TrendBucket } from '$lib/trend';

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
	byCategory: Record<string, number>;
	uncategorised: number;
	trend: TrendBucket[];
}

const DAY = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async () => {
	await store.ensureLoaded();
	const issues = store.list({ sort: 'updated', dir: 'desc' }).rows;
	const now = Date.now();

	const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
	const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<Priority, number>;
	const tagCounts = new Map<string, number>();
	const byCategory: Record<string, number> = {};
	let uncategorised = 0;
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
		if (i.categoryId) byCategory[i.categoryId] = (byCategory[i.categoryId] ?? 0) + 1;
		else uncategorised += 1;
	}

	const total = issues.length;
	const resolutionRate = total ? byStatus.complete / total : null;
	const avgOpenAgeDays = openCount ? openAgeSum / openCount / DAY : null;

	const topTags = [...tagCounts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 12);

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
		byCategory,
		uncategorised,
		trend: buildTrend(issues, new Date(now))
	};
	return data;
};
