import { E as runs, _ as lastResultForCase, h as getRun, m as getCase, p as ensureLoaded, r as cases, v as listCases, w as runner } from "../../../../../chunks/checkpoint.js";
import { o as TEST_CASE_STATUSES, r as RESULT_STATUSES, s as TEST_KINDS } from "../../../../../chunks/types.js";
import { t as PRIORITY_META } from "../../../../../chunks/priority.js";
import { a as TEST_KIND_META, r as REPORT_FORMAT_LABEL } from "../../../../../chunks/meta.js";
import { i as isConfigured, r as getIssue } from "../../../../../chunks/issuedesk.js";
import { r as failingCases } from "../../../../../chunks/metrics.js";
//#region src/lib/export/context.ts
/**
* Export date formatting for the failures prompt. A trimmed copy of what the
* combined app shared with IssueDesk — Checkpoint only ever needed the date
* helper, so none of the issue-export context comes with it.
*/
/** "2026-07-17 09:20 IST" */
function fmtExportDate(d) {
	return `${new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(d)} ${new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZoneName: "short"
	}).format(d).replace("GMT+5:30", "IST")}`;
}
//#endregion
//#region src/lib/server/checkpoint/failuresExport.ts
/** Logs run to megabytes; the tail is where a failure surfaces. */
var LOG_TAIL_LINES = 120;
var LOG_MAX_CHARS = 12e3;
function trimLog(raw) {
	const lines = raw.replace(/\s+$/, "").split("\n");
	let truncated = lines.length > LOG_TAIL_LINES;
	let text = lines.slice(-120).join("\n");
	if (text.length > LOG_MAX_CHARS) {
		text = text.slice(-12e3);
		truncated = true;
	}
	return {
		text,
		truncated
	};
}
function substituteEnv(command, env) {
	return env ? command.replace(/\$ENV\b/g, env) : command;
}
function targetPath(c) {
	return [
		c.target.moduleName,
		c.target.pageName,
		c.target.formName
	].filter(Boolean).join(" › ");
}
function reproduceCommand(runner, env) {
	const cmd = substituteEnv(runner.command, env);
	return runner.workingDir && runner.workingDir !== "." ? `cd ${runner.workingDir} && ${cmd}` : cmd;
}
var INSTRUCTIONS = "You are working in this repository. Each failing test below carries its reproduce command, the spec file, the expected behaviour in the author’s words, and the actual error. For each failure identify the root cause, say whether it is a real defect or a flaky / incorrect test, and propose the minimal fix and which file to change. Ask before changing a shared contract.";
function sectionFor(item, index, env) {
	const { testCase: c, result, runner } = item;
	const automated = c.kind !== "manual";
	let out = `## ${index}. \`${c.id}\` — ${c.title}\n\n`;
	out += `- **Application:** ${c.appName}\n`;
	out += `- **Target:** ${targetPath(c)}\n`;
	out += `- **Test type:** ${TEST_KIND_META[c.kind].label}\n`;
	out += `- **Priority:** ${PRIORITY_META[c.priority].label}\n`;
	if (automated && runner) {
		out += `- **Runner:** ${runner.name} (${runner.language})\n`;
		out += `- **Reproduce:** \`${reproduceCommand(runner, env)}\`\n`;
	}
	if (c.specPath) out += `- **Spec file:** \`${c.specPath}\`\n`;
	if (c.externalTestId) out += `- **Test id:** \`${c.externalTestId}\`\n`;
	if (automated && runner) out += `- **Report:** \`${runner.reportPath}\` (${REPORT_FORMAT_LABEL[runner.reportFormat]})\n`;
	if (c.parentIssueId) out += `- **Parent issue:** ${c.parentIssueId}${item.parentIssueTitle ? ` — ${item.parentIssueTitle}` : ""}\n`;
	out += "\n";
	if (c.preconditions) out += `**Preconditions:** ${c.preconditions}\n\n`;
	if (c.steps.length) {
		out += `**Expected**\n\n`;
		c.steps.forEach((s, i) => {
			out += `${i + 1}. ${s.action} → _${s.expected}_\n`;
		});
		out += "\n";
	}
	const actual = automated ? result.stack || result.message || "No output captured." : result.notes || result.message || "Marked failed by the tester; no note provided.";
	out += `**Actual**\n\n\`\`\`\n${actual}\n\`\`\`\n`;
	if (result.artifacts.length) out += `\n**Artifacts:** ${result.artifacts.map((a) => `\`${a}\``).join(", ")}\n`;
	return out;
}
function failuresToMarkdown(items, ctx) {
	const scope = [`Generated ${fmtExportDate(ctx.generatedAt)}`];
	if (ctx.runId) scope.push(`run ${ctx.runId}`);
	if (ctx.suiteName) scope.push(`suite ${ctx.suiteName}`);
	if (ctx.environment) scope.push(`env ${ctx.environment}`);
	let out = `# Failing tests — Checkpoint export\n\n`;
	out += `_${scope.join(" · ")}. ${items.length} ${items.length === 1 ? "failure" : "failures"}._\n\n`;
	out += `${INSTRUCTIONS}\n\n`;
	items.forEach((item, i) => {
		out += `---\n\n${sectionFor(item, i + 1, ctx.environment)}\n`;
	});
	if (ctx.logs?.length) {
		out += `---\n\n# Runner output\n\n`;
		out += `_The console output of each runner that failed or reported a failing case. `;
		out += `Parsed reports give you the assertion; these give you what happened around it — `;
		out += `a missing service, a migration that did not apply, a port already bound._\n\n`;
		for (const l of ctx.logs) {
			out += `## \`${l.runnerId}\` — ${l.runnerName}\n\n`;
			out += `- **Command:** \`${l.command}\`\n`;
			out += `- **Working dir:** \`${l.workingDir}\`\n`;
			out += `- **Exit code:** ${l.exitCode ?? "unknown"}\n\n`;
			if (l.truncated) out += `_Last ${LOG_TAIL_LINES} lines; earlier output omitted._\n\n`;
			out += `\`\`\`\n${l.log}\n\`\`\`\n\n`;
		}
	}
	out += `---\n\n## What I need back\n\n`;
	out += `- The root cause of each failure.\n`;
	out += `- Whether it is a real defect, a flaky test, or an incorrect test.\n`;
	out += `- The minimal fix and which file to change.\n`;
	out += `- Anything that needs a decision before you proceed.\n`;
	return out.trim();
}
function failuresToJson(items, ctx) {
	const doc = {
		generatedAt: ctx.generatedAt.toISOString(),
		run: ctx.runId ?? null,
		suite: ctx.suiteName ?? null,
		environment: ctx.environment ?? null,
		runnerLogs: (ctx.logs ?? []).map((l) => ({
			runnerId: l.runnerId,
			runnerName: l.runnerName,
			command: l.command,
			workingDir: l.workingDir,
			exitCode: l.exitCode,
			truncated: l.truncated,
			log: l.log
		})),
		failures: items.map((item) => {
			const c = item.testCase;
			return {
				id: c.id,
				title: c.title,
				application: c.appName,
				target: targetPath(c),
				kind: c.kind,
				priority: c.priority,
				runner: item.runner ? {
					name: item.runner.name,
					language: item.runner.language,
					reproduce: reproduceCommand(item.runner, ctx.environment),
					reportFormat: item.runner.reportFormat
				} : null,
				spec: c.specPath,
				testId: c.externalTestId,
				parentIssue: c.parentIssueId,
				preconditions: c.preconditions ?? null,
				steps: c.steps,
				error: item.result.stack || item.result.message || item.result.notes || null,
				artifacts: item.result.artifacts
			};
		})
	};
	return JSON.stringify(doc, null, 2);
}
//#endregion
//#region src/routes/api/export/failures/+server.ts
function itemFor(c, result) {
	return {
		testCase: c,
		result,
		runner: c.runnerId ? runner(c.runnerId) ?? void 0 : void 0,
		parentIssueTitle: null
	};
}
/**
* Fill in parent-issue titles from the central IssueDesk, resolving each unique
* id once. A no-op (leaves them null) when no IssueDesk is configured.
*/
async function resolveParentTitles(items) {
	if (!isConfigured()) return;
	const ids = [...new Set(items.map((i) => i.testCase.parentIssueId).filter(Boolean))];
	const titles = /* @__PURE__ */ new Map();
	await Promise.all(ids.map(async (id) => {
		const ref = await getIssue(id);
		if (ref) titles.set(id, ref.title);
	}));
	for (const item of items) {
		const pid = item.testCase.parentIssueId;
		if (pid) item.parentIssueTitle = titles.get(pid) ?? null;
	}
}
/**
* Console output for the invocations that matter: the ones that produced a
* failing case, plus any that exited non-zero — a runner that died before
* writing a report has no failing case to attach its log to, and that log is
* usually the one worth reading.
*/
function logsFor(run, items) {
	const failingRunners = new Set(items.map((i) => i.result.runnerId).filter(Boolean));
	return run.invocations.filter((inv) => inv.log && (failingRunners.has(inv.runnerId) || (inv.exitCode ?? 0) !== 0)).map((inv) => {
		const { text, truncated } = trimLog(inv.log);
		return {
			runnerId: inv.runnerId,
			runnerName: runner(inv.runnerId)?.name ?? inv.runnerId,
			command: inv.command,
			workingDir: inv.workingDir,
			exitCode: inv.exitCode,
			log: text,
			truncated
		};
	});
}
function failuresOf(run) {
	return run.results.filter((r) => r.status === "fail" || r.status === "blocked").map((r) => {
		const c = getCase(r.testCaseId);
		return c ? itemFor(c, r) : null;
	}).filter(Boolean);
}
/** GET /api/export/failures?scope=all|run|suite|case|filter&format=md|json */
var GET = async ({ url }) => {
	await ensureLoaded();
	const scope = url.searchParams.get("scope") ?? "all";
	const format = url.searchParams.get("format") === "json" ? "json" : "md";
	const ctx = { generatedAt: /* @__PURE__ */ new Date() };
	let items = [];
	if (scope === "run" || scope === "suite") {
		const run = scope === "run" ? getRun(url.searchParams.get("runId") ?? "") : runs().find((r) => r.suiteId === url.searchParams.get("suiteId"));
		if (run) {
			ctx.runId = run.id;
			ctx.suiteName = run.suiteName;
			ctx.environment = run.environment;
			items = failuresOf(run);
			ctx.logs = logsFor(run, items);
		}
	} else if (scope === "case") {
		const c = getCase(url.searchParams.get("caseId") ?? "");
		const last = c ? lastResultForCase(c.id) : void 0;
		if (c && last && (last.result.status === "fail" || last.result.status === "blocked")) {
			ctx.environment = last.run.environment;
			items = [itemFor(c, last.result)];
		}
	} else if (scope === "filter") {
		const params = new URLSearchParams(url.searchParams.get("filter") ?? "");
		const kind = params.getAll("kind").filter((k) => TEST_KINDS.includes(k));
		const status = params.getAll("status").filter((s) => TEST_CASE_STATUSES.includes(s));
		const result = params.getAll("result").filter((r) => r === "none" || RESULT_STATUSES.includes(r));
		const cases = listCases({
			q: params.get("q") ?? void 0,
			appId: params.get("app") ?? void 0,
			kind: kind.length ? kind : void 0,
			status: status.length ? status : void 0,
			lastResult: result.length ? result : void 0
		});
		for (const c of cases) {
			const last = lastResultForCase(c.id);
			if (last && (last.result.status === "fail" || last.result.status === "blocked")) items.push(itemFor(c, last.result));
		}
	} else items = failingCases(cases(), runs()).map((f) => itemFor(f.testCase, f.result));
	await resolveParentTitles(items);
	const body = format === "json" ? failuresToJson(items, ctx) : failuresToMarkdown(items, ctx);
	return new Response(body, { headers: { "content-type": format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8" } });
};
//#endregion
export { GET };
