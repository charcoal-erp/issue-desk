import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { STATUSES } from '$lib/types';
import { AGENT_STATUSES, agentStatusRequestSchema } from '$lib/schemas';
import { mayNotSetStatus, notFound, readJsonBody, toDetail } from '$lib/server/api/agent';
import * as store from '$lib/server/store';

/**
 * POST /api/agent/issues/<id>/status — move an issue along.
 * Body: { status: "open" | "in-progress" | "to-be-verified", comment?: string }
 *
 * This is the end of the loop: an agent that has finished a fix sets
 * `to-be-verified`, which puts the issue in front of a human tester. Agents
 * cannot set `complete` or `rejected` — signing off on your own work is not a
 * thing an agent gets to do — and a 403 says so explicitly rather than
 * pretending the status does not exist.
 *
 * The optional `comment` is recorded as a comment on the issue before the
 * transition, so the "what I changed" note and the status change arrive
 * together in the activity timeline.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	await store.ensureLoaded();
	const user = locals.user!;

	const issue = store.get(params.id);
	if (!issue) return notFound(params.id);

	const body = await readJsonBody(request);
	if (!body.ok) return body.response;

	const parsed = agentStatusRequestSchema.safeParse(body.body);
	if (!parsed.success) {
		return json(
			{
				message: `Status must be one of: ${STATUSES.join(', ')}.`,
				agentStatuses: AGENT_STATUSES
			},
			{ status: 400 }
		);
	}

	// The status is valid; whether *this* caller may set it is a separate
	// question, and one worth answering in words a caller can act on.
	if (mayNotSetStatus(user, parsed.data.status)) {
		return json(
			{
				message: `Agents cannot set "${parsed.data.status}" — verification is a tester's call. Set "to-be-verified" when the fix is ready for review.`,
				agentStatuses: AGENT_STATUSES
			},
			{ status: 403 }
		);
	}

	if (parsed.data.comment) {
		await store.comment(params.id, parsed.data.comment, user.id);
	}
	const updated = await store.update(params.id, { status: parsed.data.status }, user.id);
	return json({ issue: toDetail(updated) });
};
