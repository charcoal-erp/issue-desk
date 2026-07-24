import { e as ensureLoaded, B as pruneRuns, C as deleteRun, D as setRunArchived, j as runs, c as suites, g as getCase, u as users } from '../../../chunks/checkpoint.js-B-fQV2Ix.js';
import { t as timeAgo } from '../../../chunks/meta.js-Drcdnnre.js';
import { b as runCounts, e as runPassRate } from '../../../chunks/metrics.js-CTaKMGSY.js';
import { i as isRunActive } from '../../../chunks/runtime.js-BLT4IyOS.js';
import { y as fail } from '../../../chunks/utils.js-r4C_CEqs.js';

//#region src/lib/checkpoint/runFilters.ts
/**
* Age buckets for the run list. Run history accumulates one file per run
* forever, so the first question about an old run is almost always "how old" —
* and the cleanup offers the same cutoffs, so what you filter to is what you
* prune.
*
* This lives in $lib rather than beside the page because a `+page.server.ts`
* may only export `load` and `actions`; anything else is rejected at runtime.
*/
var AGE_WINDOWS = [
	{
		key: "today",
		label: "Today",
		hours: 24
	},
	{
		key: "week",
		label: "This week",
		hours: 168
	},
	{
		key: "month",
		label: "This month",
		hours: 720
	},
	{
		key: "older",
		label: "Older",
		hours: 720
	}
];
function cutoffIso(hours, now = /* @__PURE__ */ new Date()) {
	return (/* @__PURE__ */ new Date(now.getTime() - hours * 36e5)).toISOString();
}
/** Does this run fall in the named window? `all` and `archived` are pseudo-windows. */
function inWindow(run, age, now) {
	if (age === "all") return true;
	if (age === "archived") return !!run.archived;
	const window = AGE_WINDOWS.find((w) => w.key === age);
	if (!window) return true;
	const cutoff = cutoffIso(window.hours, now);
	return window.key === "older" ? run.startedAt < cutoff : run.startedAt >= cutoff;
}
//#endregion
//#region src/routes/runs/+page.server.ts
var load = async ({ url }) => {
	await ensureLoaded();
	const now = /* @__PURE__ */ new Date();
	const userName = (id) => users().find((u) => u.id === id)?.name ?? id;
	const age = url.searchParams.get("age") ?? "all";
	const suiteId = url.searchParams.get("suite") ?? "";
	const outcome = url.searchParams.get("outcome") ?? "";
	const all = runs();
	const filtered = all.filter((run) => {
		if (!inWindow(run, age, now)) return false;
		if (suiteId && run.suiteId !== suiteId) return false;
		if (outcome) {
			const counts = runCounts(run);
			if (outcome === "failing" && counts.fail === 0) return false;
			if (outcome === "passing" && counts.fail > 0) return false;
		}
		return true;
	});
	const project = (run) => {
		const kinds = [...new Set(run.results.map((r) => getCase(r.testCaseId)?.kind).filter(Boolean))];
		return {
			id: run.id,
			suiteId: run.suiteId ?? null,
			suiteName: run.suiteName ?? "Ad-hoc run",
			kinds,
			environment: run.environment,
			by: userName(run.startedBy),
			when: timeAgo(run.startedAt, now),
			startedAt: run.startedAt,
			counts: runCounts(run),
			passRate: runPassRate(run),
			archived: !!run.archived,
			running: isRunActive(run.id),
			completed: !!run.completedAt
		};
	};
	const scoped = all.filter((r) => (!suiteId || r.suiteId === suiteId) && (!outcome || true));
	const tabs = [
		{
			key: "all",
			label: "All",
			count: scoped.length
		},
		...AGE_WINDOWS.map((w) => ({
			key: w.key,
			label: w.label,
			count: scoped.filter((r) => inWindow(r, w.key, now)).length
		})),
		{
			key: "archived",
			label: "Archived",
			count: scoped.filter((r) => r.archived).length
		}
	];
	const suites$1 = suites().map((s) => ({
		id: s.id,
		name: s.name,
		runs: all.filter((r) => r.suiteId === s.id).length
	})).filter((s) => s.runs > 0).sort((a, b) => b.runs - a.runs);
	return {
		runs: filtered.map(project),
		tabs,
		suites: suites$1,
		filter: {
			age,
			suiteId,
			outcome
		},
		archivedTotal: all.filter((r) => r.archived).length
	};
};
var actions = {
	archiveRun: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "");
		const archived = form.get("archived") === "true";
		try {
			await setRunArchived(id, archived);
			return {
				ok: true,
				archived
			};
		} catch (e) {
			return fail(400, { error: e.message });
		}
	},
	deleteRun: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		try {
			await deleteRun(String(form.get("id") || ""));
			return { ok: true };
		} catch (e) {
			return fail(400, { error: e.message });
		}
	},
	/**
	* Prune by age, honouring the suite filter so one noisy suite can be cleaned
	* without touching the rest. Archived and still-running runs are never
	* deleted — that guarantee lives in the store, not here.
	*/
	cleanup: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		const hours = Number(form.get("hours") || 0);
		const date = String(form.get("date") || "");
		const suiteId = String(form.get("suite") || "") || void 0;
		let before;
		if (date) {
			const parsed = new Date(date);
			if (Number.isNaN(parsed.getTime())) return fail(400, { error: "Unusable date" });
			before = parsed.toISOString();
		} else if (hours > 0) before = cutoffIso(hours);
		else return fail(400, { error: "Choose an age or a date to clean up before" });
		return {
			ok: true,
			removed: (await pruneRuns({
				before,
				suiteId
			})).length
		};
	}
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	actions: actions,
	load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-BrPLD17S.js.map
