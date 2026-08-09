import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Issue } from '$lib/types';
import { parseAgentFilter, toDetail, toSummary, workOrder } from '$lib/server/api/agent';
import * as store from '$lib/server/store';

/**
 * The "work through them one by one" endpoint.
 *
 *   GET  /api/agent/next?category=…  — peek at what you would get next
 *   POST /api/agent/next?category=…  — claim it and start
 *
 * Both take the same filters as /api/agent/issues. The candidate is the most
 * urgent unclaimed issue (oldest first within a priority), where "unclaimed"
 * means unassigned or already yours.
 *
 * POST returns 204 when the queue is empty, which is the natural loop
 * condition: keep calling until it stops handing you work.
 */
function candidates(searchParams: URLSearchParams, userId: string): Issue[] {
	const filter = parseAgentFilter(searchParams);
	// Only genuinely open work can be picked up next, whatever the caller asked
	// for — handing an agent something already verified would not be "next".
	filter.status = (filter.status ?? ['open', 'in-progress']).filter(
		(s) => s === 'open' || s === 'in-progress'
	);
	if (!filter.status.length) filter.status = ['open'];
	filter.page = undefined;
	filter.pageSize = undefined;

	const { rows } = store.list(filter);
	return workOrder(rows.filter((i) => !i.assigneeId || i.assigneeId === userId));
}

export const GET: RequestHandler = async ({ url, locals }) => {
	await store.ensureLoaded();
	const queue = candidates(url.searchParams, locals.user!.id);
	return json({
		issue: queue[0] ? toSummary(queue[0]) : null,
		remaining: queue.length
	});
};

export const POST: RequestHandler = async ({ url, locals }) => {
	await store.ensureLoaded();
	const user = locals.user!;
	const queue = candidates(url.searchParams, user.id);

	// Walk the queue rather than trusting the first pick: between listing and
	// claiming, another agent may have taken it. Whoever lost simply moves on
	// to the next one.
	for (const candidate of queue) {
		const result = await store.claim(candidate.id, user.id);
		if (result.ok) {
			return json({ issue: toDetail(result.issue), remaining: queue.length - 1 });
		}
	}

	return new Response(null, { status: 204 });
};
