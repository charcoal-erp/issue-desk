import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE, reissue, sessionCookieOptions } from '$lib/server/auth';

/**
 * POST /api/auth/refresh — trade a still-valid token for a fresh one, so a long
 * agent run never has to hold the password past the initial login. An expired
 * token cannot be refreshed (the hook rejects it before this handler runs);
 * log in again at that point.
 */
export const POST: RequestHandler = async ({ locals, cookies, url }) => {
	const user = locals.user!; // the hook guarantees this route is authenticated
	const result = await reissue(user);
	cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(url.protocol === 'https:'));
	return json(result);
};
