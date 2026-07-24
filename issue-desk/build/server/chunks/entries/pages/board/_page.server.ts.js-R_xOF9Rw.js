import { e as ensureLoaded, l as list } from '../../../chunks/store.js-B62sRqIC.js';
import { p as parseFilter } from '../../../chunks/filter.js-CR2QdRHg.js';

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

var _page_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-R_xOF9Rw.js.map
