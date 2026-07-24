import { e as ensureLoaded, r as reload } from '../../../../../chunks/store.js-B62sRqIC.js';
import { i as importDataArchive, I as ImportValidationError } from '../../../../../chunks/archive.js-FuPuki0K.js';
import { j as json } from '../../../../../chunks/utils.js-C3Eckavg.js';
import '../../../../../chunks/types.js-CwJArkfF.js';
import '../../../../../chunks/paths.js-Erst5pJ8.js';
import '../../../../../chunks/shared-server.js-9-2j12mp.js';
import 'node:path';
import 'node:fs/promises';
import 'uuid';
import 'zod';
import 'fflate';
import '../../../../../chunks/shared.js-By7i_rqW.js';
import '../../../../../chunks/server.js-BMijsOvr.js';

//#region src/routes/api/data/import/+server.ts
/**
* POST /api/data/import — restore an IssueDesk data snapshot produced by
* /api/data/export. Accepts multipart/form-data (field "file") or a raw
* application/zip body. REPLACES config/issues/uploads (previous state is kept
* in .backups/pre-import-<stamp>/), then reloads the in-memory store.
*/
var POST = async ({ request }) => {
	await ensureLoaded();
	let bytes;
	if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
		const file = (await request.formData()).get("file");
		if (!(file instanceof File)) return json({ message: "Attach the export zip as form field \"file\"." }, { status: 400 });
		bytes = new Uint8Array(await file.arrayBuffer());
	} else bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.byteLength === 0) return json({ message: "Empty request body — upload an export zip." }, { status: 400 });
	try {
		const summary = await importDataArchive(bytes);
		await reload();
		return json(summary);
	} catch (e) {
		if (e instanceof ImportValidationError) return json({ message: e.message }, { status: 400 });
		console.error("[issuedesk] Data import failed:", e);
		return json({ message: `Import failed: ${e.message}` }, { status: 500 });
	}
};

export { POST };
//# sourceMappingURL=_server.ts.js-BJwDw1u6.js.map
