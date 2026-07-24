import { e as ensureLoaded, n as createCase, u as users } from '../../../../../chunks/checkpoint.js-B-fQV2Ix.js';
import { p as parseCasesCsv, d as parseCasesJson } from '../../../../../chunks/casesIO.js-BKmEPm8n.js';
import { j as json } from '../../../../../chunks/utils.js-r4C_CEqs.js';
import '../../../../../chunks/shared-server.js-9-2j12mp.js';
import '../../../../../chunks/types.js-BxhiHiuh.js';
import 'node:fs/promises';
import 'uuid';
import 'node:path';
import 'zod';
import '../../../../../chunks/priority.js-BTgJFiQJ.js';
import '../../../../../chunks/meta.js-Drcdnnre.js';
import '../../../../../chunks/shared.js-C8TgK89F.js';
import '../../../../../chunks/server.js-CDtqtqwP.js';

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

export { POST };
//# sourceMappingURL=_server.ts.js-Cb7NXXIL.js.map
