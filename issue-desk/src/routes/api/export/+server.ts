import type { RequestHandler } from './$types';
import { parseFilter } from '$lib/filter';
import { toJson } from '$lib/export/toJson';
import { toMarkdown } from '$lib/export/toMarkdown';
import type { ExportContext } from '$lib/export/context';
import * as store from '$lib/server/store';
import { publicBaseUrl } from '$lib/server/fs/paths';

/** GET /api/export?format=md|json&<same filter params as the table> (§14). */
export const GET: RequestHandler = async ({ url }) => {
	await store.ensureLoaded();
	const filter = parseFilter(url.searchParams);
	// Export reflects the whole filtered set, never a pagination window.
	delete filter.page;
	delete filter.pageSize;
	const { rows } = store.list(filter);
	const ctx: ExportContext = {
		baseUrl: publicBaseUrl(),
		generatedAt: new Date(),
		filter,
		apps: store.applications(),
		users: store.users()
	};
	const format = url.searchParams.get('format') === 'json' ? 'json' : 'md';
	if (format === 'json') {
		return new Response(toJson(rows, ctx), {
			headers: { 'content-type': 'application/json; charset=utf-8' }
		});
	}
	return new Response(toMarkdown(rows, ctx), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
