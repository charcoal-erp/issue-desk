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

export function uploadsDir(appId?: string, issueId?: string): string {
	const base = path.join(dataDir(), 'uploads');
	if (!appId) return base;
	return issueId ? path.join(base, appId, issueId) : path.join(base, appId);
}

export function pendingDir(appId: string, draftId: string): string {
	return path.join(uploadsDir(appId), '_pending', draftId);
}

/** Encrypted provider-key store (§ AI). Kept out of exports and git-ignored. */
export function vaultDir(): string {
	return path.join(dataDir(), 'vault');
}

export function credentialFile(provider: string): string {
	return path.join(vaultDir(), `${provider}.json`);
}

/** Base64 32-byte AES key encrypting the vault. Unset = writes refused. */
export function keyEncryptionKey(): string | undefined {
	return env.KEY_ENCRYPTION_KEY || undefined;
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
