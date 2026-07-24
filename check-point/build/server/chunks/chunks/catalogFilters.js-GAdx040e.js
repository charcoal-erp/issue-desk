//#region src/lib/checkpoint/catalogFilters.ts
/**
* Blocked counts as failing throughout: it is what the failure export collects
* and what the card's Fix button offers, so a filter that excluded it would
* hide suites that visibly have something to fix.
*/
function needsAttention(lastRun) {
	return lastRun.fail + lastRun.blocked > 0;
}
/** Every word must appear somewhere in the row, so extra words narrow. */
function matchesQuery(haystack, q) {
	const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return true;
	const h = haystack.toLowerCase();
	return terms.every((t) => h.includes(t));
}
function matchesSuite(row, f) {
	if (!matchesQuery(`${row.id} ${row.name} ${row.description ?? ""} ${row.tags.join(" ")}`, f.q)) return false;
	if (f.kind === "seed" && row.tone !== "seed") return false;
	if (f.kind && f.kind !== "seed" && !row.kinds.includes(f.kind)) return false;
	if (f.env && row.defaultEnv !== f.env) return false;
	if (f.state === "failing" && !(row.lastRun && needsAttention(row.lastRun))) return false;
	if (f.state === "passing" && !(row.lastRun && !needsAttention(row.lastRun))) return false;
	if (f.state === "never" && row.lastRun) return false;
	return true;
}
function matchesRunner(row, f) {
	if (!matchesQuery(`${row.id} ${row.name} ${row.command} ${row.workingDir} ${row.reportFormat} ${row.language}`, f.q)) return false;
	if (f.kind && row.kind !== f.kind) return false;
	if (f.lang && row.language !== f.lang) return false;
	if (f.enabled === "on" && !row.enabled) return false;
	if (f.enabled === "off" && row.enabled) return false;
	if (f.health && row.health !== f.health) return false;
	return true;
}
/** Is anything actually narrowed? Drives the Reset button and the empty state. */
function isActive(f) {
	return Object.values(f).some((v) => v !== "");
}

export { matchesSuite as a, isActive as i, matchesRunner as m };
//# sourceMappingURL=catalogFilters.js-GAdx040e.js.map
