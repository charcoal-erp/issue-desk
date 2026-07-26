import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { applicationSchema, moduleRefSchema, userSchema } from '$lib/schemas';
import { z } from 'zod';
import { PROVIDER_META } from '$lib/types';
import * as store from '$lib/server/store';
import { isVaultReady, removeKey, setKey, recordTest, status } from '$lib/server/security/vault';
import { testKey, AiError } from '$lib/server/ai/client';

export const load: PageServerLoad = async () => {
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
	return {
		perApp,
		perUser,
		keyStatus: await status('anthropic'),
		vaultReady: isVaultReady()
	};
};

export const actions: Actions = {
	upsertUser: async ({ request }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const parsed = userSchema.safeParse({
			id: String(form.get('id') || '').trim(),
			name: String(form.get('name') || '').trim(),
			role: String(form.get('role') || '').trim() || undefined,
			avatarColor: String(form.get('avatarColor') || '').trim() || undefined,
			assignable: form.get('assignable') === 'on'
		});
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid user' });
		}
		await store.upsertUser(parsed.data);
		return { saved: parsed.data.id };
	},

	upsertApplication: async ({ request }) => {
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
	setKey: async ({ request }) => {
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

	removeKey: async () => {
		await removeKey('anthropic');
		return { keyRemoved: true };
	},

	testKey: async () => {
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
