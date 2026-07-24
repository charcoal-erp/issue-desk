import { P as PRIORITIES, S as STATUSES } from '../../chunks/types.js-CwJArkfF.js';
import { e as ensureLoaded, c as update, d as comment, f as remove, g as updateIssueSchema, h as createIssueSchema, i as create, l as list, u as users } from '../../chunks/store.js-B62sRqIC.js';
import { p as parseFilter } from '../../chunks/filter.js-CR2QdRHg.js';
import { y as fail } from '../../chunks/utils.js-C3Eckavg.js';

//#region src/routes/+page.server.ts
var load = async ({ url }) => {
	await ensureLoaded();
	const filter = parseFilter(url.searchParams);
	const { rows, total } = list(filter);
	const all = list({}).rows;
	const counts = {
		total: all.length,
		byApp: {},
		byStatus: {},
		byPriority: {}
	};
	for (const issue of all) {
		counts.byApp[issue.appId] = (counts.byApp[issue.appId] ?? 0) + 1;
		counts.byStatus[issue.status] = (counts.byStatus[issue.status] ?? 0) + 1;
		counts.byPriority[issue.priority] = (counts.byPriority[issue.priority] ?? 0) + 1;
	}
	return {
		rows,
		total,
		filter,
		counts
	};
};
function actor(cookies) {
	const id = cookies.get("issuedesk_user");
	return users().some((u) => u.id === id) ? id : users()[0]?.id ?? "system";
}
function parseIssueForm(form) {
	let attachments = [];
	try {
		attachments = JSON.parse(String(form.get("attachments") || "[]"));
	} catch {
		attachments = [];
	}
	return {
		type: String(form.get("type") || "bug"),
		title: String(form.get("title") || ""),
		description: String(form.get("description") || ""),
		appId: String(form.get("appId") || ""),
		moduleId: String(form.get("moduleId") || ""),
		page: String(form.get("page") || "") || void 0,
		form: String(form.get("form") || "") || void 0,
		priority: String(form.get("priority") || "high"),
		status: String(form.get("status") || "open"),
		assigneeId: String(form.get("assigneeId") || "") || void 0,
		tags: String(form.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean),
		attachments
	};
}
function fieldErrors(error) {
	const out = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? "form");
		out[key] ??= issue.message;
	}
	return out;
}
var actions = {
	createIssue: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const parsed = createIssueSchema.safeParse(parseIssueForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		const draftId = String(form.get("draftId") || "") || void 0;
		try {
			return { issue: await create(parsed.data, actor(cookies), draftId) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	updateIssue: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		const parsed = updateIssueSchema.safeParse(parseIssueForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			return { issue: await update(id, parsed.data, actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	deleteIssue: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		try {
			await remove(id, actor(cookies));
			return { deleted: id };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	comment: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		const message = String(form.get("message") || "").trim();
		if (!message) return fail(400, { fieldErrors: { message: "Write a comment first." } });
		try {
			return { issue: await comment(id, message, actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	changeStatus: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		const status = String(form.get("status") || "");
		if (!STATUSES.includes(status)) return fail(400, { fieldErrors: { status: "Unknown status." } });
		try {
			return { issue: await update(id, { status }, actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	changePriority: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		const priority = String(form.get("priority") || "");
		if (!PRIORITIES.includes(priority)) return fail(400, { fieldErrors: { priority: "Unknown priority." } });
		try {
			return { issue: await update(id, { priority }, actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	changeAssignee: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		const assigneeId = String(form.get("assigneeId") || "") || void 0;
		try {
			return { issue: await update(id, { assigneeId }, actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	}
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	actions: actions,
	load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-0X71P1Md.js.map
