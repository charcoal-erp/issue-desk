import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loginRequestSchema } from '$lib/schemas';
import { SESSION_COOKIE, login, sessionCookieOptions } from '$lib/server/auth';
import * as store from '$lib/server/store';

/** Only ever bounce back to a path on this host — never to an absolute URL. */
function safeRedirect(target: string | null): string {
	if (!target || !target.startsWith('/') || target.startsWith('//')) return '/';
	return target;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	await store.ensureLoaded();
	return { productName: store.settings().productName };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const username = String(form.get('username') ?? '');
		const redirectTo = safeRedirect(String(form.get('redirectTo') ?? '') || null);

		const parsed = loginRequestSchema.safeParse({
			username,
			password: String(form.get('password') ?? '')
		});
		if (!parsed.success) {
			return fail(400, { username, message: parsed.error.issues[0]?.message ?? 'Invalid login.' });
		}

		const attempt = await login(parsed.data.username, parsed.data.password);
		if (!attempt.ok) {
			return fail(401, {
				username,
				message:
					attempt.reason === 'inactive'
						? 'This account has been deactivated. Ask an admin to re-enable it.'
						: 'Invalid username or password.'
			});
		}

		cookies.set(
			SESSION_COOKIE,
			attempt.result.token,
			sessionCookieOptions(url.protocol === 'https:')
		);
		redirect(303, redirectTo);
	}
};
