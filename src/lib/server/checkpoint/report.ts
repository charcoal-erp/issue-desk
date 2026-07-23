import type { ReportFormat, ResultStatus } from '$lib/types';

/**
 * Report normalization (design doc §7.1). Every adapter parses its own format
 * into one shape — a list of {@link ReportEntry}. That is why a run spanning
 * pytest, Playwright and a bash script still yields one pass rate and one
 * failure export. Parsers are dependency-free and resilient: a malformed or
 * partial report yields the entries it could read (or none), never a throw.
 */
export interface ReportEntry {
	identifier: string; // nodeid / test name / snapshot name / TAP description
	aliases?: string[]; // extra tokens the matcher may key on (annotations, titles)
	status: ResultStatus;
	durationMs: number | null;
	message: string | null; // assertion text / first error line
	stack: string | null; // trimmed stack or diff summary
	artifacts: string[]; // trace.zip, screenshot.png, diff.png, stdout.log
	flaky?: boolean; // flipped across attempts within this report
}

// ---------- shared helpers ----------
function decodeXml(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#10;/g, '\n')
		.replace(/&#9;/g, '\t')
		.replace(/&amp;/g, '&');
}

function parseAttrs(s: string): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(s))) out[m[1]] = decodeXml(m[2]);
	return out;
}

function firstLine(s: string | null): string | null {
	if (!s) return null;
	const line = s.split(/\r?\n/).find((l) => l.trim());
	return line ? line.trim() : null;
}

function ms(seconds: number | null | undefined): number | null {
	return seconds == null ? null : Math.round(seconds * 1000);
}

// ---------- junit-xml (pytest and many others) ----------
export function parseJUnit(xml: string): ReportEntry[] {
	const entries: ReportEntry[] = [];
	const caseRe = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
	let m: RegExpExecArray | null;
	while ((m = caseRe.exec(xml))) {
		const attrs = parseAttrs(m[1]);
		const body = m[3] ?? '';
		const name = attrs.name ?? '';
		const classname = attrs.classname ?? '';
		const identifier = classname ? `${classname}::${name}` : name;
		let status: ResultStatus = 'pass';
		let message: string | null = null;
		let stack: string | null = null;
		const fail = /<(failure|error)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/.exec(body);
		if (fail) {
			status = 'fail';
			const fa = parseAttrs(fail[2]);
			message = fa.message ? decodeXml(fa.message) : null;
			stack = decodeXml(fail[4] ?? '').trim() || null;
			if (!message) message = firstLine(stack);
		} else if (/<skipped\b/.test(body)) {
			status = 'skipped';
		}
		entries.push({
			identifier,
			aliases: name && name !== identifier ? [name] : undefined,
			status,
			durationMs: attrs.time ? ms(parseFloat(attrs.time)) : null,
			message,
			stack,
			artifacts: []
		});
	}
	return entries;
}

