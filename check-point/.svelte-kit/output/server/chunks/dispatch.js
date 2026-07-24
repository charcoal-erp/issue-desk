import { t as private_env } from "./shared-server.js";
import { V as reportsDir } from "./checkpoint.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
//#region src/lib/server/checkpoint/match.ts
/** The last path segment (after `::`) — bridges pytest nodeid path/dot forms. */
function lastSeg(s) {
	const t = s.trim();
	return t.includes("::") ? t.split("::").pop().trim() : t;
}
function idEquivalent(a, b) {
	if (!a || !b) return false;
	if (a === b) return true;
	const la = lastSeg(a);
	const lb = lastSeg(b);
	return la !== "" && la === lb;
}
function entryTokens(e) {
	return [e.identifier, ...e.aliases ?? []].filter(Boolean);
}
function caseMatchesEntry(strategy, c, e) {
	const tokens = entryTokens(e);
	if (strategy.by === "annotation") {
		const words = tokens.flatMap((t) => t.split(/\s+/));
		return words.includes(c.id) || c.externalTestId != null && words.includes(c.externalTestId);
	}
	const key = c.externalTestId;
	if (!key) return false;
	return tokens.some((t) => idEquivalent(key, t));
}
function entryToResult(e, c, runnerId) {
	return {
		testCaseId: c.id,
		runnerId,
		status: e.status,
		durationMs: e.durationMs,
		message: e.message,
		stack: e.stack,
		artifacts: e.artifacts,
		flaky: e.flaky || void 0
	};
}
/** A case that the report never mentioned — recorded skipped with a reason. */
function skippedResult(c, runnerId, reason) {
	return {
		testCaseId: c.id,
		runnerId,
		status: "skipped",
		durationMs: null,
		message: reason,
		stack: null,
		artifacts: []
	};
}
function matchEntries(entries, cases, strategy, runnerId) {
	const used = /* @__PURE__ */ new Set();
	const results = [];
	const orphans = [];
	for (const e of entries) {
		const c = cases.find((c) => !used.has(c.id) && caseMatchesEntry(strategy, c, e));
		if (c) {
			used.add(c.id);
			results.push(entryToResult(e, c, runnerId));
		} else orphans.push(e);
	}
	return {
		results,
		orphans,
		missing: cases.filter((c) => !used.has(c.id))
	};
}
/**
* exit-code adapter (design doc §7.1): one synthetic result per mapped case —
* exit 0 → pass, non-zero → fail with the tail of stdout/stderr as the message.
*/
function exitCodeResults(cases, exitCode, output, runnerId) {
	const ok = exitCode === 0;
	const tail = output.split(/\r?\n/).filter(Boolean).slice(-12).join("\n") || null;
	return cases.map((c) => ({
		testCaseId: c.id,
		runnerId,
		status: ok ? "pass" : "fail",
		durationMs: null,
		message: ok ? null : `exit ${exitCode}`,
		stack: ok ? null : tail,
		artifacts: []
	}));
}
//#endregion
//#region src/lib/server/checkpoint/report.ts
function decodeXml(s) {
	return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&#10;/g, "\n").replace(/&#9;/g, "	").replace(/&amp;/g, "&");
}
function parseAttrs(s) {
	const out = {};
	const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
	let m;
	while (m = re.exec(s)) out[m[1]] = decodeXml(m[2]);
	return out;
}
function firstLine(s) {
	if (!s) return null;
	const line = s.split(/\r?\n/).find((l) => l.trim());
	return line ? line.trim() : null;
}
function ms(seconds) {
	return seconds == null ? null : Math.round(seconds * 1e3);
}
function parseJUnit(xml) {
	const entries = [];
	const caseRe = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
	let m;
	while (m = caseRe.exec(xml)) {
		const attrs = parseAttrs(m[1]);
		const body = m[3] ?? "";
		const name = attrs.name ?? "";
		const classname = attrs.classname ?? "";
		const identifier = classname ? `${classname}::${name}` : name;
		let status = "pass";
		let message = null;
		let stack = null;
		const fail = /<(failure|error)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/.exec(body);
		if (fail) {
			status = "fail";
			const fa = parseAttrs(fail[2]);
			message = fa.message ? decodeXml(fa.message) : null;
			stack = decodeXml(fail[4] ?? "").trim() || null;
			if (!message) message = firstLine(stack);
		} else if (/<skipped\b/.test(body)) status = "skipped";
		entries.push({
			identifier,
			aliases: name && name !== identifier ? [name] : void 0,
			status,
			durationMs: attrs.time ? ms(parseFloat(attrs.time)) : null,
			message,
			stack,
			artifacts: []
		});
	}
	return entries;
}
function pwStatus(s) {
	if (s === "passed") return "pass";
	if (s === "skipped") return "skipped";
	if (s === "interrupted") return "blocked";
	return "fail";
}
function parsePlaywright(json) {
	const data = JSON.parse(json);
	const entries = [];
	const walk = (suite, prefix) => {
		const here = [...prefix, suite.title].filter(Boolean);
		for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
			const results = test.results ?? [];
			const last = results[results.length - 1];
			if (!last) continue;
			const flaky = results.length > 1 && new Set(results.map((r) => r.status)).size > 1;
			const annotations = [...test.annotations ?? [], ...spec.annotations ?? []].map((a) => a?.description || a?.type).filter(Boolean);
			const artifacts = (last.attachments ?? []).map((a) => a?.path || a?.name).filter(Boolean);
			const titlePath = [...here, spec.title].filter(Boolean);
			entries.push({
				identifier: titlePath.join(" › "),
				aliases: [
					spec.title,
					...annotations,
					...titlePath
				].filter(Boolean),
				status: pwStatus(last.status),
				durationMs: last.duration ?? null,
				message: last.error?.message ? firstLine(last.error.message) : null,
				stack: last.error?.stack ?? last.error?.message ?? null,
				artifacts,
				flaky: flaky || void 0
			});
		}
		for (const child of suite.suites ?? []) walk(child, here);
	};
	for (const suite of data.suites ?? []) walk(suite, []);
	return entries;
}
function jestStatus(s) {
	if (s === "passed") return "pass";
	if (s === "failed") return "fail";
	return "skipped";
}
function parseVitest(json) {
	const data = JSON.parse(json);
	const entries = [];
	for (const file of data.testResults ?? []) for (const a of file.assertionResults ?? []) {
		const fullName = a.fullName || [...a.ancestorTitles ?? [], a.title].filter(Boolean).join(" ");
		const first = (a.failureMessages ?? [])[0] ?? null;
		entries.push({
			identifier: fullName,
			aliases: a.title && a.title !== fullName ? [a.title] : void 0,
			status: jestStatus(a.status),
			durationMs: a.duration ?? null,
			message: firstLine(first),
			stack: first,
			artifacts: []
		});
	}
	return entries;
}
function pytestStatus(s) {
	if (s === "passed" || s === "xpassed") return "pass";
	if (s === "skipped" || s === "xfailed") return "skipped";
	return "fail";
}
function parsePytestJson(json) {
	const data = JSON.parse(json);
	const entries = [];
	for (const t of data.tests ?? []) {
		const call = t.call ?? {};
		const longrepr = typeof call.longrepr === "string" ? call.longrepr : call.crash?.message ?? t.longrepr ?? null;
		entries.push({
			identifier: t.nodeid ?? "",
			status: pytestStatus(t.outcome ?? "failed"),
			durationMs: t.duration != null ? ms(t.duration) : ms(call.duration),
			message: firstLine(longrepr),
			stack: longrepr ?? null,
			artifacts: []
		});
	}
	return entries;
}
function parseTap(text) {
	const entries = [];
	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const m = /^(ok|not ok)\s+\d+\s*-?\s*(.*)$/.exec(lines[i].trim());
		if (!m) continue;
		let status = m[1] === "ok" ? "pass" : "fail";
		let desc = m[2].trim();
		if (/#\s*(SKIP|TODO)\b/i.test(desc)) {
			status = "skipped";
			desc = desc.replace(/#.*$/, "").trim();
		}
		let message = null;
		if (lines[i + 1]?.trim() === "---") {
			const yaml = [];
			let j = i + 2;
			while (j < lines.length && lines[j].trim() !== "...") yaml.push(lines[j++]);
			message = yaml.join("\n").trim() || null;
		}
		entries.push({
			identifier: desc,
			status,
			durationMs: null,
			message: firstLine(message),
			stack: message,
			artifacts: []
		});
	}
	return entries;
}
/**
* The normalized entry shape itself, as a format any tool can emit.
*
* Suites whose native output no adapter understands — a bespoke JSON summary,
* a workflow harness's own schema — are converted by a small script that lives
* with the suite, and Checkpoint ingests the result without learning anything
* project-specific. This is the escape hatch that keeps the adapters generic.
*
* Accepts a bare array or an object wrapping one under `results` / `entries` /
* `tests`, and tolerates the usual status spellings. A status it cannot read
* becomes `skipped` — never a silent pass.
*/
var CHECKPOINT_STATUS = {
	pass: "pass",
	passed: "pass",
	ok: "pass",
	success: "pass",
	succeeded: "pass",
	fail: "fail",
	failed: "fail",
	failure: "fail",
	error: "fail",
	errored: "fail",
	blocked: "blocked",
	skip: "skipped",
	skipped: "skipped",
	pending: "skipped",
	todo: "skipped"
};
function strOrNull(v) {
	if (v === null || v === void 0) return null;
	return String(v).trim() || null;
}
function parseCheckpointJson(content) {
	const data = JSON.parse(content);
	const rows = Array.isArray(data) ? data : data?.results ?? data?.entries ?? data?.tests ?? [];
	const entries = [];
	for (const raw of rows) {
		if (!raw || typeof raw !== "object") continue;
		const row = raw;
		const identifier = strOrNull(row.identifier ?? row.id ?? row.testId ?? row.name ?? row.test ?? row.testName);
		if (!identifier) continue;
		const aliases = Array.isArray(row.aliases) ? row.aliases.map((a) => String(a)).filter(Boolean) : void 0;
		const duration = row.durationMs ?? row.duration_ms ?? row.durationMillis;
		const artifacts = Array.isArray(row.artifacts) ? row.artifacts.map((a) => String(a)).filter(Boolean) : [];
		entries.push({
			identifier,
			aliases: aliases?.length ? aliases : void 0,
			status: CHECKPOINT_STATUS[String(row.status ?? "").toLowerCase()] ?? "skipped",
			durationMs: typeof duration === "number" && Number.isFinite(duration) ? duration : null,
			message: firstLine(strOrNull(row.message ?? row.notes ?? row.summary)),
			stack: strOrNull(row.stack ?? row.details ?? row.output),
			artifacts,
			flaky: row.flaky === true ? true : void 0
		});
	}
	return entries;
}
/**
* Parse raw report content into normalized entries. `exit-code` and `custom`
* are not content parsers — exit-code is applied at execution time against the
* mapped case list, and custom is a user-supplied module (out of scope for v1;
* `checkpoint-json` covers the same need without loading foreign code).
*/
function parseReport(format, content) {
	try {
		switch (format) {
			case "junit-xml": return parseJUnit(content);
			case "playwright-json":
			case "visual-diff": return parsePlaywright(content);
			case "vitest-json": return parseVitest(content);
			case "pytest-json": return parsePytestJson(content);
			case "tap": return parseTap(content);
			case "checkpoint-json": return parseCheckpointJson(content);
			case "exit-code":
			case "custom": return [];
		}
	} catch (e) {
		console.error(`[checkpoint] Failed to parse ${format} report:`, e.message);
		return [];
	}
}
//#endregion
//#region src/lib/server/checkpoint/dispatch.ts
/**
* Launching and executing a run (design doc §8). A runner's command is executed
* as authored (this is a single-tenant tool behind a trusted boundary — the
* commands are CI-style config, not external input), its report is read and
* normalized, and entries are matched back to the participating cases. A
* missing command, timeout or unreadable report degrades to recorded failures /
* skips rather than throwing, so a run always completes with an honest record.
*/
function substituteEnv(command, environment) {
	return command.replace(/\$ENV\b/g, environment);
}
/** Where runner working directories resolve from (the code under test). */
function workBase() {
	return private_env.CHECKPOINT_WORKDIR || process.cwd();
}
/**
* How long to keep waiting for stdio after the command itself has exited.
* `close` normally follows `exit` immediately, but a runner that leaves
* grandchildren behind (a wrapper that started a server, say) leaks the pipe
* write-end to them and `close` may never fire — which would hang the run.
*/
var STDIO_DRAIN_MS = 2e3;
/**
* SIGKILL the whole process tree. `shell: true` means the direct child is
* `/bin/sh`; killing it alone leaves whatever it spawned running — still
* holding its ports and still writing to the database. Spawning detached puts
* the command in its own process group so one negative-pid kill reaps all of
* it (the pattern the platform's own Python harness uses for the same reason).
*/
function killTree(child, ownGroup) {
	if (ownGroup && child.pid) try {
		process.kill(-child.pid, "SIGKILL");
		return;
	} catch {}
	try {
		child.kill("SIGKILL");
	} catch {}
}
function runCommand(runner, environment, startedAt) {
	return new Promise((resolve) => {
		const cwd = path.resolve(workBase(), runner.workingDir || ".");
		const ownGroup = process.platform !== "win32";
		let child;
		try {
			child = spawn(substituteEnv(runner.command, environment), {
				cwd,
				shell: true,
				detached: ownGroup,
				env: {
					...process.env,
					...runner.env,
					ENV: environment
				}
			});
		} catch (e) {
			resolve({
				exitCode: null,
				stdout: "",
				stderr: String(e),
				timedOut: false,
				startedAt,
				finishedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			return;
		}
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let settled = false;
		let drain;
		const timer = setTimeout(() => {
			timedOut = true;
			killTree(child, ownGroup);
		}, (runner.timeoutSec ?? 120) * 1e3);
		const settle = (exitCode) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(drain);
			resolve({
				exitCode,
				stdout,
				stderr,
				timedOut,
				startedAt,
				finishedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
		};
		child.stdout?.on("data", (d) => stdout += d);
		child.stderr?.on("data", (d) => stderr += d);
		child.on("error", (e) => {
			stderr = `${stderr}\n${e.message}`;
			settle(null);
		});
		child.on("exit", (code) => {
			drain = setTimeout(() => settle(code), STDIO_DRAIN_MS);
		});
		child.on("close", (code) => settle(code));
	});
}
async function dispatchRunner(runId, runner, cases, environment) {
	const outcome = await runCommand(runner, environment, (/* @__PURE__ */ new Date()).toISOString());
	let content = "";
	if (runner.reportPath === "stdout" || runner.reportFormat === "tap") content = outcome.stdout || outcome.stderr;
	else if (runner.reportPath) try {
		content = await readFile(path.resolve(workBase(), runner.workingDir || ".", runner.reportPath), "utf8");
	} catch {
		content = "";
	}
	let results;
	let orphanCount = 0;
	if (runner.reportFormat === "exit-code") results = exitCodeResults(cases, outcome.exitCode ?? 1, `${outcome.stdout}\n${outcome.stderr}`, runner.id);
	else {
		const matched = matchEntries(parseReport(runner.reportFormat, content), cases, runner.matchStrategy, runner.id);
		orphanCount = matched.orphans.length;
		results = [...matched.results, ...matched.missing.map((c) => skippedResult(c, runner.id, `not reported by ${runner.name}`))];
	}
	if (content) try {
		await mkdir(reportsDir(runId), { recursive: true });
		await writeFile(path.join(reportsDir(runId), `${runner.id}.report`), content, "utf8");
	} catch {}
	const timeoutNote = outcome.timedOut ? `[checkpoint] timed out after ${runner.timeoutSec ?? 120}s — process group killed\n` : "";
	return {
		invocation: {
			runnerId: runner.id,
			command: substituteEnv(runner.command, environment),
			workingDir: runner.workingDir,
			exitCode: outcome.exitCode,
			startedAt: outcome.startedAt,
			finishedAt: outcome.finishedAt,
			reportPath: runner.reportPath,
			parsedCount: results.length,
			orphanCount,
			log: `${timeoutNote}${(outcome.stderr || outcome.stdout || "").slice(-2e3)}` || void 0
		},
		results
	};
}
/** A manual case starts pending — `skipped` with a sentinel note until a tester marks it. */
var PENDING_NOTE = "pending";
function pendingManualResult(testCaseId) {
	return {
		testCaseId,
		runnerId: null,
		status: "skipped",
		durationMs: null,
		message: null,
		stack: null,
		artifacts: [],
		notes: PENDING_NOTE
	};
}
//#endregion
export { dispatchRunner as n, pendingManualResult as r, PENDING_NOTE as t };
