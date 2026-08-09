import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { agentCommentRequestSchema } from '$lib/schemas';
import { notFound, readJsonBody, toDetail } from '$lib/server/api/agent';
import * as store from '$lib/server/store';

/**
 * POST /api/agent/issues/<id>/comment — leave a note on the issue.
 * Body: { message: string }
 *
 * Useful for the things a status change cannot express: which files were
 * touched, why an issue turned out to be a non-issue, what a tester should
 * look at first. Comments are attributed to the account, so an agent's notes
 * are visibly an agent's.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	await store.ensureLoaded();
	const user = locals.user!;

	if (!store.get(params.id)) return notFound(params.id);

	const body = await readJsonBody(request);
	if (!body.ok) return body.response;
	const parsed = agentCommentRequestSchema.safeParse(body.body);
	if (!parsed.success) {
		return json({ message: parsed.error.issues[0]?.message ?? 'Invalid comment.' }, { status: 400 });
	}

	const issue = await store.comment(params.id, parsed.data.message, user.id);
	return json({ issue: toDetail(issue) });
};
