import type { TestKind } from '$lib/types';
import type { Tone } from './tone';

/**
 * Filters for the two card grids.
 *
 * Both pages render every row they have — thirty-four suites, sixty-seven
 * runners — and neither had any way to narrow that down. These predicates are
 * pure so the URL stays the single source of truth for what is on screen: a
 * filtered grid is shareable, and the back button undoes a filter.
 */

export interface SuiteFilter {
	q: string;
	/** A test kind the suite contains, or `seed` for the seeding suites. */
	kind: string;
	env: string;
	/** `failing` | `passing` | `never` — judged on the suite's most recent run. */
	state: string;
}

/**
 * Blocked counts as failing throughout: it is what the failure export collects
 * and what the card's Fix button offers, so a filter that excluded it would
 * hide suites that visibly have something to fix.
 */
function needsAttention(lastRun: { fail: number; blocked: number }): boolean {
	return lastRun.fail + lastRun.blocked > 0;
}

export interface SuiteRow {
	id: string;
	name: string;
	description?: string;
	tags: string[];
	kinds: TestKind[];
	tone: Tone;
	defaultEnv: string;
	lastRun: { fail: number; blocked: number } | null;
}

export interface RunnerFilter {
	q: string;
	kind: string;
	lang: string;
	/** `on` | `off` */
	enabled: string;
	health: string;
}

export interface RunnerRow {
	id: string;
	name: string;
	kind: TestKind;
	language: string;
	command: string;
	workingDir: string;
	reportFormat: string;
	enabled: boolean;
	health: string;
}

/** Every word must appear somewhere in the row, so extra words narrow. */
export function matchesQuery(haystack: string, q: string): boolean {
	const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return true;
	const h = haystack.toLowerCase();
	return terms.every((t) => h.includes(t));
}

export function matchesSuite(row: SuiteRow, f: SuiteFilter): boolean {
	if (!matchesQuery(`${row.id} ${row.name} ${row.description ?? ''} ${row.tags.join(' ')}`, f.q))
		return false;
	// `seed` is a tone, not a kind — the seeding suites are shell underneath, so
	// asking for them by kind would return every lint and build suite too.
	if (f.kind === 'seed' && row.tone !== 'seed') return false;
	if (f.kind && f.kind !== 'seed' && !row.kinds.includes(f.kind as TestKind)) return false;
	if (f.env && row.defaultEnv !== f.env) return false;
	if (f.state === 'failing' && !(row.lastRun && needsAttention(row.lastRun))) return false;
	if (f.state === 'passing' && !(row.lastRun && !needsAttention(row.lastRun))) return false;
	if (f.state === 'never' && row.lastRun) return false;
	return true;
}

export function matchesRunner(row: RunnerRow, f: RunnerFilter): boolean {
	if (
		!matchesQuery(
			`${row.id} ${row.name} ${row.command} ${row.workingDir} ${row.reportFormat} ${row.language}`,
			f.q
		)
	)
		return false;
	if (f.kind && row.kind !== f.kind) return false;
	if (f.lang && row.language !== f.lang) return false;
	if (f.enabled === 'on' && !row.enabled) return false;
	if (f.enabled === 'off' && row.enabled) return false;
	if (f.health && row.health !== f.health) return false;
	return true;
}

/** Is anything actually narrowed? Drives the Reset button and the empty state. */
export function isActive(f: SuiteFilter | RunnerFilter): boolean {
	return Object.values(f).some((v) => v !== '');
}
