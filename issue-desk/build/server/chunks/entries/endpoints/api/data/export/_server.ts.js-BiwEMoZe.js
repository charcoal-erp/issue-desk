import { e as ensureLoaded } from '../../../../../chunks/store.js-B62sRqIC.js';
import { b as buildDataExport } from '../../../../../chunks/archive.js-FuPuki0K.js';
import '../../../../../chunks/types.js-CwJArkfF.js';
import '../../../../../chunks/paths.js-Erst5pJ8.js';
import '../../../../../chunks/shared-server.js-9-2j12mp.js';
import 'node:path';
import 'node:fs/promises';
import 'uuid';
import 'zod';
import 'fflate';

//#region src/routes/api/data/export/+server.ts
/**
* GET /api/data/export — download a full IssueDesk data snapshot as a zip
* (config + issues + uploads, with a manifest). Checkpoint content excluded.
* Also curl-friendly: `curl -o issuedesk-data.zip <base>/api/data/export`.
*/
var GET = async () => {
	await ensureLoaded();
	const { zip, manifest } = await buildDataExport();
	const stamp = manifest.exportedAt.slice(0, 19).replace(/[T:]/g, "-");
	return new Response(new Uint8Array(zip), { headers: {
		"content-type": "application/zip",
		"content-length": String(zip.byteLength),
		"content-disposition": `attachment; filename="issuedesk-data-${stamp}.zip"`
	} });
};

export { GET };
//# sourceMappingURL=_server.ts.js-BiwEMoZe.js.map
