import { i as ensureLoaded } from "../../../../../chunks/store.js";
import { n as buildDataExport } from "../../../../../chunks/archive.js";
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
//#endregion
export { GET };
