import path from 'node:path';
import { env } from '$env/dynamic/private';

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

export function maxUploadBytes(): number {
	return (Number(env.MAX_UPLOAD_MB) || 15) * 1024 * 1024;
}

export function maxAttachments(): number {
	return Number(env.MAX_ATTACHMENTS) || 10;
}

export function publicBaseUrl(): string {
	return (env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
}
