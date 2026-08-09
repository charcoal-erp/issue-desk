import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE } from '$lib/server/auth';

/**
 * POST /api/auth/logout — clears the session cookie.
 *
 * Bearer tokens are stateless and stay valid until they expire: an agent
 * "logs out" by discarding its token. To invalidate outstanding tokens for an
 * account before then, change its password (Config → Accounts), which moves the
 * credential's `updatedAt` past every token already issued.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
