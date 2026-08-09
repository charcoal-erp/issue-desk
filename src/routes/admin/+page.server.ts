import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	applicationSchema,
	categorySchema,
	moduleRefSchema,
	passwordSchema,
	userSchema
} from '$lib/schemas';
import { z } from 'zod';
import { PROVIDER_META } from '$lib/types';
import * as store from '$lib/server/store';
import { loginName } from '$lib/server/auth';
import { hasPassword, removePassword, setPassword } from '$lib/server/auth/credentials';
import { generatePassword } from '$lib/server/auth/password';
import { isVaultReady, removeKey, setKey, recordTest, status } from '$lib/server/security/vault';
import { testKey, AiError } from '$lib/server/ai/client';

/**
 * Config is admin-only. The nav hides it from everyone else, but the guard is
 * here — a hidden link is a courtesy, not a control.
 */
function requireAdmin(locals: App.Locals): void {
	if (!locals.user?.admin) error(403, 'Only administrators can change configuration.');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	await store.ensureLoaded();
	const all = store.list({}).rows;
	const perApp: Record<string, { open: number; total: number }> = {};
	const perUser: Record<string, { reported: number; assigned: number }> = {};
	for (const issue of all) {
		perApp[issue.appId] ??= { open: 0, total: 0 };
		perApp[issue.appId].total += 1;
		if (issue.status === 'open') perApp[issue.appId].open += 1;
		perUser[issue.reporterId] ??= { reported: 0, assigned: 0 };
		perUser[issue.reporterId].reported += 1;
		if (issue.assigneeId) {
			perUser[issue.assigneeId] ??= { reported: 0, assigned: 0 };
			perUser[issue.assigneeId].assigned += 1;
		}
	}
	// Which accounts can actually sign in — surfaced so an admin can see at a
	// glance who is still waiting for a password.
	const credentialed: Record<string, boolean> = {};
	for (const user of store.users()) credentialed[user.id] = await hasPassword(user.id);

	return {
		perApp,
		perUser,
		credentialed,
		keyStatus: await status('anthropic'),
		vaultReady: isVaultReady()
	};
};

