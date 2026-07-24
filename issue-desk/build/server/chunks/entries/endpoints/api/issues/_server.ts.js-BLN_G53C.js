import { b as private_env } from '../../../../chunks/shared-server.js-9-2j12mp.js';
import { e as ensureLoaded, l as list, h as createIssueSchema, u as users, i as create } from '../../../../chunks/store.js-B62sRqIC.js';
import { j as json } from '../../../../chunks/utils.js-C3Eckavg.js';
import '../../../../chunks/types.js-CwJArkfF.js';
import '../../../../chunks/paths.js-Erst5pJ8.js';
import 'node:path';
import 'node:fs/promises';
import 'uuid';
import 'zod';
import '../../../../chunks/shared.js-By7i_rqW.js';
import '../../../../chunks/server.js-BMijsOvr.js';

//#region src/routes/api/issues/+server.ts
/**
* JSON issue API. Used by the Python simulators (`simulators/`) to populate
* test issues, and by a Checkpoint instance over HTTP to file a bug from a
* failure and to offer a parent-issue picker.
*
* Optionally guarded: if ISSUEDESK_INGEST_TOKEN is set, POST requires it as a
* bearer token, so only a trusted caller can file issues. Unset = open on the
* LAN, as before.
*/
/** Returns an error Response if a token is required and missing/wrong, else null. */
function tokenError(request) {
	const required = private_env.ISSUEDESK_INGEST_TOKEN?.trim();
	if (!required) return null;
	if ((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() === required) return null;
	return json({ message: "Missing or invalid ingest token." }, { status: 401 });
}
/**
* GET /api/issues[?app=<id>] — a lightweight list for the Checkpoint
* parent-issue picker: the open issues, most recent first.
*/
var GET = async ({ url }) => {
	await ensureLoaded();
	const { rows } = list({
		appId: url.searchParams.get("app") ?? void 0,
		status: ["open"]
	});
	return json({ issues: rows.map((i) => ({
		id: i.id,
		title: i.title,
		appId: i.appId,
		status: i.status
	})) });
};
/**
* POST /api/issues
* { ...CreateIssueInput, reporterId, draftId? }
*/
var POST = async ({ request }) => {
	const denied = tokenError(request);
	if (denied) return denied;
	await ensureLoaded();
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ message: "Body must be JSON." }, { status: 400 });
	}
	const parsed = createIssueSchema.safeParse(body);
	if (!parsed.success) return json({
		message: "Invalid issue",
		issues: parsed.error.issues
	}, { status: 400 });
	const reporterId = String(body.reporterId ?? "");
	if (!users().some((u) => u.id === reporterId)) return json({ message: `Unknown reporter "${reporterId}".` }, { status: 400 });
	if (parsed.data.assigneeId && !users().some((u) => u.id === parsed.data.assigneeId)) return json({ message: `Unknown assignee "${parsed.data.assigneeId}".` }, { status: 400 });
	const draftId = body.draftId ? String(body.draftId) : void 0;
	try {
		return json({ issue: await create(parsed.data, reporterId, draftId) }, { status: 201 });
	} catch (e) {
		return json({ message: e.message }, { status: 400 });
	}
};

export { GET, POST };
//# sourceMappingURL=_server.ts.js-BLN_G53C.js.map
