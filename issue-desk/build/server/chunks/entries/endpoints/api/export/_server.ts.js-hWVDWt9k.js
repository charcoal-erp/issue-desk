import { e as publicBaseUrl } from '../../../../chunks/paths.js-Erst5pJ8.js';
import { e as ensureLoaded, l as list, u as users, b as applications } from '../../../../chunks/store.js-B62sRqIC.js';
import { p as parseFilter } from '../../../../chunks/filter.js-CR2QdRHg.js';
import { t as toMarkdown, a as absolutise, u as userName } from '../../../../chunks/toMarkdown.js-BIa1Cvqp.js';
import '../../../../chunks/shared-server.js-9-2j12mp.js';
import 'node:path';
import '../../../../chunks/types.js-CwJArkfF.js';
import 'node:fs/promises';
import 'uuid';
import 'zod';

//#region src/lib/export/toJson.ts
/** Compact machine-friendly export (§14.1). */
function toJsonExport(rows, ctx) {
	const f = ctx.filter;
	return {
		generatedAt: ctx.generatedAt.toISOString(),
		filter: {
			appId: f.appId || void 0,
			moduleId: f.moduleId || void 0,
			status: f.status?.length ? f.status : void 0,
			priority: f.priority?.length ? f.priority : void 0,
			type: f.type || void 0,
			q: f.q || void 0
		},
		count: rows.length,
		issues: rows.map((issue) => ({
			id: issue.id,
			type: issue.type,
			title: issue.title,
			app: issue.appName,
			module: issue.moduleName,
			page: issue.pagePath || issue.pageName || void 0,
			form: issue.formName || void 0,
			priority: issue.priority,
			status: issue.status,
			reporter: userName(ctx, issue.reporterId),
			assignee: userName(ctx, issue.assigneeId),
			description: issue.description,
			attachments: issue.attachments.map((a) => absolutise(ctx.baseUrl, a.url))
		}))
	};
}
function toJson(rows, ctx) {
	return JSON.stringify(toJsonExport(rows, ctx), null, 2);
}
//#endregion
//#region src/routes/api/export/+server.ts
/** GET /api/export?format=md|json&<same filter params as the table> (§14). */
var GET = async ({ url }) => {
	await ensureLoaded();
	const filter = parseFilter(url.searchParams);
	delete filter.page;
	delete filter.pageSize;
	const { rows } = list(filter);
	const ctx = {
		baseUrl: publicBaseUrl(),
		generatedAt: /* @__PURE__ */ new Date(),
		filter,
		apps: applications(),
		users: users()
	};
	if ((url.searchParams.get("format") === "json" ? "json" : "md") === "json") return new Response(toJson(rows, ctx), { headers: { "content-type": "application/json; charset=utf-8" } });
	return new Response(toMarkdown(rows, ctx), { headers: { "content-type": "text/markdown; charset=utf-8" } });
};

export { GET };
//# sourceMappingURL=_server.ts.js-hWVDWt9k.js.map
