import { a as get, i as ensureLoaded } from "../../../../chunks/store.js";
import { error } from "@sveltejs/kit";
//#region src/routes/issues/[id]/+page.server.ts
var load = async ({ params }) => {
	await ensureLoaded();
	const issue = get(params.id);
	if (!issue) error(404, `Issue ${params.id} not found`);
	return { issue };
};
//#endregion
export { load };
