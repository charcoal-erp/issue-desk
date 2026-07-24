import { I as users, a as createCase, p as ensureLoaded } from "../../../../../chunks/checkpoint.js";
import { a as parseCasesJson, i as parseCasesCsv } from "../../../../../chunks/casesIO.js";
import { json } from "@sveltejs/kit";
//#region src/routes/api/import/cases/+server.ts
function actor(cookies) {
	const id = cookies.get("checkpoint_user");
	return users().some((u) => u.id === id) ? id : users()[0]?.id ?? "system";
}
/** POST /api/import/cases { format: 'json'|'csv', content: string } */
var POST = async ({ request, cookies }) => {
	await ensureLoaded();
	const body = await request.json().catch(() => ({}));
	const format = body.format === "csv" ? "csv" : "json";
	const content = String(body.content ?? "");
	const inputs = format === "csv" ? parseCasesCsv(content) : parseCasesJson(content);
	const created = [];
	let skipped = 0;
	for (const input of inputs) try {
		const c = await createCase(input, actor(cookies));
		created.push(c.id);
	} catch {
		skipped++;
	}
	return json({
		createdCount: created.length,
		created,
		skipped,
		parsed: inputs.length
	});
};
//#endregion
export { POST };
