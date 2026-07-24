import type { RequestHandler } from './$types';
import * as store from '$lib/server/store';
import { buildDataExport } from '$lib/server/data/archive';

/**
 * GET /api/data/export — download a full IssueDesk data snapshot as a zip
 * (config + issues + uploads, with a manifest). Checkpoint content excluded.
 * Also curl-friendly: `curl -o issuedesk-data.zip <base>/api/data/export`.
 */
export const GET: RequestHandler = async () => {
	await store.ensureLoaded();
	const { zip, manifest } = await buildDataExport();
	const stamp = manifest.exportedAt.slice(0, 19).replace(/[T:]/g, '-');
	return new Response(new Uint8Array(zip), {
		headers: {
			'content-type': 'application/zip',
			'content-length': String(zip.byteLength),
			'content-disposition': `attachment; filename="issuedesk-data-${stamp}.zip"`
		}
	});
};
