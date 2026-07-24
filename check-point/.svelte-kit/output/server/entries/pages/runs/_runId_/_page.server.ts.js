import { F as ensureLoaded$1, I as users, S as recordResult, h as getRun, i as completeRun, m as getCase, p as ensureLoaded, t as addFiledIssueToCase, w as runner } from "../../../../chunks/checkpoint.js";
import { r as RESULT_STATUSES } from "../../../../chunks/types.js";
import { l as timeAgo } from "../../../../chunks/meta.js";
import { i as isConfigured, n as createIssue } from "../../../../chunks/issuedesk.js";
import { a as runCounts, o as runPassRate } from "../../../../chunks/metrics.js";
import { t as PENDING_NOTE } from "../../../../chunks/dispatch.js";
import { n as isRunActive } from "../../../../chunks/runtime.js";
import { error, fail } from "@sveltejs/kit";
//#region src/lib/server/checkpoint/toIssue.ts
/**
* Prefill an IssueDesk issue from a failed test result (design §13). The
* application / module / page / form come straight from the case's target — no
* re-selection — and the description assembles a reproduction from the steps,
* the actual error and (for automated kinds) the reproduce command.
*
* Returns the JSON body IssueDesk's `POST /api/issues` accepts — the two apps
* share no types, only this wire shape.
*/
function resultToIssueInput(c, result, run, runner) {
	const automated = c.kind !== "manual";
	const lines = [];
	lines.push(`Filed from test **${c.id}** — ${c.title}.`, "");
	if (c.preconditions) lines.push(`**Preconditions:** ${c.preconditions}`, "");
	if (c.steps.length) {
		lines.push("**Steps (expected behaviour)**", "");
		c.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.action} → _${s.expected}_`));
		lines.push("");
	}
	const actual = automated ? result.stack || result.message || "No output captured." : result.notes || result.message || "Marked failed by the tester.";
	lines.push("**Actual**", "", "```", actual, "```", "");
	if (run) lines.push(`**Environment:** ${run.environment}`);
	if (automated && runner) {
		const cmd = run ? runner.command.replace(/\$ENV\b/g, run.environment) : runner.command;
		const repro = runner.workingDir && runner.workingDir !== "." ? `cd ${runner.workingDir} && ${cmd}` : cmd;
		lines.push(`**Reproduce:** \`${repro}\``);
		if (c.specPath) lines.push(`**Spec file:** \`${c.specPath}\``);
	}
	return {
		type: "bug",
		title: `${c.title} (${c.id})`,
		description: lines.join("\n").trim(),
		appId: c.appId,
		moduleId: c.target.moduleId,
		page: c.target.pageName,
		form: c.target.formName,
		priority: c.priority,
		status: "open",
		tags: ["from-test", ...c.tags.filter((t) => t !== "from-test")],
		attachments: []
	};
}
//#endregion
//#region src/routes/runs/[runId]/+page.server.ts
function actor(cookies) {
	const id = cookies.get("checkpoint_user");
	return users().some((u) => u.id === id) ? id : users()[0]?.id ?? "system";
}
function enrich(r) {
	const c = getCase(r.testCaseId);
	return {
		testCaseId: r.testCaseId,
		title: c?.title ?? r.testCaseId,
		kind: c?.kind ?? "manual",
		specPath: c?.specPath ?? null,
		status: r.status,
		durationMs: r.durationMs,
		message: r.message,
		stack: r.stack,
		artifacts: r.artifacts,
		pending: r.notes === PENDING_NOTE,
		issueId: r.issueId ?? null
	};
}
var load = async ({ params }) => {
	await ensureLoaded();
	const run = getRun(params.runId);
	if (!run) error(404, `Run ${params.runId} not found`);
	const now = /* @__PURE__ */ new Date();
	const userName = (id) => users().find((u) => u.id === id)?.name ?? id;
	const groups = run.invocations.map((inv) => {
		const runner$1 = runner(inv.runnerId);
		const rows = run.results.filter((r) => r.runnerId === inv.runnerId).map(enrich);
		return {
			runnerId: inv.runnerId,
			name: runner$1?.name ?? inv.runnerId,
			kind: runner$1?.kind ?? "unit",
			command: inv.command,
			reportFormat: runner$1?.reportFormat ?? null,
			exitCode: inv.exitCode,
			pass: rows.filter((r) => r.status === "pass").length,
			fail: rows.filter((r) => r.status === "fail").length,
			rows
		};
	});
	const manualRows = run.results.filter((r) => r.runnerId === null).map(enrich);
	const failingCount = run.results.filter((r) => r.status === "fail" || r.status === "blocked").length;
	/**
	* A run without `completedAt` is running, waiting on a person, or was
	* interrupted by a restart — only the live registry can tell them apart,
	* and conflating them is how runs sit "in progress" forever.
	*/
	const pendingManual = run.results.some((r) => r.notes === PENDING_NOTE);
	const state = run.completedAt ? "complete" : isRunActive(run.id) ? "running" : pendingManual ? "awaiting-manual" : "interrupted";
	return {
		run: {
			id: run.id,
			suiteName: run.suiteName ?? "Ad-hoc run",
			environment: run.environment,
			by: userName(run.startedBy),
			when: timeAgo(run.startedAt, now),
			counts: runCounts(run),
			passRate: runPassRate(run),
			completed: !!run.completedAt,
			state
		},
		groups,
		manualRows,
		failingCount
	};
};
var actions = {
	recordResult: async ({ request, params }) => {
		await ensureLoaded();
		const form = await request.formData();
		const caseId = String(form.get("caseId") || "");
		const status = String(form.get("status") || "");
		if (!RESULT_STATUSES.includes(status)) return fail(400, { error: "Unknown result status" });
		const notes = String(form.get("notes") || "") || void 0;
		try {
			await recordResult(params.runId, {
				testCaseId: caseId,
				runnerId: null,
				status,
				durationMs: null,
				message: null,
				stack: null,
				artifacts: [],
				notes
			});
			const run = getRun(params.runId);
			if (run && !run.results.some((r) => r.notes === "pending")) await completeRun(params.runId);
			return { ok: true };
		} catch (e) {
			return fail(400, { error: e.message });
		}
	},
	completeRun: async ({ params }) => {
		await ensureLoaded();
		try {
			await completeRun(params.runId);
			return { ok: true };
		} catch (e) {
			return fail(400, { error: e.message });
		}
	},
	createBugFromResult: async ({ request, cookies, params }) => {
		if (!isConfigured()) return fail(400, { error: "No IssueDesk is configured." });
		await ensureLoaded();
		await ensureLoaded$1();
		const form = await request.formData();
		const caseId = String(form.get("caseId") || "");
		const c = getCase(caseId);
		const run = getRun(params.runId);
		const result = run?.results.find((r) => r.testCaseId === caseId);
		if (!c || !run || !result) return fail(400, { error: "Result not found" });
		try {
			const issue = await createIssue({
				...resultToIssueInput(c, result, run, c.runnerId ? runner(c.runnerId) : void 0),
				testCaseId: c.id,
				runId: run.id
			}, actor(cookies));
			await recordResult(run.id, {
				...result,
				issueId: issue.id
			});
			await addFiledIssueToCase(c.id, issue.id);
			return { issueId: issue.id };
		} catch (e) {
			return fail(400, { error: e.message });
		}
	}
};
//#endregion
export { actions, load };
