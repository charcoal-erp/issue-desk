import path from 'node:path';
import { env as kitEnv } from '$env/dynamic/private';
import { env as kitEnvPublic } from '$env/dynamic/public';

// $env/dynamic/private is empty under vitest *unless* an .env file is present,
// and it outranks process.env here — so test overrides belong in .env.test, not
// in vitest's test.env.
const env = new Proxy({} as Record<string, string | undefined>, {
	get: (_, key: string) => kitEnv[key] ?? process.env[key]
});

/** Root of all config / issues / uploads. Overridable via DATA_DIR. */
export function dataDir(): string {
	return path.resolve(env.DATA_DIR || './data');
}

/**
 * Root of the Checkpoint content (tests / suites / runs / runners.json /
 * reports). Defaults to DATA_DIR — one combined root, the original layout —
 * but can point at a separate folder (e.g. a git-versioned content repo like
 * charcoal's platform-testing) via CHECKPOINT_DATA_DIR, leaving the issue
 * tracker's data untouched where it is.
 */
export function checkpointDataDir(): string {
	return env.CHECKPOINT_DATA_DIR ? path.resolve(env.CHECKPOINT_DATA_DIR) : dataDir();
}

export function configDir(): string {
	return path.join(dataDir(), 'config');
}

export function issuesDir(appId?: string): string {
	return appId ? path.join(dataDir(), 'issues', appId) : path.join(dataDir(), 'issues');
}

export function moduleFile(appId: string, moduleId: string): string {
	return path.join(issuesDir(appId), `${moduleId}.json`);
}

export function sequenceFile(appId: string): string {
	return path.join(issuesDir(appId), '_sequence.json');
}

// ---------- Checkpoint directories (design doc §9) ----------
export function testsDir(appId?: string): string {
	return appId
		? path.join(checkpointDataDir(), 'tests', appId)
		: path.join(checkpointDataDir(), 'tests');
}

export function testModuleFile(appId: string, moduleId: string): string {
	return path.join(testsDir(appId), `${moduleId}.json`);
}

/** Per-app Checkpoint counters (testCase / suite / run), kept beside the cases. */
export function checkpointSequenceFile(appId: string): string {
	return path.join(testsDir(appId), '_sequence.json');
}

export function suitesDir(): string {
	return path.join(checkpointDataDir(), 'suites');
}

export function suitesFile(appId: string): string {
	return path.join(suitesDir(), `${appId}.json`);
}

export function runsDir(appId?: string): string {
	return appId
		? path.join(checkpointDataDir(), 'runs', appId)
		: path.join(checkpointDataDir(), 'runs');
}

export function runFile(appId: string, runId: string): string {
	return path.join(runsDir(appId), `${runId}.json`);
}

export function runnersFile(): string {
	return path.join(checkpointDataDir(), 'runners.json');
}

/** Captured raw reports & artifacts, copied in at ingest for stable paths. */
export function reportsDir(runId?: string): string {
	return runId
		? path.join(checkpointDataDir(), 'reports', runId)
		: path.join(checkpointDataDir(), 'reports');
}

export function uploadsDir(appId?: string, issueId?: string): string {
	const base = path.join(dataDir(), 'uploads');
	if (!appId) return base;
	return issueId ? path.join(base, appId, issueId) : path.join(base, appId);
}

export function pendingDir(appId: string, draftId: string): string {
	return path.join(uploadsDir(appId), '_pending', draftId);
}

export function maxUploadBytes(): number {
	return (Number(env.MAX_UPLOAD_MB) || 15) * 1024 * 1024;
}

export function maxAttachments(): number {
	return Number(env.MAX_ATTACHMENTS) || 10;
}

export function publicBaseUrl(): string {
	// PUBLIC_-prefixed vars are excluded from $env/dynamic/private, so read the
	// public module (and raw process.env, for values set outside a .env file).
	const configured = kitEnvPublic.PUBLIC_BASE_URL || env.PUBLIC_BASE_URL;
	return (configured || 'http://localhost:5173').replace(/\/$/, '');
}
