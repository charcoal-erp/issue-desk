import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractTagsRequestSchema } from '$lib/schemas';
import { labelFor } from '$lib/tags';
import * as store from '$lib/server/store';
import { extractTags } from '$lib/server/ai/tags';
import { AiError } from '$lib/server/ai/client';

/**
 * POST /api/ai/extract-tags → { tags: [{ slug, label }], model }.
 *
 * JSON, not a stream: the result is a short array, useless until complete.
 * Suggestions only — nothing is attached to an issue here; the user confirms or
 * edits first. On any AI failure the existing tags are left untouched and an
 * explicit error is returned.
 */
export const POST: RequestHandler = async ({ request }) => {
	await store.ensureLoaded();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = extractTagsRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json({ message: 'Invalid request.' }, { status: 400 });
	}
	if (!parsed.data.title.trim() && !parsed.data.description.trim()) {
		return json({ message: 'Add a title or description first.' }, { status: 400 });
	}

	try {
		const result = await extractTags(
			parsed.data.title,
			parsed.data.description,
			store.tags()
		);
		return json({
			tags: result.tags.map((slug) => ({ slug, label: labelFor(slug) })),
			model: result.model
		});
	} catch (e) {
		if (e instanceof AiError) return json({ message: e.message }, { status: 502 });
		throw e;
	}
};
