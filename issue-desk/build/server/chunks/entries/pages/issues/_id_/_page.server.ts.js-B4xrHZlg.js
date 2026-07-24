import { e as ensureLoaded, q as get } from '../../../../chunks/store.js-B62sRqIC.js';
import { v as error } from '../../../../chunks/utils.js-C3Eckavg.js';

//#region src/routes/issues/[id]/+page.server.ts
var load = async ({ params }) => {
	await ensureLoaded();
	const issue = get(params.id);
	if (!issue) error(404, `Issue ${params.id} not found`);
	return { issue };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-B4xrHZlg.js.map
