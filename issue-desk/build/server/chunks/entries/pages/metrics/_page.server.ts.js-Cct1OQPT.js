import { e as ensureLoaded, l as list } from '../../../chunks/store.js-B62sRqIC.js';

//#region src/routes/metrics/+page.server.ts
var load = async () => {
	await ensureLoaded();
	return { issues: list({
		sort: "updated",
		dir: "desc"
	}).rows };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-Cct1OQPT.js.map
