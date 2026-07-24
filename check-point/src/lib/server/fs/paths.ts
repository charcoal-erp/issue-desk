import path from 'node:path';
import { env as kitEnv } from '$env/dynamic/private';

// $env/dynamic/private is empty under vitest *unless* an .env file is present,
// and it outranks process.env here — so test overrides belong in .env.test, not
// in vitest's test.env.
const env = new Proxy({} as Record<string, string | undefined>, {
	get: (_, key: string) => kitEnv[key] ?? process.env[key]
});

/**
 * Root of this Checkpoint's content: tests / suites / runs / runners.json /
 * reports / config. Overridable via DATA_DIR — point it at a checked-out
 * content repo (e.g. charcoal's platform-testing), or let the app seed an
 * empty catalogue here.
 */
export function dataDir(): string {
	return path.resolve(env.DATA_DIR || './checkpoint-data');
}

/**
 * Kept as an alias of dataDir(). In the combined app this pointed at a separate
 * root from the issue tracker; Checkpoint is now its own app, so its one
 * DATA_DIR *is* the checkpoint root. Retained so the store and readers need no
 * churn.
 */
export function checkpointDataDir(): string {
	return dataDir();
}

/** This Checkpoint's own applications + users taxonomy. */
export function configDir(): string {
	return path.join(dataDir(), 'config');
}

// ---------- Checkpoint content directories (design doc §9) ----------
export function testsDir(appId?: string): string {
	return appId ? path.join(dataDir(), 'tests', appId) : path.join(dataDir(), 'tests');
}

export function testModuleFile(appId: string, moduleId: string): string {
	return path.join(testsDir(appId), `${moduleId}.json`);
}

/** Per-app Checkpoint counters (testCase / suite / run), kept beside the cases. */
export function checkpointSequenceFile(appId: string): string {
	return path.join(testsDir(appId), '_sequence.json');
}

export function suitesDir(): string {
	return path.join(dataDir(), 'suites');
}

export function suitesFile(appId: string): string {
	return path.join(suitesDir(), `${appId}.json`);
}

export function runsDir(appId?: string): string {
	return appId ? path.join(dataDir(), 'runs', appId) : path.join(dataDir(), 'runs');
}

export function runFile(appId: string, runId: string): string {
	return path.join(runsDir(appId), `${runId}.json`);
}

export function runnersFile(): string {
	return path.join(dataDir(), 'runners.json');
}

/** Captured raw reports & artifacts, copied in at ingest for stable paths. */
export function reportsDir(runId?: string): string {
	return runId ? path.join(dataDir(), 'reports', runId) : path.join(dataDir(), 'reports');
}
