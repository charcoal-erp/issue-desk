import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { notFound, toDetail } from '$lib/server/api/agent';
import { saveUploads, UploadError } from '$lib/server/uploads';
import * as store from '$lib/server/store';

/**
 * POST /api/agent/issues/<id>/attachments — multipart/form-data
 *   files=<binary>    one or more, repeatable
 *   comment=<text>    optional note recorded alongside them
 *
 * How an automated client files visual evidence against an issue that already
 * exists: a screenshot of the failure it just reproduced, or proof that a fix
 * works before handing the issue to a tester. Files go through exactly the same
 * validation, sniffing and renaming as a browser upload, and land in the issue's
 * gallery like any other attachment.
 *
 * Attaching to a *new* issue does not need this route: upload against
 * `issueId=pending` with a `draftId` via POST /api/uploads, then pass the same
 * `draftId` to POST /api/issues.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	await store.ensureLoaded();
	const user = locals.user!;

	const issue = store.get(params.id);
	if (!issue) return notFound(params.id);

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json(
			{ message: 'Send multipart/form-data with one or more "files" parts.' },
			{ status: 400 }
		);
	}

	const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
	if (files.length === 0) {
		return json({ message: 'No files in the request — attach them as "files".' }, { status: 400 });
	}

	try {
		const added = await saveUploads(
			files,
			{ appId: issue.appId, issueId: issue.id },
			user.id,
			issue.attachments.length
		);
		// Re-read: saving the files took time, and the issue may have moved on.
		const current = store.get(params.id) ?? issue;
		const updated = await store.update(
			params.id,
			{ attachments: [...current.attachments, ...added] },
			user.id
		);
		const note = String(form.get('comment') ?? '').trim();
		const issueAfter = note ? await store.comment(params.id, note, user.id) : updated;
		return json({ issue: toDetail(issueAfter), added }, { status: 201 });
	} catch (e) {
		if (e instanceof UploadError) return json({ message: e.message }, { status: 400 });
		throw e;
	}
};
