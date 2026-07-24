import { T as TEST_KINDS, b as TEST_CASE_STATUSES, P as PRIORITIES } from './types.js-BxhiHiuh.js';
import { P as PRIORITY_META } from './priority.js-BTgJFiQJ.js';
import { T as TEST_KIND_META } from './meta.js-Drcdnnre.js';

//#region src/lib/server/checkpoint/casesIO.ts
/** Cases export/import (design FR-24/25). JSON is round-trippable; CSV is for
* spreadsheet triage; Markdown is for review. Import creates new cases. */
function casesToJson(cases) {
	return JSON.stringify(cases, null, 2);
}
var CSV_COLS = [
	"id",
	"appId",
	"moduleId",
	"title",
	"kind",
	"priority",
	"status",
	"specPath",
	"externalTestId",
	"parentIssueId",
	"tags"
];
function csvCell(v) {
	return /[",\n]/.test(v) ? `"${v.replace(/"/g, "\"\"")}"` : v;
}
function casesToCsv(cases) {
	const rows = [CSV_COLS.join(",")];
	for (const c of cases) rows.push([
		c.id,
		c.appId,
		c.target.moduleId,
		c.title,
		c.kind,
		c.priority,
		c.status,
		c.specPath ?? "",
		c.externalTestId ?? "",
		c.parentIssueId ?? "",
		c.tags.join("|")
	].map((v) => csvCell(String(v))).join(","));
	return rows.join("\n");
}
function casesToMarkdown(cases) {
	let out = `# Test cases (${cases.length})\n\n`;
	for (const c of cases) {
		out += `## ${c.id} — ${c.title}\n\n`;
		out += `- **Application:** ${c.appName} · ${c.target.moduleName}\n`;
		out += `- **Type:** ${TEST_KIND_META[c.kind].label} · **Priority:** ${PRIORITY_META[c.priority].label} · **Status:** ${c.status}\n`;
		if (c.specPath) out += `- **Spec:** \`${c.specPath}\`\n`;
		if (c.parentIssueId) out += `- **Parent issue:** ${c.parentIssueId}\n`;
		if (c.preconditions) out += `\n**Preconditions:** ${c.preconditions}\n`;
		if (c.steps.length) {
			out += `\n**Steps**\n\n`;
			c.steps.forEach((s, i) => out += `${i + 1}. ${s.action} → _${s.expected}_\n`);
		}
		out += "\n";
	}
	return out.trim();
}
function coercePriority(v) {
	return PRIORITIES.includes(String(v)) ? v : "medium";
}
function coerceStatus(v) {
	return TEST_CASE_STATUSES.includes(String(v)) ? v : "active";
}
function coerceKind(v) {
	return TEST_KINDS.includes(String(v)) ? v : "manual";
}
function rowToInput(row) {
	const appId = String(row.appId ?? "").trim();
	const moduleId = String(row.moduleId ?? row.target?.moduleId ?? "").trim();
	const title = String(row.title ?? "").trim();
	if (!appId || !moduleId || !title) return null;
	const kind = coerceKind(row.kind);
	const manual = kind === "manual";
	const steps = Array.isArray(row.steps) ? row.steps.map((s) => ({
		action: String(s.action ?? ""),
		expected: String(s.expected ?? "")
	})) : [];
	const tags = typeof row.tags === "string" ? row.tags.split(/[|,]/).map((t) => t.trim()).filter(Boolean) : Array.isArray(row.tags) ? row.tags.map(String) : [];
	return {
		appId,
		moduleId,
		page: row.page ?? row.target?.pageName ?? void 0,
		form: row.form ?? row.target?.formName ?? void 0,
		title,
		preconditions: row.preconditions ?? void 0,
		steps,
		priority: coercePriority(row.priority),
		status: coerceStatus(row.status),
		tags,
		kind,
		runnerId: manual ? null : row.runnerId ?? null,
		specPath: manual ? null : row.specPath ?? null,
		externalTestId: manual ? null : row.externalTestId ?? null,
		parentIssueId: row.parentIssueId ?? null,
		suiteIds: []
	};
}
function parseCasesJson(text) {
	try {
		const data = JSON.parse(text);
		return (Array.isArray(data) ? data : []).map(rowToInput).filter(Boolean);
	} catch {
		return [];
	}
}
function parseCsvLine(line) {
	const out = [];
	let cur = "";
	let inQ = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQ) if (ch === "\"" && line[i + 1] === "\"") {
			cur += "\"";
			i++;
		} else if (ch === "\"") inQ = false;
		else cur += ch;
		else if (ch === "\"") inQ = true;
		else if (ch === ",") {
			out.push(cur);
			cur = "";
		} else cur += ch;
	}
	out.push(cur);
	return out;
}
function parseCasesCsv(text) {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	if (lines.length < 2) return [];
	const header = parseCsvLine(lines[0]).map((h) => h.trim());
	const out = [];
	for (const line of lines.slice(1)) {
		const cells = parseCsvLine(line);
		const row = {};
		header.forEach((h, i) => row[h] = cells[i] ?? "");
		const input = rowToInput(row);
		if (input) out.push(input);
	}
	return out;
}

export { casesToMarkdown as a, casesToJson as b, casesToCsv as c, parseCasesJson as d, parseCasesCsv as p };
//# sourceMappingURL=casesIO.js-BKmEPm8n.js.map
