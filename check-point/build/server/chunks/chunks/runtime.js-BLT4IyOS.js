//#region src/lib/server/checkpoint/runtime.ts
/**
* Live-run registry.
*
* Dispatch continues in the background after the launch response returns, so
* the process has to know which runs are executing *right now* — for two
* reasons. First, serialisation: real suites are mutually destructive (one
* end-to-end suite resets the database another one's fixtures depend on), so
* only one automated run may execute at a time. Second, honesty: a run without
* `completedAt` is either genuinely running or was interrupted by a restart,
* and only this registry can tell them apart.
*
* Process-local by design, like the rest of the store. A restart clears it,
* which is exactly right — nothing is executing after a restart, so every
* unfinished run is correctly reported as interrupted.
*/
var active = /* @__PURE__ */ new Map();
/** The automated run currently executing, if any. */
function activeRunId() {
	for (const id of active.keys()) return id;
}
function isRunActive(runId) {
	return active.has(runId);
}
/** Register background dispatch work; the entry clears itself when it settles. */
function trackRun(runId, work) {
	const settled = work.then(() => void 0, (e) => {
		console.error(`[checkpoint] Run ${runId} failed:`, e);
	}).finally(() => {
		if (active.get(runId) === settled) active.delete(runId);
	});
	active.set(runId, settled);
}

export { activeRunId as a, isRunActive as i, trackRun as t };
//# sourceMappingURL=runtime.js-BLT4IyOS.js.map
