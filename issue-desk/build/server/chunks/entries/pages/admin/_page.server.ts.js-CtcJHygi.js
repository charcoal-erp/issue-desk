import { e as ensureLoaded, m as moduleRefSchema, j as applicationSchema, k as upsertApplication, o as userSchema, p as upsertUser, l as list } from '../../../chunks/store.js-B62sRqIC.js';
import { y as fail } from '../../../chunks/utils.js-C3Eckavg.js';
import { z } from 'zod';

//#region src/routes/admin/+page.server.ts
var load = async () => {
	await ensureLoaded();
	const all = list({}).rows;
	const perApp = {};
	const perUser = {};
	for (const issue of all) {
		perApp[issue.appId] ??= {
			open: 0,
			total: 0
		};
		perApp[issue.appId].total += 1;
		if (issue.status === "open") perApp[issue.appId].open += 1;
		perUser[issue.reporterId] ??= {
			reported: 0,
			assigned: 0
		};
		perUser[issue.reporterId].reported += 1;
		if (issue.assigneeId) {
			perUser[issue.assigneeId] ??= {
				reported: 0,
				assigned: 0
			};
			perUser[issue.assigneeId].assigned += 1;
		}
	}
	return {
		perApp,
		perUser
	};
};
var actions = {
	upsertUser: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		const parsed = userSchema.safeParse({
			id: String(form.get("id") || "").trim(),
			name: String(form.get("name") || "").trim(),
			role: String(form.get("role") || "").trim() || void 0,
			avatarColor: String(form.get("avatarColor") || "").trim() || void 0,
			assignable: form.get("assignable") === "on"
		});
		if (!parsed.success) return fail(400, { message: parsed.error.issues[0]?.message ?? "Invalid user" });
		await upsertUser(parsed.data);
		return { saved: parsed.data.id };
	},
	upsertApplication: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		let modules = [];
		try {
			modules = JSON.parse(String(form.get("modules") || "[]"));
		} catch {
			return fail(400, { message: "Modules must be valid JSON." });
		}
		const modulesParsed = z.array(moduleRefSchema).safeParse(modules);
		if (!modulesParsed.success) return fail(400, { message: `Modules JSON: ${modulesParsed.error.issues[0]?.message ?? "invalid shape"}` });
		const parsed = applicationSchema.safeParse({
			id: String(form.get("id") || "").trim(),
			code: String(form.get("code") || "").trim().toUpperCase(),
			name: String(form.get("name") || "").trim(),
			color: String(form.get("color") || "").trim() || void 0,
			modules: modulesParsed.data
		});
		if (!parsed.success) {
			const first = parsed.error.issues[0];
			return fail(400, { message: `${String(first?.path[0] ?? "")}: ${first?.message ?? "Invalid application"}` });
		}
		await upsertApplication(parsed.data);
		return { saved: parsed.data.id };
	}
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	actions: actions,
	load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-CtcJHygi.js.map
