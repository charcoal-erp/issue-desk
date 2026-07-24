import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as store from '$lib/server/store';

/**
 * GET /api/issues/<id> — resolve one issue's title and status. Used by a
 * Checkpoint instance to turn a parent-issue id or a filed-bug id into a real
 * title and link. 404 when the id is unknown.
 */
export const GET: RequestHandler = async ({ params }) => {
	await store.ensureLoaded();
	const issue = store.get(params.id);
	if (!issue) return json({ message: `Issue ${params.id} not found.` }, { status: 404 });
	return json({
		issue: { id: issue.id, title: issue.title, status: issue.status, appId: issue.appId }
	});
};