export const actions: Actions = {
	upsertUser: async ({ request, locals }) => {
		requireAdmin(locals);
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '').trim();
		const existing = store.users().find((u) => u.id === id);
		const username = String(form.get('username') || '').trim().toLowerCase() || undefined;

		const parsed = userSchema.safeParse({
			id,
			name: String(form.get('name') || '').trim(),
			role: String(form.get('role') || '').trim() || undefined,
			avatarColor: String(form.get('avatarColor') || '').trim() || undefined,
			assignable: form.get('assignable') === 'on',
			active: form.get('active') !== 'off',
			kind: String(form.get('kind') || 'human'),
			username,
			admin: form.get('admin') === 'on'
		});
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid user' });
		}

		// Usernames are the login key, so they have to stay unique across accounts.
		const wanted = loginName(parsed.data).toLowerCase();
		const clash = store
			.users()
			.find((u) => u.id !== parsed.data.id && loginName(u).toLowerCase() === wanted);
		if (clash) {
			return fail(400, { message: `Username "${wanted}" is already used by ${clash.name}.` });
		}

		// An admin cannot strip their own admin bit or deactivate themselves —
		// the quickest route to a system nobody can administer.
		if (existing && existing.id === locals.user!.id) {
			if (!parsed.data.admin) return fail(400, { message: 'You cannot remove your own admin access.' });
			if (parsed.data.active === false) {
				return fail(400, { message: 'You cannot deactivate your own account.' });
			}
		}

		await store.upsertUser(parsed.data);
		return { saved: parsed.data.id };
	},

	/**
	 * Set or reset an account's password. Leaving the field blank generates one
	 * and shows it once — the usual way to stand up an agent account, whose
	 * password nobody needs to memorise.
	 */
	setPassword: async ({ request, locals }) => {
		requireAdmin(locals);
		await store.ensureLoaded();
		const form = await request.formData();
		const userId = String(form.get('userId') || '').trim();
		const user = store.users().find((u) => u.id === userId);
		if (!user) return fail(400, { message: `Unknown account "${userId}".` });

		const supplied = String(form.get('password') || '');
		const generated = supplied ? undefined : generatePassword();
		const password = supplied || generated!;

		const parsed = passwordSchema.safeParse(password);
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid password' });
		}

		await setPassword(userId, parsed.data);
		return {
			passwordSet: userId,
			username: loginName(user),
			// Only ever echoed back for a password the server invented; one we were
			// handed is already known to whoever typed it.
			generatedPassword: generated
		};
	},

	/** Revokes sign-in for an account without deleting its history. */
	clearPassword: async ({ request, locals }) => {
		requireAdmin(locals);
		await store.ensureLoaded();
		const form = await request.formData();
		const userId = String(form.get('userId') || '').trim();
		if (userId === locals.user!.id) {
			return fail(400, { message: 'You cannot remove your own password.' });
		}
		await removePassword(userId);
		return { passwordCleared: userId };
	},

	upsertCategory: async ({ request, locals }) => {
		requireAdmin(locals);
		await store.ensureLoaded();
		const form = await request.formData();
		const parsed = categorySchema.safeParse({
			id: String(form.get('id') || '').trim(),
			name: String(form.get('name') || '').trim(),
			description: String(form.get('description') || '').trim() || undefined,
			color: String(form.get('color') || '').trim() || undefined
		});
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return fail(400, {
				message: `${String(first?.path[0] ?? '')}: ${first?.message ?? 'Invalid category'}`
			});
		}
		await store.upsertCategory(parsed.data);
		return { savedCategory: parsed.data.id };
	},

	removeCategory: async ({ request, locals }) => {
		requireAdmin(locals);
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '').trim();
		await store.removeCategory(id);
		return { removedCategory: id };
	},

	upsertApplication: async ({ request, locals }) => {
		requireAdmin(locals);
		await store.ensureLoaded();
		const form = await request.formData();
		let modules: unknown = [];
		try {
			modules = JSON.parse(String(form.get('modules') || '[]'));
		} catch {
			return fail(400, { message: 'Modules must be valid JSON.' });
		}
		const modulesParsed = z.array(moduleRefSchema).safeParse(modules);
		if (!modulesParsed.success) {
			return fail(400, {
				message: `Modules JSON: ${modulesParsed.error.issues[0]?.message ?? 'invalid shape'}`
			});
		}
		const parsed = applicationSchema.safeParse({
			id: String(form.get('id') || '').trim(),
			code: String(form.get('code') || '').trim().toUpperCase(),
			name: String(form.get('name') || '').trim(),
			color: String(form.get('color') || '').trim() || undefined,
			modules: modulesParsed.data
		});
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return fail(400, {
				message: `${String(first?.path[0] ?? '')}: ${first?.message ?? 'Invalid application'}`
			});
		}
		await store.upsertApplication(parsed.data);
		return { saved: parsed.data.id };
	},

	// ---- Generative AI key (Anthropic) ----
	setKey: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const key = String(form.get('apiKey') || '').trim();
		if (!key) return fail(400, { message: 'Paste an API key first.' });
		try {
			const view = await setKey('anthropic', key);
			return { keySaved: true, view };
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
	},

	removeKey: async ({ locals }) => {
		requireAdmin(locals);
		await removeKey('anthropic');
		return { keyRemoved: true };
	},

	testKey: async ({ locals }) => {
		requireAdmin(locals);
		const { getKeyForRequest } = await import('$lib/server/security/vault');
		const key = await getKeyForRequest('anthropic');
		if (!key) return fail(400, { message: 'No key to test — add one first.' });
		try {
			await testKey(key, PROVIDER_META.anthropic.fastModel);
			await recordTest('anthropic', true);
			return { keyTested: true };
		} catch (e) {
			const msg = e instanceof AiError ? e.message : (e as Error).message;
			await recordTest('anthropic', false, msg);
			return fail(400, { message: msg });
		}
	}
};
