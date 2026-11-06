import type { Issue } from './types';

export interface FilterCounts {
	total: number;
	byApp: Record<string, number>;
	byStatus: Record<string, number>;
	byPriority: Record<string, number>;
	bySource: Record<string, number>;
	byReporter: Record<string, number>;
	/** Keyed `${appId}/${moduleId}` — module ids are only unique within an app. */
	byModule: Record<string, number>;
}

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
		bySource: {},
		byReporter: {},
		byModule: {}
	};
	for (const issue of rows) {
		counts.byApp[issue.appId] = (counts.byApp[issue.appId] ?? 0) + 1;
		counts.byStatus[issue.status] = (counts.byStatus[issue.status] ?? 0) + 1;
		counts.byPriority[issue.priority] = (counts.byPriority[issue.priority] ?? 0) + 1;
		counts.bySource[issue.source] = (counts.bySource[issue.source] ?? 0) + 1;
		counts.byReporter[issue.reporterId] = (counts.byReporter[issue.reporterId] ?? 0) + 1;
		if (issue.moduleId) {
			const key = `${issue.appId}/${issue.moduleId}`;
			counts.byModule[key] = (counts.byModule[key] ?? 0) + 1;
		}
	}
	return counts;
}