// ---------- playwright-json (also used for visual-diff) ----------
function pwStatus(s: string): ResultStatus {
	if (s === 'passed') return 'pass';
	if (s === 'skipped') return 'skipped';
	if (s === 'interrupted') return 'blocked';
	return 'fail'; // failed | timedOut | anything unexpected
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parsePlaywright(json: string): ReportEntry[] {
	const data = JSON.parse(json);
	const entries: ReportEntry[] = [];
	const walk = (suite: any, prefix: string[]) => {
		const here = [...prefix, suite.title].filter(Boolean);
		for (const spec of suite.specs ?? []) {
			for (const test of spec.tests ?? []) {
				const results = test.results ?? [];
				const last = results[results.length - 1];
				if (!last) continue;
				const flaky = results.length > 1 && new Set(results.map((r: any) => r.status)).size > 1;
				const annotations = [...(test.annotations ?? []), ...(spec.annotations ?? [])]
					.map((a: any) => a?.description || a?.type)
					.filter(Boolean);
				const artifacts = (last.attachments ?? [])
					.map((a: any) => a?.path || a?.name)
					.filter(Boolean);
				const titlePath = [...here, spec.title].filter(Boolean);
				entries.push({
					identifier: titlePath.join(' › '),
					aliases: [spec.title, ...annotations, ...titlePath].filter(Boolean),
					status: pwStatus(last.status),
					durationMs: last.duration ?? null,
					message: last.error?.message ? firstLine(last.error.message) : null,
					stack: last.error?.stack ?? last.error?.message ?? null,
					artifacts,
					flaky: flaky || undefined
				});
			}
		}
		for (const child of suite.suites ?? []) walk(child, here);
	};
	for (const suite of data.suites ?? []) walk(suite, []);
	return entries;
}

// ---------- vitest-json / jest-json ----------
function jestStatus(s: string): ResultStatus {
	if (s === 'passed') return 'pass';
	if (s === 'failed') return 'fail';
	return 'skipped'; // skipped | pending | todo | disabled
}

export function parseVitest(json: string): ReportEntry[] {
	const data = JSON.parse(json);
	const entries: ReportEntry[] = [];
	for (const file of data.testResults ?? []) {
		for (const a of file.assertionResults ?? []) {
			const fullName = a.fullName || [...(a.ancestorTitles ?? []), a.title].filter(Boolean).join(' ');
			const first = (a.failureMessages ?? [])[0] ?? null;
			entries.push({
				identifier: fullName,
				aliases: a.title && a.title !== fullName ? [a.title] : undefined,
				status: jestStatus(a.status),
				durationMs: a.duration ?? null,
				message: firstLine(first),
				stack: first,
				artifacts: []
			});
		}
	}
	return entries;
}

// ---------- pytest-json (pytest-json-report) ----------
function pytestStatus(s: string): ResultStatus {
	if (s === 'passed' || s === 'xpassed') return 'pass';
	if (s === 'skipped' || s === 'xfailed') return 'skipped';
	return 'fail'; // failed | error
}

export function parsePytestJson(json: string): ReportEntry[] {
	const data = JSON.parse(json);
	const entries: ReportEntry[] = [];
	for (const t of data.tests ?? []) {
		const call = t.call ?? {};
		const longrepr =
			typeof call.longrepr === 'string' ? call.longrepr : (call.crash?.message ?? t.longrepr ?? null);
		entries.push({
			identifier: t.nodeid ?? '',
			status: pytestStatus(t.outcome ?? 'failed'),
			durationMs: t.duration != null ? ms(t.duration) : ms(call.duration),
			message: firstLine(longrepr),
			stack: longrepr ?? null,
			artifacts: []
		});
	}
	return entries;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------- tap (shell scripts on stdout) ----------
export function parseTap(text: string): ReportEntry[] {
	const entries: ReportEntry[] = [];
	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const m = /^(ok|not ok)\s+\d+\s*-?\s*(.*)$/.exec(lines[i].trim());
		if (!m) continue;
		let status: ResultStatus = m[1] === 'ok' ? 'pass' : 'fail';
		let desc = m[2].trim();
		if (/#\s*(SKIP|TODO)\b/i.test(desc)) {
			status = 'skipped';
			desc = desc.replace(/#.*$/, '').trim();
		}
		// Optional YAML diagnostics block.
		let message: string | null = null;
		if (lines[i + 1]?.trim() === '---') {
			const yaml: string[] = [];
			let j = i + 2;
			while (j < lines.length && lines[j].trim() !== '...') yaml.push(lines[j++]);
			message = yaml.join('\n').trim() || null;
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

// ---------- checkpoint-json ----------
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
const CHECKPOINT_STATUS: Record<string, ResultStatus> = {
	pass: 'pass',
	passed: 'pass',
	ok: 'pass',
	success: 'pass',
	succeeded: 'pass',
	fail: 'fail',
	failed: 'fail',
	failure: 'fail',
	error: 'fail',
	errored: 'fail',
	blocked: 'blocked',
	skip: 'skipped',
	skipped: 'skipped',
	pending: 'skipped',
	todo: 'skipped'
};

function strOrNull(v: unknown): string | null {
	if (v === null || v === undefined) return null;
	const s = String(v).trim();
	return s || null;
}

function parseCheckpointJson(content: string): ReportEntry[] {
	const data = JSON.parse(content);
	const rows: unknown[] = Array.isArray(data)
		? data
		: ((data?.results ?? data?.entries ?? data?.tests ?? []) as unknown[]);
	const entries: ReportEntry[] = [];
	for (const raw of rows) {
		if (!raw || typeof raw !== 'object') continue;
		const row = raw as Record<string, unknown>;
		const identifier = strOrNull(
			row.identifier ?? row.id ?? row.testId ?? row.name ?? row.test ?? row.testName
		);
		if (!identifier) continue;
		const aliases = Array.isArray(row.aliases)
			? row.aliases.map((a) => String(a)).filter(Boolean)
			: undefined;
		const duration = row.durationMs ?? row.duration_ms ?? row.durationMillis;
		const artifacts = Array.isArray(row.artifacts)
			? row.artifacts.map((a) => String(a)).filter(Boolean)
			: [];
		entries.push({
			identifier,
			aliases: aliases?.length ? aliases : undefined,
			status: CHECKPOINT_STATUS[String(row.status ?? '').toLowerCase()] ?? 'skipped',
			durationMs: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
			message: firstLine(strOrNull(row.message ?? row.notes ?? row.summary)),
			stack: strOrNull(row.stack ?? row.details ?? row.output),
			artifacts,
			flaky: row.flaky === true ? true : undefined
		});
	}
	return entries;
}

// ---------- dispatch ----------
/**
 * Parse raw report content into normalized entries. `exit-code` and `custom`
 * are not content parsers — exit-code is applied at execution time against the
 * mapped case list, and custom is a user-supplied module (out of scope for v1;
 * `checkpoint-json` covers the same need without loading foreign code).
 */
export function parseReport(format: ReportFormat, content: string): ReportEntry[] {
	try {
		switch (format) {
			case 'junit-xml':
				return parseJUnit(content);
			case 'playwright-json':
			case 'visual-diff':
				return parsePlaywright(content);
			case 'vitest-json':
				return parseVitest(content);
			case 'pytest-json':
				return parsePytestJson(content);
			case 'tap':
				return parseTap(content);
			case 'checkpoint-json':
				return parseCheckpointJson(content);
			case 'exit-code':
			case 'custom':
				return [];
		}
	} catch (e) {
		console.error(`[checkpoint] Failed to parse ${format} report:`, (e as Error).message);
		return [];
	}
}
