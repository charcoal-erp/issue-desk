import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { duplicateCheckRequestSchema } from '$lib/schemas';
import * as store from '$lib/server/store';
import { findDuplicates } from '$lib/server/ai/duplicates';

/**
 * POST /api/ai/duplicates → DuplicateCheckResult.
 *
 * Read-only: scores existing issues against a draft (or against an existing
 * issue, which `excludeId` keeps out of its own results). AI trouble is not an
 * error here — the keyword scores come back with `aiError` saying why, so the
 * check still answers when no key is configured.
 */
export const POST: RequestHandler = async ({ request }) => {
	await store.ensureLoaded();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = duplicateCheckRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json({ message: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
	}
	if (!parsed.data.title.trim() && !parsed.data.description.trim()) {
		return json({ message: 'Add a title or description first.' }, { status: 400 });
	}

	const { limit, ...query } = parsed.data;
	const app = store.applications().find((a) => a.id === query.appId);
	const mod = app?.modules.find((m) => m.id === query.moduleId);
	const where = [app?.name, mod?.name].filter(Boolean).join(' / ');
	return json(await findDuplicates({ ...query, where }, store.list({}).rows, limit));
};
