import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { SESSION_COOKIE } from '$lib/server/auth';

/**
 * Signing out is only ever a cookie deletion — the JWT it held stays
 * cryptographically valid until it expires, which is why the cookie is
 * httpOnly and never handed to client-side script.
 */
function signOut(cookies: { delete(name: string, opts: { path: string }): void }): never {
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/login');
}

export const load: PageServerLoad = async ({ cookies }) => signOut(cookies);

export const actions: Actions = {
	default: async ({ cookies }) => signOut(cookies)
};
