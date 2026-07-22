import { deserialize } from '$app/forms';
import type { ActionResult } from '@sveltejs/kit';

/**
 * Invoke a named form action on the IssueDesk (/desk) page from anywhere in the app
 * (used for quick mutations like board drag or "advance status" where a
 * visible <form> isn't practical).
 */
export async function postAction(
	name: string,
	data: Record<string, string>
): Promise<ActionResult> {
	const body = new FormData();
	for (const [k, v] of Object.entries(data)) body.set(k, v);
	const res = await fetch(`/desk?/${name}`, {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	return deserialize(await res.text());
}
