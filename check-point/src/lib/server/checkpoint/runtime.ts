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
const active = new Map<string, Promise<void>>();

/** The automated run currently executing, if any. */
export function activeRunId(): string | undefined {
	for (const id of active.keys()) return id;
	return undefined;
}

export function isRunActive(runId: string): boolean {
	return active.has(runId);
}

/** Register background dispatch work; the entry clears itself when it settles. */
export function trackRun(runId: string, work: Promise<void>): void {
	const settled: Promise<void> = work
		.then(
			() => undefined,
			(e) => {
				console.error(`[checkpoint] Run ${runId} failed:`, e);
			}
		)
		.finally(() => {
			if (active.get(runId) === settled) active.delete(runId);
		});
	active.set(runId, settled);
}

/** Await a run's background dispatch (tests, and any future wait-for-run API). */
export async function whenRunSettles(runId: string): Promise<void> {
	await active.get(runId);
}

export function __resetForTests(): void {
	active.clear();
}
