import type { CreateTestCaseInput, Priority, TestCase, TestCaseStatus, TestKind } from '$lib/types';
import { PRIORITIES, TEST_CASE_STATUSES, TEST_KINDS } from '$lib/types';
import { PRIORITY_META } from '$lib/priority';
import { TEST_KIND_META } from '$lib/checkpoint/meta';

/** Cases export/import (design FR-24/25). JSON is round-trippable; CSV is for
 * spreadsheet triage; Markdown is for review. Import creates new cases. */

// ---------- export ----------
export function casesToJson(cases: TestCase[]): string {
	return JSON.stringify(cases, null, 2);
}

const CSV_COLS = [
	'id',
	'appId',
	'moduleId',
	'title',
	'kind',
	'priority',
	'status',
	'specPath',
	'externalTestId',
	'parentIssueId',
	'tags'
] as const;

function csvCell(v: string): string {
	return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function casesToCsv(cases: TestCase[]): string {
	const rows = [CSV_COLS.join(',')];
	for (const c of cases) {
		rows.push(
			[
				c.id,
				c.appId,
				c.target.moduleId,
				c.title,
				c.kind,
				c.priority,
				c.status,
				c.specPath ?? '',
				c.externalTestId ?? '',
				c.parentIssueId ?? '',
				c.tags.join('|')
			]
				.map((v) => csvCell(String(v)))
				.join(',')
		);
	}
	return rows.join('\n');
}

export function casesToMarkdown(cases: TestCase[]): string {
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
			c.steps.forEach((s, i) => (out += `${i + 1}. ${s.action} → _${s.expected}_\n`));
		}
		out += '\n';
	}
	return out.trim();
}

// ---------- import ----------
function coercePriority(v: unknown): Priority {
	return (PRIORITIES as readonly string[]).includes(String(v)) ? (v as Priority) : 'medium';
}
function coerceStatus(v: unknown): TestCaseStatus {
	return (TEST_CASE_STATUSES as readonly string[]).includes(String(v)) ? (v as TestCaseStatus) : 'active';
}
function coerceKind(v: unknown): TestKind {
	return (TEST_KINDS as readonly string[]).includes(String(v)) ? (v as TestKind) : 'manual';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToInput(row: any): CreateTestCaseInput | null {
	const appId = String(row.appId ?? '').trim();
	const moduleId = String(row.moduleId ?? row.target?.moduleId ?? '').trim();
	const title = String(row.title ?? '').trim();
	if (!appId || !moduleId || !title) return null;
	const kind = coerceKind(row.kind);
	const manual = kind === 'manual';
	const steps = Array.isArray(row.steps)
		? row.steps.map((s: any) => ({ action: String(s.action ?? ''), expected: String(s.expected ?? '') }))
		: [];
	const tags =
		typeof row.tags === 'string'
			? row.tags.split(/[|,]/).map((t: string) => t.trim()).filter(Boolean)
			: Array.isArray(row.tags)
				? row.tags.map(String)
				: [];
	return {
		appId,
		moduleId,
		page: row.page ?? row.target?.pageName ?? undefined,
		form: row.form ?? row.target?.formName ?? undefined,
		title,
		preconditions: row.preconditions ?? undefined,
		steps,
		priority: coercePriority(row.priority),
		status: coerceStatus(row.status),
		tags,
		kind,
		runnerId: manual ? null : (row.runnerId ?? null),
		specPath: manual ? null : (row.specPath ?? null),
		externalTestId: manual ? null : (row.externalTestId ?? null),
		parentIssueId: row.parentIssueId ?? null,
		suiteIds: []
	};
}

export function parseCasesJson(text: string): CreateTestCaseInput[] {
	try {
		const data = JSON.parse(text);
		const arr = Array.isArray(data) ? data : [];
		return arr.map(rowToInput).filter(Boolean) as CreateTestCaseInput[];
	} catch {
		return [];
	}
}

function parseCsvLine(line: string): string[] {
	const out: string[] = [];
	let cur = '';
	let inQ = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQ) {
			if (ch === '"' && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (ch === '"') inQ = false;
			else cur += ch;
		} else if (ch === '"') inQ = true;
		else if (ch === ',') {
			out.push(cur);
			cur = '';
		} else cur += ch;
	}
	out.push(cur);
	return out;
}

export function parseCasesCsv(text: string): CreateTestCaseInput[] {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	if (lines.length < 2) return [];
	const header = parseCsvLine(lines[0]).map((h) => h.trim());
	const out: CreateTestCaseInput[] = [];
	for (const line of lines.slice(1)) {
		const cells = parseCsvLine(line);
		const row: Record<string, string> = {};
		header.forEach((h, i) => (row[h] = cells[i] ?? ''));
		const input = rowToInput(row);
		if (input) out.push(input);
	}
	return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
