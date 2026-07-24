import { e as ensureLoaded, b as applications, q as get, u as users, B as saveUploads, U as UploadError } from '../../../../chunks/store.js-B62sRqIC.js';
import { j as json } from '../../../../chunks/utils.js-C3Eckavg.js';
import '../../../../chunks/types.js-CwJArkfF.js';
import '../../../../chunks/paths.js-Erst5pJ8.js';
import '../../../../chunks/shared-server.js-9-2j12mp.js';
import 'node:path';
import 'node:fs/promises';
import 'uuid';
import 'zod';
import '../../../../chunks/shared.js-By7i_rqW.js';
import '../../../../chunks/server.js-BMijsOvr.js';

//#region src/routes/api/uploads/+server.ts
/**
* POST /api/uploads (multipart, §12): appId + issueId ('pending' + draftId for
* pre-create) + file blobs → validated, sanitised, saved → Attachment[].
*/
var POST = async ({ request, cookies }) => {
	await ensureLoaded();
	const form = await request.formData();
	const appId = String(form.get("appId") ?? "");
	const issueId = String(form.get("issueId") ?? "pending");
	const draftId = String(form.get("draftId") ?? "");
	const files = form.getAll("files").filter((f) => f instanceof File && f.size > 0);
	if (!applications().some((a) => a.id === appId)) return json({ message: "Unknown application." }, { status: 400 });
	if (files.length === 0) return json({ message: "No files in the request." }, { status: 400 });
	const existing = issueId !== "pending" ? get(issueId)?.attachments.length ?? 0 : 0;
	const uploadedBy = cookies.get("issuedesk_user") || users()[0]?.id || "system";
	try {
		return json({ attachments: await saveUploads(files, {
			appId,
			issueId,
			draftId: draftId || void 0
		}, uploadedBy, existing) });
	} catch (e) {
		if (e instanceof UploadError) return json({ message: e.message }, { status: 400 });
		throw e;
	}
};

export { POST };
//# sourceMappingURL=_server.ts.js-CrycsyFS.js.map
