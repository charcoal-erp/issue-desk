import { e as ensureLoaded, w as deleteRunner, x as toggleRunner, y as createRunnerInputSchema, z as updateRunner, A as createRunner, j as runs, h as runners } from '../../../chunks/checkpoint.js-B-fQV2Ix.js';
import { f as formatDuration, m as matchStrategyLabel, t as timeAgo } from '../../../chunks/meta.js-Drcdnnre.js';
import { a as runnerHealth } from '../../../chunks/metrics.js-CTaKMGSY.js';
import { m as matchesRunner } from '../../../chunks/catalogFilters.js-GAdx040e.js';
import { y as fail } from '../../../chunks/utils.js-r4C_CEqs.js';

//#region src/routes/runners/+page.server.ts
var load = async ({ url }) => {
	await ensureLoaded();
	const runs$1 = runs();
	const now = /* @__PURE__ */ new Date();
	const allRunners = runners().map((r) => {
		const h = runnerHealth(r, runs$1);
		return {
			...r,
			matchLabel: matchStrategyLabel(r.matchStrategy),
			health: h.health,
			avgLabel: formatDuration(h.avgDurationMs),
			flakeRatePct: h.flakeRatePct,
			lastLabel: h.lastOutcome && h.lastInvocationAt ? `${timeAgo(h.lastInvocationAt, now)} · ${h.lastOutcome}` : "no runs"
		};
	});
	const filter = {
		q: url.searchParams.get("q") ?? "",
		kind: url.searchParams.get("kind") ?? "",
		lang: url.searchParams.get("lang") ?? "",
		enabled: url.searchParams.get("enabled") ?? "",
		health: url.searchParams.get("health") ?? ""
	};
	const runners$1 = allRunners.filter((r) => matchesRunner(r, filter));
	const tally = (pick) => {
		const out = {};
		for (const r of allRunners) out[pick(r)] = (out[pick(r)] ?? 0) + 1;
		return out;
	};
	return {
		runners: runners$1,
		filter,
		total: allRunners.length,
		kindCounts: tally((r) => r.kind),
		langCounts: tally((r) => r.language),
		disabledTotal: allRunners.filter((r) => !r.enabled).length
	};
};
function parseEnv(raw) {
	const out = {};
	for (const line of raw.split(/\r?\n/)) {
		const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (m) out[m[1]] = m[2];
	}
	return Object.keys(out).length ? out : void 0;
}
function parseRunnerForm(form) {
	const by = String(form.get("matchBy") || "nodeid");
	const matchStrategy = by === "annotation" ? {
		by: "annotation",
		tag: String(form.get("matchTag") || "@checkpoint")
	} : { by };
	const timeoutRaw = Number(form.get("timeoutSec"));
	return {
		name: String(form.get("name") || ""),
		kind: String(form.get("kind") || "api"),
		language: String(form.get("language") || "other"),
		command: String(form.get("command") || ""),
		workingDir: String(form.get("workingDir") || ""),
		env: parseEnv(String(form.get("env") || "")),
		reportFormat: String(form.get("reportFormat") || "junit-xml"),
		reportPath: String(form.get("reportPath") || ""),
		matchStrategy,
		timeoutSec: Number.isInteger(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : void 0,
		enabled: form.get("enabled") === "on" || form.get("enabled") === "true"
	};
}
function fieldErrors(error) {
	const out = {};
	for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
	return out;
}
var actions = {
	upsertRunner: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		const id = String(form.get("id") || "") || void 0;
		const parsed = createRunnerInputSchema.safeParse(parseRunnerForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			return { runner: id ? await updateRunner(id, parsed.data) : await createRunner(parsed.data) };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	toggleRunner: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		try {
			await toggleRunner(String(form.get("id") || ""), form.get("enabled") === "true");
			return { ok: true };
		} catch (e) {
			return fail(400, { fieldErrors: { form: e.message } });
		}
	},
	deleteRunner: async ({ request }) => {
		await ensureLoaded();
		const form = await request.formData();
		try {
			await deleteRunner(String(form.get("id") || ""));
			return { ok: true };
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
//# sourceMappingURL=_page.server.ts.js-MVo6QsKO.js.map
