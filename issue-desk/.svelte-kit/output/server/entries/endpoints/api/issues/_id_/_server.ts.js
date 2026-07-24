import { a as get, i as ensureLoaded } from "../../../../../chunks/store.js";
import { json } from "@sveltejs/kit";
//#region src/routes/api/issues/[id]/+server.ts
/**
* GET /api/issues/<id> — resolve one issue's title and status. Used by a
* Checkpoint instance to turn a parent-issue id or a filed-bug id into a real
* title and link. 404 when the id is unknown.
*/
var GET = async ({ params }) => {
	await ensureLoaded();
	const issue = get(params.id);
	if (!issue) return json({ message: `Issue ${params.id} not found.` }, { status: 404 });
	return json({ issue: {
		id: issue.id,
		title: issue.title,
		status: issue.status,
		appId: issue.appId
	} });
};
//#endregion
export { GET };
