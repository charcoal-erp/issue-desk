import { p as ensureLoaded, v as listCases } from "../../../../../chunks/checkpoint.js";
import { o as TEST_CASE_STATUSES, r as RESULT_STATUSES, s as TEST_KINDS } from "../../../../../chunks/types.js";
import { n as casesToJson, r as casesToMarkdown, t as casesToCsv } from "../../../../../chunks/casesIO.js";
//#region src/routes/api/export/cases/+server.ts
/** GET /api/export/cases?format=json|csv|md&app=&kind=&status=&result=&q= */
var GET = async ({ url }) => {
	await ensureLoaded();
	const format = url.searchParams.get("format") ?? "json";
	const kind = url.searchParams.getAll("kind").filter((k) => TEST_KINDS.includes(k));
	const status = url.searchParams.getAll("status").filter((s) => TEST_CASE_STATUSES.includes(s));
	const result = url.searchParams.getAll("result").filter((r) => r === "none" || RESULT_STATUSES.includes(r));
	const cases = listCases({
		q: url.searchParams.get("q") ?? void 0,
		appId: url.searchParams.get("app") ?? void 0,
		kind: kind.length ? kind : void 0,
		status: status.length ? status : void 0,
		lastResult: result.length ? result : void 0
	});
	let body;
	let contentType;
	let filename;
	if (format === "csv") {
		body = casesToCsv(cases);
		contentType = "text/csv";
		filename = "cases.csv";
	} else if (format === "md") {
		body = casesToMarkdown(cases);
		contentType = "text/markdown";
		filename = "cases.md";
	} else {
		body = casesToJson(cases);
		contentType = "application/json";
		filename = "cases.json";
	}
	return new Response(body, { headers: {
		"content-type": `${contentType}; charset=utf-8`,
		"content-disposition": `attachment; filename="${filename}"`
	} });
};
//#endregion
export { GET };
