import { b as private_env, p as public_env } from './shared-server.js-9-2j12mp.js';
import path from 'node:path';

//#region src/lib/server/fs/paths.ts
var env = new Proxy({}, { get: (_, key) => private_env[key] ?? process.env[key] });
/** Root of all config / issues / uploads. Overridable via DATA_DIR. */
function dataDir() {
	return path.resolve(env.DATA_DIR || "./data");
}
function configDir() {
	return path.join(dataDir(), "config");
}
function issuesDir(appId) {
	return appId ? path.join(dataDir(), "issues", appId) : path.join(dataDir(), "issues");
}
function moduleFile(appId, moduleId) {
	return path.join(issuesDir(appId), `${moduleId}.json`);
}
function sequenceFile(appId) {
	return path.join(issuesDir(appId), "_sequence.json");
}
function uploadsDir(appId, issueId) {
	const base = path.join(dataDir(), "uploads");
	if (!appId) return base;
	return issueId ? path.join(base, appId, issueId) : path.join(base, appId);
}
function pendingDir(appId, draftId) {
	return path.join(uploadsDir(appId), "_pending", draftId);
}
function maxUploadBytes() {
	return (Number(env.MAX_UPLOAD_MB) || 15) * 1024 * 1024;
}
function maxAttachments() {
	return Number(env.MAX_ATTACHMENTS) || 10;
}
function publicBaseUrl() {
	return (public_env.PUBLIC_BASE_URL || env.PUBLIC_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
}

export { maxUploadBytes as a, moduleFile as b, configDir as c, dataDir as d, publicBaseUrl as e, issuesDir as i, maxAttachments as m, pendingDir as p, sequenceFile as s, uploadsDir as u };
//# sourceMappingURL=paths.js-Erst5pJ8.js.map
