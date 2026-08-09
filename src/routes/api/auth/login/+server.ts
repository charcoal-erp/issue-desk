import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loginRequestSchema } from '$lib/schemas';
import { SESSION_COOKIE, login, sessionCookieOptions } from '$lib/server/auth';
import * as store from '$lib/server/store';

/**
 * POST /api/auth/login — the only unauthenticated write in the app.
 * { username, password } → { token, tokenType, expiresAt, expiresIn, user }
 *
 * A Claude Code session starts here: it exchanges the agent account's
 * credentials for a JWT and sends that as `Authorization: Bearer <token>` on
 * every subsequent call. The same token is also dropped as an httpOnly cookie,
 * so signing in from a browser fetch leaves a usable session behind.
 */
export const POST: RequestHandler = async ({ request, cookies, url }) => {
	await store.ensureLoaded();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = loginRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ message: parsed.error.issues[0]?.message ?? 'Invalid login request.' },
			{ status: 400 }
		);
	}

	const attempt = await login(parsed.data.username, parsed.data.password);
	if (!attempt.ok) {
		// One message for both a wrong password and an unknown username: which of
		// the two it was is not something an unauthenticated caller should learn.
		const message =
			attempt.reason === 'inactive'
				? 'This account is deactivated.'
				: 'Invalid username or password.';
		return json({ message }, { status: 401 });
	}

	cookies.set(SESSION_COOKIE, attempt.result.token, sessionCookieOptions(url.protocol === 'https:'));
	return json(attempt.result);
};
