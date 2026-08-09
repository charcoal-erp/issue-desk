import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AGENT_STATUSES } from '$lib/schemas';
import { ISSUE_TYPES, PRIORITIES, SOURCES, STATUSES } from '$lib/types';
import * as store from '$lib/server/store';

/**
 * GET /api/agent/meta — the filter vocabulary.
 *
 * Every value that any other agent endpoint will accept: applications and their
 * modules, categories, tags in use, and the enums. Fetch this once at the start
 * of a session and a filter can be built without guessing at slugs.
 */
export const GET: RequestHandler = async () => {
	await store.ensureLoaded();
	return json({
		applications: store.applications().map((a) => ({
			id: a.id,
			code: a.code,
			name: a.name,
			modules: a.modules.map((m) => ({ id: m.id, code: m.code, name: m.name }))
		})),
		categories: store.categories(),
		tags: store.tags().sort(),
		types: ISSUE_TYPES,
		priorities: PRIORITIES,
		statuses: STATUSES,
		sources: SOURCES,
		// The subset an agent account is allowed to set; see /issues/[id]/status.
		agentStatuses: AGENT_STATUSES,
		users: store
			.users()
			.filter((u) => u.active !== false)
			.map((u) => ({ id: u.id, name: u.name, kind: u.kind ?? 'human', assignable: u.assignable === true }))
	});
};
