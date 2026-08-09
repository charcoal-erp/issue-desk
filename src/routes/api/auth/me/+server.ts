import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/auth/me — who the current token belongs to. Cheap enough to use as
 * a liveness probe for a token before starting a batch of work.
 */
export const GET: RequestHandler = async ({ locals }) => {
	return json({ user: locals.user });
};
