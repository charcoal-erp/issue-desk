import { E as runs, T as runners, k as suites, p as ensureLoaded, r as cases } from "../../../chunks/checkpoint.js";
import { a as runCounts } from "../../../chunks/metrics.js";
//#region src/lib/server/checkpoint/search.ts
var PER_GROUP = 25;
function matcher(q) {
	const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
	return (haystack) => {
		const h = haystack.toLowerCase();
		return terms.every((t) => h.includes(t));
	};
}
function group(key, label, hits) {
	return {
		key,
		label,
		hits: hits.slice(0, PER_GROUP),
		total: hits.length
	};
}
function searchCheckpoint(query) {
	const q = query.trim();
	if (!q) return [];
	const hit = matcher(q);
	const suites$1 = suites().filter((s) => hit(`${s.id} ${s.name} ${s.description ?? ""} ${s.tags.join(" ")} ${s.appName}`)).map((s) => ({
		id: s.id,
		title: s.name,
		sub: `${s.caseIds.length} case${s.caseIds.length === 1 ? "" : "s"} · ${s.appName}${s.tags.length ? ` · ${s.tags.slice(0, 3).join(" ")}` : ""}`,
		href: `/suites?edit=${s.id}`
	}));
	const cases$1 = cases().filter((c) => hit(`${c.id} ${c.title} ${c.specPath ?? ""} ${c.externalTestId ?? ""} ${c.target.moduleName} ${c.target.pageName ?? ""} ${c.target.formName ?? ""} ${c.tags.join(" ")}`)).map((c) => ({
		id: c.id,
		title: c.title,
		sub: [
			c.target.moduleName,
			c.target.pageName,
			c.target.formName
		].filter(Boolean).join(" › "),
		href: `/cases?case=${c.id}`,
		kind: c.kind
	}));
	const runs$1 = runs().filter((r) => hit(`${r.id} ${r.suiteName ?? ""} ${r.environment} ${r.appName} ${r.startedBy}`)).map((r) => {
		const counts = runCounts(r);
		return {
			id: r.id,
			title: r.suiteName ?? "Ad-hoc run",
			sub: `${counts.pass} pass · ${counts.fail} fail · ${r.environment}`,
			href: `/runs/${r.id}`,
			badge: r.archived ? "archived" : void 0
		};
	});
	const runners$1 = runners().filter((r) => hit(`${r.id} ${r.name} ${r.command} ${r.language} ${r.reportFormat} ${r.workingDir}`)).map((r) => ({
		id: r.id,
		title: r.name,
		sub: r.command || "performed by a person",
		href: "/runners",
		kind: r.kind,
		badge: r.enabled ? void 0 : "disabled"
	}));
	return [
		group("suites", "Suites", suites$1),
		group("cases", "Cases", cases$1),
		group("runs", "Runs", runs$1),
		group("runners", "Runners", runners$1)
	].filter((g) => g.total > 0);
}
//#endregion
//#region src/routes/search/+page.server.ts
var load = async ({ url }) => {
	await ensureLoaded();
	const q = url.searchParams.get("q") ?? "";
	const groups = searchCheckpoint(q);
	return {
		q,
		groups,
		total: groups.reduce((n, g) => n + g.total, 0)
	};
};
//#endregion
export { load };
