import { _ as saveUploads, a as get, g as UploadError, h as users, i as ensureLoaded, t as applications } from "../../../../chunks/store.js";
import { json } from "@sveltejs/kit";
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
//#endregion
export { POST };
