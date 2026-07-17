import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createIssueSchema } from '$lib/schemas';
import * as store from '$lib/server/store';

/**
 * JSON create endpoint used by the Python simulators (`simulators/`) to
 * populate test issues. Mirrors the `createIssue` form action but takes JSON
 * and an explicit `reporterId`, so a script can attribute issues to any user.
 *
 * POST /api/issues
 * { ...CreateIssueInput, reporterId, draftId? }
 */
export const POST: RequestHandler = async ({ request }) => {
	await store.ensureLoaded();
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = createIssueSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ message: 'Invalid issue', issues: parsed.error.issues },
			{ status: 400 }
		);
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
