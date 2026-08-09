import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as store from '$lib/server/store';
import { saveUploads, UploadError } from '$lib/server/uploads';

/**
 * POST /api/uploads (multipart, §12): appId + issueId ('pending' + draftId for
 * pre-create) + file blobs → validated, sanitised, saved → Attachment[].
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	await store.ensureLoaded();
	const form = await request.formData();
	const appId = String(form.get('appId') ?? '');
	const issueId = String(form.get('issueId') ?? 'pending');
	const draftId = String(form.get('draftId') ?? '');
	const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

	if (!store.applications().some((a) => a.id === appId)) {
		return json({ message: 'Unknown application.' }, { status: 400 });
	}
	if (files.length === 0) {
		return json({ message: 'No files in the request.' }, { status: 400 });
	}
	const existing = issueId !== 'pending' ? (store.get(issueId)?.attachments.length ?? 0) : 0;
	const uploadedBy = locals.user?.id ?? 'system';

	try {
		const attachments = await saveUploads(
			files,
			{ appId, issueId, draftId: draftId || undefined },
			uploadedBy,
			existing
		);
		return json({ attachments });
	} catch (e) {
		if (e instanceof UploadError) return json({ message: e.message }, { status: 400 });
		throw e;
	}
};
