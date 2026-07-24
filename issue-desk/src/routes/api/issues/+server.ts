import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createIssueSchema } from '$lib/schemas';
import * as store from '$lib/server/store';

/**
 * JSON issue API. Used by the Python simulators (`simulators/`) to populate
 * test issues, and by a Checkpoint instance over HTTP to file a bug from a
 * failure and to offer a parent-issue picker.
 *
 * Optionally guarded: if ISSUEDESK_INGEST_TOKEN is set, POST requires it as a
 * bearer token, so only a trusted caller can file issues. Unset = open on the
 * LAN, as before.
 */

/** Returns an error Response if a token is required and missing/wrong, else null. */
function tokenError(request: Request): Response | null {
	const required = env.ISSUEDESK_INGEST_TOKEN?.trim();
	if (!required) return null;
	const got = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
	if (got === required) return null;
	return json({ message: 'Missing or invalid ingest token.' }, { status: 401 });
}

/**
 * GET /api/issues[?app=<id>] — a lightweight list for the Checkpoint
 * parent-issue picker: the open issues, most recent first.
 */
export const GET: RequestHandler = async ({ url }) => {
	await store.ensureLoaded();
	const appId = url.searchParams.get('app') ?? undefined;
	const { rows } = store.list({ appId, status: ['open'] });
	const issues = rows.map((i) => ({
		id: i.id,
		title: i.title,
		appId: i.appId,
		status: i.status
	}));
	return json({ issues });
};

/**
 * POST /api/issues
 * { ...CreateIssueInput, reporterId, draftId? }
 */
export const POST: RequestHandler = async ({ request }) => {
	const denied = tokenError(request);
	if (denied) return denied;

	await store.ensureLoaded();
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = createIssueSchema.safeParse(body);
	if (!parsed.success) {
		return json({ message: 'Invalid issue', issues: parsed.error.issues }, { status: 400 });
	}

	const reporterId = String(body.reporterId ?? '');
	if (!store.users().some((u) => u.id === reporterId)) {
		return json({ message: `Unknown reporter "${reporterId}".` }, { status: 400 });
	}
	if (parsed.data.assigneeId && !store.users().some((u) => u.id === parsed.data.assigneeId)) {
		return json({ message: `Unknown assignee "${parsed.data.assigneeId}".` }, { status: 400 });
	}
	const draftId = body.draftId ? String(body.draftId) : undefined;

	try {
		const issue = await store.create(parsed.data, reporterId, draftId);
		return json({ issue }, { status: 201 });
	} catch (e) {
		return json({ message: (e as Error).message }, { status: 400 });
	}
};
