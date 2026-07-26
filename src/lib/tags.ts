/**
 * Tag vocabulary hygiene (§ AI, analogous to Prism's $lib/tags.ts). Extraction
 * is only as useful as the vocabulary it lands in: without normalisation a
 * tracker sprouts `auth`, `Auth` and `authentication` for one idea, and the
 * filter rail becomes noise. Model output is treated as *candidates* and
 * reconciled against the tags already in use before it is offered to the user.
 */

/** "Login Bug!" → "login-bug". Idempotent. Matches the issue tag slug shape. */
export function slugify(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

const ACRONYMS = new Set(['ui', 'ux', 'api', 'sql', 'csv', 'pdf', 'otp', 'sso', 'gst', 'kyc']);

/** "login-otp" → "Login OTP" — a display label for a fresh slug. */
export function labelFor(slug: string): string {
	const words = slug.split('-').filter(Boolean);
	if (!words.length) return slug;
	const [first, ...rest] = words;
	const head = ACRONYMS.has(first) ? first.toUpperCase() : first[0].toUpperCase() + first.slice(1);
	return [head, ...rest.map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w))].join(' ');
}

/** Hand-maintained folds for pairs no string metric should be trusted to catch. */
const SYNONYMS: Record<string, string> = {
	auth: 'authentication',
	login: 'authentication',
	perf: 'performance',
	a11y: 'accessibility',
	i18n: 'internationalization',
	regress: 'regression',
	ui: 'ui',
	frontend: 'ui',
	backend: 'api'
};

/** Normalise a slug for equivalence: drop plurals and fold known synonyms. */
function stem(slug: string): string {
	const folded = SYNONYMS[slug] ?? slug;
	return folded
		.split('-')
		.map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
		.join('-');
}

/**
 * Dice coefficient over character bigrams — 0 (nothing shared) to 1 (equal).
 * Cheap, dependency-free, stable for the short strings tags actually are.
 */
export function similarity(a: string, b: string): number {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;
	const pairs = (s: string) => {
		const out = new Map<string, number>();
		for (let i = 0; i < s.length - 1; i++) {
			const p = s.slice(i, i + 2);
			out.set(p, (out.get(p) ?? 0) + 1);
		}
		return out;
	};
	const pa = pairs(a);
	const pb = pairs(b);
	let shared = 0;
	let total = 0;
	for (const n of pa.values()) total += n;
	for (const [pair, n] of pb) {
		total += n;
		shared += Math.min(n, pa.get(pair) ?? 0);
	}
	return (2 * shared) / total;
}

/**
 * Fold a candidate slug onto an existing one when they mean the same thing.
 * Exact match, then singular/plural + synonyms, then a high similarity floor
 * (0.86) — merging two tags that merely look alike is worse than keeping a
 * near-duplicate, because a wrong merge silently retags issues with no undo.
 */
export function canonicalise(candidate: string, vocabulary: readonly string[]): string {
	const slug = slugify(candidate);
	if (!slug) return slug;
	if (vocabulary.includes(slug)) return slug;

	const normalised = stem(slug);
	for (const known of vocabulary) {
		if (stem(known) === normalised) return known;
	}

	let best: { slug: string; score: number } | undefined;
	for (const known of vocabulary) {
		const score = similarity(slug, known);
		if (score >= 0.86 && (!best || score > best.score)) best = { slug: known, score };
	}
	return best?.slug ?? slug;
}

/**
 * Normalise a batch of raw model output into the vocabulary: slugify,
 * canonicalise against what already exists, drop blanks, de-duplicate while
 * preserving the model's ordering (it tends to emit the most salient first).
 */
export function reconcileTags(raw: readonly string[], vocabulary: readonly string[]): string[] {
	const out: string[] = [];
	const growing = [...vocabulary];
	for (const candidate of raw) {
		const slug = canonicalise(candidate, growing);
		if (!slug || out.includes(slug)) continue;
		out.push(slug);
		if (!growing.includes(slug)) growing.push(slug);
	}
	return out;
}
