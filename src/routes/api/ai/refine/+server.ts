import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refineRequestSchema } from '$lib/schemas';
import { refineDescription } from '$lib/server/ai/refine';
import { AiError } from '$lib/server/ai/client';

/**
 * POST /api/ai/refine → { refined, model }.
 *
 * Suggestion only. Nothing is written here — applying a refinement is a separate,
 * explicit step in the UI, so a refinement the user rejects costs nothing but the
 * call. On any AI failure the original description is left untouched and an
 * explicit error is returned.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = refineRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ message: parsed.error.issues[0]?.message ?? 'Invalid refine request.' },
			{ status: 400 }
		);
	}

	try {
		const result = await refineDescription(
			parsed.data.description,
			parsed.data.mode,
			parsed.data.instruction
		);
		if (!result.refined) {
			return json({ message: 'The model returned an empty result. Try again.' }, { status: 502 });
		}
		return json(result);
	} catch (e) {
		if (e instanceof AiError) return json({ message: e.message }, { status: 502 });
		throw e;
	}
};
