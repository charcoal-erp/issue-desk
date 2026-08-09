import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseAgentFilter, toSummary } from '$lib/server/api/agent';
import * as store from '$lib/server/store';

/**
 * GET /api/agent/issues — the work queue.
 *
 * Filters (all optional, all combinable):
 *   category=<id>      tag=<slug>        type=bug|feature
 *   app=<id>           module=<id>       assignee=<userId>   reporter=<userId>
 *   status=<s>         priority=<p>      source=<s>          q=<free text>
 *   sort=…  dir=…      page=1  pageSize=50 (max 200)
 *
 * `status` defaults to open + in-progress; pass `status=all` to drop the
 * constraint. Results are ordered most-urgent-first by default, which is the
 * order an agent should work through them.
 */
export const GET: RequestHandler = async ({ url }) => {
	await store.ensureLoaded();
	const filter = parseAgentFilter(url.searchParams);
	const { rows, total } = store.list(filter);
	const pageSize = filter.pageSize ?? 50;
	const page = filter.page ?? 1;

	return json({
		issues: rows.map(toSummary),
		page,
		pageSize,
		total,
		totalPages: Math.max(1, Math.ceil(total / pageSize)),
		hasMore: page * pageSize < total,
		filter: {
			category: filter.categoryId ?? null,
			tag: filter.tag ?? null,
			type: filter.type ?? null,
			app: filter.appId ?? null,
			module: filter.moduleId ?? null,
			assignee: filter.assigneeId ?? null,
			status: filter.status ?? 'all',
			priority: filter.priority ?? 'all',
			source: filter.source ?? 'all',
			q: filter.q ?? null
		}
	});
};
