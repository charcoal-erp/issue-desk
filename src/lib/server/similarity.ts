import type { Issue } from '$lib/types';

/**
 * The keyword half of duplicate detection: cheap, deterministic, and run over
 * every issue. It decides which handful the model gets to read, and it is the
 * whole answer when AI is unavailable — so it has to rank sensibly on its own.
 *
 * TF-IDF cosine over words, so a shared rare word ("payroll", "otp") counts for
 * far more than a shared common one ("page", "error"). Title words are counted
 * three times: titles are the condensed claim, descriptions the long tail.
 * Shared tags add on top, since a tag is someone's deliberate classification.
 */

export interface SimilarityQuery {
	title: string;
	description?: string;
	tags?: string[];
	appId?: string;
	moduleId?: string;
}

export interface KeywordMatch {
	issue: Issue;
	/** 0–100. */
	score: number;
}

const TITLE_WEIGHT = 3;

// Words that appear in nearly every report and say nothing about which one.
const STOPWORDS = new Set(
	`the and for are but not you all any can had her was one our out has have
	this that with from they will would there their what when which while into
	than then them these those been being were does did doing its it's also just
	only very should could each other some such more most same able unable when
	issue issues bug bugs page screen user users please need needs getting get
	gets shows show showing working work works after before should there where
	instead even still also click clicked clicking`.split(/\s+/)
);

/** Lowercased word stems, minus noise. Exported for tests. */
export function tokenize(text: string): string[] {
	const out: string[] = [];
	for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
		if (raw.length < 3 || STOPWORDS.has(raw) || /^\d+$/.test(raw)) continue;
		// Light stemming — enough to meet "invoices" with "invoice" and
		// "creating" with "created" and "create", without a dictionary. The
		// stems are not words ("creat"); they only have to agree with each other.
		let w = raw;
		if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
		else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
		else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
		if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
		out.push(w);
	}
	return out;
}

function termCounts(title: string, description: string): Map<string, number> {
	const tf = new Map<string, number>();
	for (const t of tokenize(title)) tf.set(t, (tf.get(t) ?? 0) + TITLE_WEIGHT);
	for (const t of tokenize(description)) tf.set(t, (tf.get(t) ?? 0) + 1);
	return tf;
}

function vector(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
	const v = new Map<string, number>();
	for (const [t, n] of tf) {
		const w = idf.get(t);
		if (w) v.set(t, (1 + Math.log(n)) * w);
	}
	return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (const [t, w] of a) {
		na += w * w;
		const o = b.get(t);
		if (o) dot += w * o;
	}
	for (const w of b.values()) nb += w * w;
	return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function jaccard(a: string[], b: string[]): number {
	if (!a.length || !b.length) return 0;
	const sa = new Set(a.map((t) => t.toLowerCase()));
	const sb = new Set(b.map((t) => t.toLowerCase()));
	let both = 0;
	for (const t of sa) if (sb.has(t)) both += 1;
	return both / (sa.size + sb.size - both);
}

/** Every issue scored against the query, best first; zero scores dropped. */
export function keywordMatches(query: SimilarityQuery, issues: Issue[], limit: number): KeywordMatch[] {
	const docs = issues.map((issue) => ({ issue, tf: termCounts(issue.title, issue.description) }));
	const df = new Map<string, number>();
	for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
	const idf = new Map<string, number>();
	for (const [t, n] of df) idf.set(t, Math.log(1 + docs.length / n));
	// A query word no issue uses can't match anything, but it still belongs in
	// the query's length — otherwise a long, novel report would look like a
	// strong match for anything sharing its one common word.
	const qtf = termCounts(query.title, query.description ?? '');
	for (const t of qtf.keys()) if (!idf.has(t)) idf.set(t, Math.log(1 + docs.length));
	const qv = vector(qtf, idf);

	const out: KeywordMatch[] = [];
	for (const d of docs) {
		const text = cosine(qv, vector(d.tf, idf));
		const tags = jaccard(query.tags ?? [], d.issue.tags);
		let score = 0.8 * text + 0.2 * tags;
		// Same place in the product is weak evidence on its own, so it only
		// nudges a match that already shares words.
		if (text > 0 && query.appId && d.issue.appId === query.appId) {
			score += query.moduleId && d.issue.moduleId === query.moduleId ? 0.05 : 0.02;
		}
		const pct = Math.min(100, Math.round(score * 100));
		if (pct > 0) out.push({ issue: d.issue, score: pct });
	}
	return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
