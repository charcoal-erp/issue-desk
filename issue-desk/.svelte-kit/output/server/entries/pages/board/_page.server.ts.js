import { i as ensureLoaded, o as list } from "../../../chunks/store.js";
import { n as parseFilter } from "../../../chunks/filter.js";
//#region src/routes/board/+page.server.ts
var load = async ({ url }) => {
	await ensureLoaded();
	const filter = parseFilter(url.searchParams);
	delete filter.page;
	delete filter.pageSize;
	const { rows, total } = list(filter);
	return {
		rows,
		total,
		filter
	};
};
//#endregion
export { load };
