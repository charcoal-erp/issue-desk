import { c as reload, i as ensureLoaded } from "../../../../../chunks/store.js";
import { r as importDataArchive, t as ImportValidationError } from "../../../../../chunks/archive.js";
import { json } from "@sveltejs/kit";
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
//#endregion
export { POST };
