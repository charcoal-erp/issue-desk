import type { TestKind } from '$lib/types';

/**
 * A card's tone — the hue of its background wash and top rail.
 *
 * Colour answers one question here: *what kind of thing is this?* So tones
 * reuse the kind palette the KindBadge already draws from — learn a hue once
 * and it means the same on a badge, a runner card and a suite card. A grid of
 * sixty-seven runners or thirty-four suites is otherwise a wall of identical
 * white rectangles.
 *
 * `seed` is the one addition to the kind vocabulary. Seeding suites are not
 * tests at all — they rebuild the platform's data by calling the real APIs, and
 * they are the only cards in the catalogue that can drop a database. A warm red
 * keeps them from ever blending into a grid of ordinary suites.
 */
export type Tone = TestKind | 'seed';

/** Fixed order — also the tie-break for a suite's dominant kind. */
export const TONE_ORDER: TestKind[] = ['unit', 'api', 'e2e', 'visual', 'shell', 'manual'];

/**
 * Tags that mean "this rebuilds data rather than testing it". Both are checked
 * because the two say different things — one is the suite's purpose, the other
 * its blast radius — and either alone is enough to earn the warning colour.
 */
const SEED_TAGS = ['seeding', 'destructive:all-databases'];

/** The kind most of a suite's cases are, or null for an empty suite. */
export function dominantKind(counts: Partial<Record<TestKind, number>>): TestKind | null {
	let best: TestKind | null = null;
	let bestCount = 0;
	// Iterating a fixed order rather than the object's keys means a tie always
	// resolves the same way, whatever order the cases were added in.
	for (const kind of TONE_ORDER) {
		const n = counts[kind] ?? 0;
		if (n > bestCount) {
			best = kind;
			bestCount = n;
		}
	}
	return best;
}

/** A suite is coloured by what it mostly contains, unless it seeds data. */
export function suiteTone(tags: string[], counts: Partial<Record<TestKind, number>>): Tone {
	if (tags.some((t) => SEED_TAGS.includes(t))) return 'seed';
	return dominantKind(counts) ?? 'shell';
}

/** A runner has exactly one kind, so its tone needs no resolution. */
export function runnerTone(kind: TestKind): Tone {
	return kind;
}

export function kindCounts(kinds: TestKind[]): Partial<Record<TestKind, number>> {
	const out: Partial<Record<TestKind, number>> = {};
	for (const k of kinds) out[k] = (out[k] ?? 0) + 1;
	return out;
}
