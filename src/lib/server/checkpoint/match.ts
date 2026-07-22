import type { CaseResult, MatchStrategy, TestCase } from '$lib/types';
import type { ReportEntry } from './report';

/**
 * Match report entries back to Checkpoint cases (design doc §7.2). Each
 * MatchStrategy decides what a case's identity is; unmatched entries are
 * orphans and cases with no entry are gaps (recorded skipped by the caller).
 */
export interface MatchOutcome {
	results: CaseResult[]; // matched cases → results
	orphans: ReportEntry[]; // report entries with no matching case
	missing: TestCase[]; // participating cases with no report entry
}

/** The last path segment (after `::`) — bridges pytest nodeid path/dot forms. */
function lastSeg(s: string): string {
	const t = s.trim();
	return t.includes('::') ? t.split('::').pop()!.trim() : t;
}

function idEquivalent(a: string, b: string): boolean {
	if (!a || !b) return false;
	if (a === b) return true;
	const la = lastSeg(a);
	const lb = lastSeg(b);
	return la !== '' && la === lb;
}

function entryTokens(e: ReportEntry): string[] {
	return [e.identifier, ...(e.aliases ?? [])].filter(Boolean);
}

function caseMatchesEntry(strategy: MatchStrategy, c: TestCase, e: ReportEntry): boolean {
	const tokens = entryTokens(e);
	if (strategy.by === 'annotation') {
		// The annotation carries the case id or external id verbatim, e.g.
		// "@checkpoint TC-CHR-08" → find the exact token.
		const words = tokens.flatMap((t) => t.split(/\s+/));
		return words.includes(c.id) || (c.externalTestId != null && words.includes(c.externalTestId));
	}
	// nodeid | testName | snapshotName | tapName | explicitMap all compare the
	// case's external identifier to the report's identifier / aliases.
	const key = c.externalTestId;
	if (!key) return false;
	return tokens.some((t) => idEquivalent(key, t));
}

function entryToResult(e: ReportEntry, c: TestCase, runnerId: string | null): CaseResult {
	return {
		testCaseId: c.id,
		runnerId,
		status: e.status,
		durationMs: e.durationMs,
		message: e.message,
		stack: e.stack,
		artifacts: e.artifacts,
		flaky: e.flaky || undefined
	};
}

/** A case that the report never mentioned — recorded skipped with a reason. */
export function skippedResult(
	c: TestCase,
	runnerId: string | null,
	reason: string
): CaseResult {
	return {
		testCaseId: c.id,
		runnerId,
		status: 'skipped',
		durationMs: null,
		message: reason,
		stack: null,
		artifacts: []
	};
}

export function matchEntries(
	entries: ReportEntry[],
	cases: TestCase[],
	strategy: MatchStrategy,
	runnerId: string | null
): MatchOutcome {
	const used = new Set<string>();
	const results: CaseResult[] = [];
	const orphans: ReportEntry[] = [];
	for (const e of entries) {
		const c = cases.find((c) => !used.has(c.id) && caseMatchesEntry(strategy, c, e));
		if (c) {
			used.add(c.id);
			results.push(entryToResult(e, c, runnerId));
		} else {
			orphans.push(e);
		}
	}
	const missing = cases.filter((c) => !used.has(c.id));
	return { results, orphans, missing };
}

/**
 * exit-code adapter (design doc §7.1): one synthetic result per mapped case —
 * exit 0 → pass, non-zero → fail with the tail of stdout/stderr as the message.
 */
export function exitCodeResults(
	cases: TestCase[],
	exitCode: number,
	output: string,
	runnerId: string | null
): CaseResult[] {
	const ok = exitCode === 0;
	const tail = output.split(/\r?\n/).filter(Boolean).slice(-12).join('\n') || null;
	return cases.map((c) => ({
		testCaseId: c.id,
		runnerId,
		status: ok ? 'pass' : 'fail',
		durationMs: null,
		message: ok ? null : `exit ${exitCode}`,
		stack: ok ? null : tail,
		artifacts: []
	}));
}
