/**
 * Keyed async mutex: writes to the same key (file path or app id) serialise,
 * writes to different keys proceed in parallel (§17 of the design doc).
 */
const chains = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const prev = chains.get(key) ?? Promise.resolve();
	const run = prev.then(fn, fn);
	// Keep the chain alive regardless of fn's outcome, and clean up when idle.
	chains.set(
		key,
		run.catch(() => undefined).finally(() => {
			if (chains.get(key) === run) chains.delete(key);
		})
	);
	return run;
}
