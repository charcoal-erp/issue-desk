import { E as runs, I as users, N as updateSuite, P as applications, R as createSuiteInputSchema, T as runners, b as nextSuiteId, d as deleteSuite, f as duplicateSuite, g as getSuite, k as suites, m as getCase, p as ensureLoaded, r as cases, s as createSuite } from "../../../chunks/checkpoint.js";
import { l as timeAgo } from "../../../chunks/meta.js";
import { a as runCounts, o as runPassRate } from "../../../chunks/metrics.js";
import { r as matchesSuite } from "../../../chunks/catalogFilters.js";
import { r as suiteTone, t as kindCounts } from "../../../chunks/tone.js";
import { fail } from "@sveltejs/kit";
//#region src/routes/suites/+page.server.ts
function actor(cookies) {
	const id = cookies.get("checkpoint_user");
	return users().some((u) => u.id === id) ? id : users()[0]?.id ?? "system";
}
var load = async ({ url }) => {
	await ensureLoaded();
	const runs$1 = runs();
	const now = /* @__PURE__ */ new Date();
	const allCards = suites().map((s) => {
		const cases = s.caseIds.map((id) => getCase(id)).filter(Boolean);
		const allKinds = cases.map((c) => c.kind);
		const kinds = [...new Set(allKinds)];
		const manual = cases.filter((c) => c.kind === "manual").length;
		const suiteRun = runs$1.find((r) => r.suiteId === s.id);
		const suiteRuns = runs$1.filter((r) => r.suiteId === s.id);
		const counts = suiteRun ? runCounts(suiteRun) : null;
		return {
			id: s.id,
			appCode: s.appCode,
			appName: s.appName,
			name: s.name,
			description: s.description,
			defaultEnv: s.defaultEnv,
			tags: s.tags,
			kinds,
			tone: suiteTone(s.tags, kindCounts(allKinds)),
			total: cases.length,
			manual,
			automated: cases.length - manual,
			lastPassRate: suiteRun ? runPassRate(suiteRun) : null,
			lastRun: suiteRun && counts ? {
				runId: suiteRun.id,
				when: timeAgo(suiteRun.startedAt, now),
				...counts
			} : null,
			runCount: suiteRuns.length,
			archivedRuns: suiteRuns.filter((r) => r.archived).length
		};
	});
	const filter = {
		q: url.searchParams.get("q") ?? "",
		kind: url.searchParams.get("kind") ?? "",
		env: url.searchParams.get("env") ?? "",
		state: url.searchParams.get("state") ?? ""
	};
	const cards = allCards.filter((c) => matchesSuite(c, filter));
	const kindCountsAll = {};
	for (const c of allCards) for (const k of c.tone === "seed" ? ["seed", ...c.kinds] : c.kinds) kindCountsAll[k] = (kindCountsAll[k] ?? 0) + 1;
	const envs = [...new Set(allCards.map((c) => c.defaultEnv))].sort();
	const editId = url.searchParams.get("edit");
	const isNew = url.searchParams.has("new");
	let editor = null;
	if (isNew || editId) {
		const suite = editId ? getSuite(editId) : null;
		editor = {
			suite: suite ? {
				id: suite.id,
				name: suite.name,
				description: suite.description ?? "",
				appId: suite.appId,
				defaultEnv: suite.defaultEnv,
				tags: suite.tags,
				caseIds: suite.caseIds
			} : null,
			allCases: cases().map((c) => ({
				id: c.id,
				appId: c.appId,
				appCode: c.appCode,
				title: c.title,
				kind: c.kind,
				runnerId: c.runnerId
			})),
			runners: runners().map((r) => ({
				id: r.id,
				name: r.name,
				kind: r.kind,
				command: r.command,
				enabled: r.enabled
			})),
			nextId: suite ? null : nextSuiteId(applications()[0]?.id ?? "charcoal")
		};
	}
	return {
		cards,
		editor,
		filter,
		total: allCards.length,
		kindCounts: kindCountsAll,
		envs,
		failingTotal: allCards.filter((c) => c.lastRun && c.lastRun.fail + c.lastRun.blocked > 0).length
	};
};
function parseJsonArray(raw) {
	try {
		const arr = JSON.parse(String(raw ?? "[]"));
		return Array.isArray(arr) ? arr.map(String) : [];
	} catch {
		return [];
	}
}
function parseSuiteForm(form) {
	return {
		appId: String(form.get("appId") || ""),
		name: String(form.get("name") || ""),
		description: String(form.get("description") || "") || void 0,
		caseIds: parseJsonArray(form.get("caseIds")),
		defaultEnv: String(form.get("defaultEnv") || "local"),
		tags: String(form.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean)
	};
}
function fieldErrors(error) {
	const out = {};
	for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
	return out;
}
var actions = {
	upsertSuite: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "") || void 0;
		const parsed = createSuiteInputSchema.safeParse(parseSuiteForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			return { suite: id ? await updateSuite(id, parsed.data, actor(cookies)) : await createSuite(parsed.data, actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	duplicateSuite: async ({ request, cookies }) => {
		await ensureLoaded();
		const form = await request.formData();
		try {
			return { suite: await duplicateSuite(String(form.get("id") || ""), actor(cookies)) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	deleteSuite: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		try {
			await deleteSuite(String(form.get("id") || ""));
			return { deleted: true };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	}
};
//#endregion
export { actions, load };
