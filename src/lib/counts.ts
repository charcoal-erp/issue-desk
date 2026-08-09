import type { Issue } from './types';

export interface FilterCounts {
	total: number;
	byApp: Record<string, number>;
	byStatus: Record<string, number>;
	byPriority: Record<string, number>;
	byCategory: Record<string, number>;
	bySource: Record<string, number>;
	/** Keyed `${appId}/${moduleId}` — module ids are only unique within an app. */
	byModule: Record<string, number>;
	/** Tag → count, most-used first, capped so the rail stays a rail. */
	topTags: Array<{ tag: string; count: number }>;
}

const RAIL_TAG_LIMIT = 12;

/**
 * Rail counts for one slice of the dataset — every issue on /issues, the
 * backlog alone on /backlog. They are deliberately not narrowed by the active
 * filter: the numbers say what each facet *would* return, which is what makes
 * them worth reading before you click.
 */
export function tallyCounts(rows: Issue[]): FilterCounts {
	const counts: FilterCounts = {
		total: rows.length,
		byApp: {},
		byStatus: {},
		byPriority: {},
		byCategory: {},
		bySource: {},
		byModule: {},
		topTags: []
	};
	const tagCounts = new Map<string, number>();
	for (const issue of rows) {
		counts.byApp[issue.appId] = (counts.byApp[issue.appId] ?? 0) + 1;
		counts.byStatus[issue.status] = (counts.byStatus[issue.status] ?? 0) + 1;
		counts.byPriority[issue.priority] = (counts.byPriority[issue.priority] ?? 0) + 1;
		counts.bySource[issue.source] = (counts.bySource[issue.source] ?? 0) + 1;
		if (issue.categoryId) {
			counts.byCategory[issue.categoryId] = (counts.byCategory[issue.categoryId] ?? 0) + 1;
		}
		if (issue.moduleId) {
			const key = `${issue.appId}/${issue.moduleId}`;
			counts.byModule[key] = (counts.byModule[key] ?? 0) + 1;
		}
		for (const tag of issue.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
	}
	counts.topTags = [...tagCounts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
		.slice(0, RAIL_TAG_LIMIT);
	return counts;
}
