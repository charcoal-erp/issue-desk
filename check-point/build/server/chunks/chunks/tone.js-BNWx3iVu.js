//#region src/lib/checkpoint/tone.ts
/** Fixed order — also the tie-break for a suite's dominant kind. */
var TONE_ORDER = [
	"unit",
	"api",
	"e2e",
	"visual",
	"shell",
	"manual"
];
/**
* Tags that mean "this rebuilds data rather than testing it". Both are checked
* because the two say different things — one is the suite's purpose, the other
* its blast radius — and either alone is enough to earn the warning colour.
*/
var SEED_TAGS = ["seeding", "destructive:all-databases"];
/** The kind most of a suite's cases are, or null for an empty suite. */
function dominantKind(counts) {
	let best = null;
	let bestCount = 0;
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
function suiteTone(tags, counts) {
	if (tags.some((t) => SEED_TAGS.includes(t))) return "seed";
	return dominantKind(counts) ?? "shell";
}
/** A runner has exactly one kind, so its tone needs no resolution. */
function runnerTone(kind) {
	return kind;
}
function kindCounts(kinds) {
	const out = {};
	for (const k of kinds) out[k] = (out[k] ?? 0) + 1;
	return out;
}

export { kindCounts as k, runnerTone as r, suiteTone as s };
//# sourceMappingURL=tone.js-BNWx3iVu.js.map
