import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { notFound, toDetail } from '$lib/server/api/agent';
import * as store from '$lib/server/store';

/**
 * GET /api/agent/issues/<id> — everything needed to start on one issue:
 * description, page/form context, attachments as absolute URLs, comments,
 * status history, and a `markdown` field carrying the same brief the UI's
 * "Copy for Claude Code" button produces. That field is what replaces the
 * manual copy-paste this API exists to retire.
 */
export const GET: RequestHandler = async ({ params }) => {
	await store.ensureLoaded();
	const issue = store.get(params.id);
	if (!issue) return notFound(params.id);
	return json({ issue: toDetail(issue) });
};
