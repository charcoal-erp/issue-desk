import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import { parseCasesCsv, parseCasesJson } from '$lib/server/checkpoint/casesIO';

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('checkpoint_user');
	return store.users().some((u) => u.id === id) ? id! : (store.users()[0]?.id ?? 'system');
}

/** POST /api/import/cases { format: 'json'|'csv', content: string } */
export const POST: RequestHandler = async ({ request, cookies }) => {
	await cp.ensureLoaded();
	const body = await request.json().catch(() => ({}));
	const format = body.format === 'csv' ? 'csv' : 'json';
	const content = String(body.content ?? '');

	const inputs = format === 'csv' ? parseCasesCsv(content) : parseCasesJson(content);
	const created: string[] = [];
	let skipped = 0;
	for (const input of inputs) {
		try {
			const c = await cp.createCase(input, actor(cookies));
			created.push(c.id);
		} catch {
			skipped++;
		}
	}
	return json({ createdCount: created.length, created, skipped, parsed: inputs.length });
};
