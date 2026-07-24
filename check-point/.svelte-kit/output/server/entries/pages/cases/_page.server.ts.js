import { I as users, P as applications, T as runners, _ as lastResultForCase, a as createCase, c as deleteCase, g as getSuite, j as updateCase, k as suites, m as getCase, p as ensureLoaded, r as cases, v as listCases, w as runner, y as nextCaseId, z as createTestCaseInputSchema } from "../../../chunks/checkpoint.js";
import { o as TEST_CASE_STATUSES, r as RESULT_STATUSES, s as TEST_KINDS } from "../../../chunks/types.js";
import { a as listIssues, r as getIssue } from "../../../chunks/issuedesk.js";
import { fail } from "@sveltejs/kit";
//#region src/routes/cases/+page.server.ts
function actor(cookies) {
	const id = cookies.get("checkpoint_user");
	return users().some((u) => u.id === id) ? id : users()[0]?.id ?? "system";
}
function parseFilter(params) {
	const f = {};
	const q = params.get("q")?.trim();
	if (q) f.q = q;
	if (params.get("app")) f.appId = params.get("app");
	const kind = params.getAll("kind").filter((k) => TEST_KINDS.includes(k));
	if (kind.length) f.kind = kind;
	const status = params.getAll("status").filter((s) => TEST_CASE_STATUSES.includes(s));
	if (status?.length) f.status = status;
	const result = params.getAll("result").filter((r) => r === "none" || RESULT_STATUSES.includes(r));
	if (result.length) f.lastResult = result;
	return f;
}
var load = async ({ url }) => {
	await ensureLoaded();
	const filter = parseFilter(url.searchParams);
	const rows = listCases(filter).map((c) => {
		const last = lastResultForCase(c.id);
		return {
			id: c.id,
			title: c.title,
			appCode: c.appCode,
			moduleName: c.target.moduleName,
			pageName: c.target.pageName,
			specPath: c.specPath,
			kind: c.kind,
			priority: c.priority,
			status: c.status,
			parentIssueId: c.parentIssueId,
			lastResult: last?.result.status ?? "none"
		};
	});
	const all = cases();
	const counts = {
		byApp: {},
		byKind: {},
		byStatus: {},
		byResult: {}
	};
	for (const c of all) {
		counts.byApp[c.appId] = (counts.byApp[c.appId] ?? 0) + 1;
		counts.byKind[c.kind] = (counts.byKind[c.kind] ?? 0) + 1;
		counts.byStatus[c.status] = (counts.byStatus[c.status] ?? 0) + 1;
		const key = lastResultForCase(c.id)?.result.status ?? "none";
		counts.byResult[key] = (counts.byResult[key] ?? 0) + 1;
	}
	const runners$1 = runners().map((r) => ({
		id: r.id,
		name: r.name,
		kind: r.kind,
		command: r.command,
		workingDir: r.workingDir,
		reportFormat: r.reportFormat,
		reportPath: r.reportPath,
		matchStrategy: r.matchStrategy
	}));
	const suites$1 = suites().map((s) => ({
		id: s.id,
		appId: s.appId,
		name: s.name
	}));
	const issues = await listIssues();
	const nextCaseIds = Object.fromEntries(applications().map((a) => [a.id, nextCaseId(a.id)]));
	const drawerId = url.searchParams.get("case");
	let drawer = null;
	if (drawerId) {
		const c = getCase(drawerId);
		if (c) {
			const last = lastResultForCase(c.id);
			const runner$1 = c.runnerId ? runner(c.runnerId) : void 0;
			const parent = c.parentIssueId ? await getIssue(c.parentIssueId) : null;
			drawer = {
				case: c,
				last: last ? {
					status: last.result.status,
					message: last.result.message,
					stack: last.result.stack,
					artifacts: last.result.artifacts,
					durationMs: last.result.durationMs,
					runId: last.run.id
				} : null,
				runner: runner$1 ? {
					name: runner$1.name,
					language: runner$1.language,
					command: runner$1.command,
					workingDir: runner$1.workingDir,
					reportFormat: runner$1.reportFormat,
					matchStrategy: runner$1.matchStrategy
				} : null,
				parentTitle: parent?.title ?? null,
				suites: c.suiteIds.map((id) => getSuite(id)).filter(Boolean).map((s) => ({
					id: s.id,
					name: s.name
				})),
				filedIssues: c.issueIds
			};
		}
	}
	return {
		rows,
		total: rows.length,
		filter,
		counts,
		runners: runners$1,
		suites: suites$1,
		issues,
		nextCaseIds,
		drawer
	};
};
function parseSteps(raw) {
	try {
		const arr = JSON.parse(raw || "[]");
		if (!Array.isArray(arr)) return [];
		return arr.map((s) => ({
			action: String(s.action ?? ""),
			expected: String(s.expected ?? "")
		})).filter((s) => s.action || s.expected);
	} catch {
		return [];
	}
}
function parseJsonArray(raw) {
	try {
		const arr = JSON.parse(String(raw ?? "[]"));
		return Array.isArray(arr) ? arr.map(String) : [];
	} catch {
		return [];
	}
}
function parseCaseForm(form) {
	const manual = String(form.get("kind") || "manual") === "manual";
	return {
		appId: String(form.get("appId") || ""),
		moduleId: String(form.get("moduleId") || ""),
		page: String(form.get("page") || "") || void 0,
		form: String(form.get("form") || "") || void 0,
		title: String(form.get("title") || ""),
		preconditions: String(form.get("preconditions") || "") || void 0,
		steps: parseSteps(String(form.get("steps") || "[]")),
		priority: String(form.get("priority") || "medium"),
		status: String(form.get("status") || "active"),
		tags: String(form.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean),
		kind: String(form.get("kind") || "manual"),
		runnerId: manual ? null : String(form.get("runnerId") || "") || null,
		specPath: manual ? null : String(form.get("specPath") || "") || null,
		externalTestId: manual ? null : String(form.get("externalTestId") || "") || null,
		parentIssueId: String(form.get("parentIssueId") || "") || null,
		suiteIds: parseJsonArray(form.get("suiteIds"))
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
	upsertCase: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "") || void 0;
		const parsed = createTestCaseInputSchema.safeParse(parseCaseForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			return { case: id ? await updateCase(id, parsed.data, actor(cookies)) : await createCase(parsed.data, actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	deprecateCase: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		try {
			await updateCase(id, { status: "deprecated" }, actor(cookies));
			return { deprecated: id };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	deleteCase: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		try {
			await deleteCase(id);
			return { deleted: id };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	}
};
//#endregion
export { actions, load };
