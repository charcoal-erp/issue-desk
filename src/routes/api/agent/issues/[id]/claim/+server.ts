import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { agentClaimRequestSchema } from '$lib/schemas';
import { notFound, readJsonBody, toDetail } from '$lib/server/api/agent';
import * as store from '$lib/server/store';

/**
 * POST /api/agent/issues/<id>/claim — take ownership before starting work.
 * Body (optional): { comment?: string }
 *
 * Assigns the issue to the caller and moves it to in-progress. Refuses with
 * 409 when someone else already holds it, so several agents can share one
 * queue without doubling up. Claiming something you already hold is a no-op
 * success, which makes retries safe.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	await store.ensureLoaded();
	const user = locals.user!;

	const body = await readJsonBody(request);
	if (!body.ok) return body.response;
	const parsed = agentClaimRequestSchema.safeParse(body.body);
	if (!parsed.success) {
		return json({ message: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
	}

	const result = await store.claim(params.id, user.id);
	if (!result.ok) {
		if (result.reason === 'not-found') return notFound(params.id);
		const held = result.issue?.assigneeId;
		const message =
			result.reason === 'taken'
				? `${params.id} is already assigned to ${held}.`
				: `${params.id} is ${result.issue?.status} and cannot be claimed.`;
		return json(
			{ message, reason: result.reason, issue: result.issue ? toDetail(result.issue) : undefined },
			{ status: 409 }
		);
	}

	if (parsed.data.comment) {
		await store.comment(params.id, parsed.data.comment, user.id);
	}
	// Re-read: the comment above produced a newer revision than `claim` returned.
	return json({ issue: toDetail(store.get(params.id)!) });
};
