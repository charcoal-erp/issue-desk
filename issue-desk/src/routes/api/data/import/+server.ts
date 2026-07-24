import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as store from '$lib/server/store';
import { ImportValidationError, importDataArchive } from '$lib/server/data/archive';

/**
 * POST /api/data/import — restore an IssueDesk data snapshot produced by
 * /api/data/export. Accepts multipart/form-data (field "file") or a raw
 * application/zip body. REPLACES config/issues/uploads (previous state is kept
 * in .backups/pre-import-<stamp>/), then reloads the in-memory store.
 */
export const POST: RequestHandler = async ({ request }) => {
	await store.ensureLoaded();

	let bytes: Uint8Array;
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('multipart/form-data')) {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File)) {
			return json({ message: 'Attach the export zip as form field "file".' }, { status: 400 });
		}
		bytes = new Uint8Array(await file.arrayBuffer());
	} else {
		bytes = new Uint8Array(await request.arrayBuffer());
	}
	if (bytes.byteLength === 0) {
		return json({ message: 'Empty request body — upload an export zip.' }, { status: 400 });
	}

	try {
		const summary = await importDataArchive(bytes);
		await store.reload();
		return json(summary);
	} catch (e) {
		if (e instanceof ImportValidationError) {
			return json({ message: e.message }, { status: 400 });
		}
		console.error('[issuedesk] Data import failed:', e);
		return json({ message: `Import failed: ${(e as Error).message}` }, { status: 500 });
	}
};
