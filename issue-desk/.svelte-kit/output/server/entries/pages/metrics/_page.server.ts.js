import { i as ensureLoaded, o as list } from "../../../chunks/store.js";
//#region src/routes/metrics/+page.server.ts
var load = async () => {
	await ensureLoaded();
	return { issues: list({
		sort: "updated",
		dir: "desc"
	}).rows };
};
//#endregion
export { load };
