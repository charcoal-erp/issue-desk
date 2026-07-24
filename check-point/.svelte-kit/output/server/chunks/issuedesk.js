import { t as private_env } from "./shared-server.js";
//#region src/lib/server/issuedesk.ts
var env = new Proxy({}, { get: (_, key) => private_env[key] ?? process.env[key] });
function baseUrl() {
	const raw = env.ISSUEDESK_URL?.trim();
	return raw ? raw.replace(/\/$/, "") : null;
}
/** Is a central IssueDesk wired up for this Checkpoint? */
function isConfigured() {
	return baseUrl() !== null;
}
/** The configured IssueDesk base URL (no trailing slash), or null. */
function configuredUrl() {
	return baseUrl();
}
function authHeaders() {
	const token = env.ISSUEDESK_TOKEN?.trim();
	return token ? { authorization: `Bearer ${token}` } : {};
}
/**
* File a bug in IssueDesk. Returns the created issue's id, or throws with a
* readable message the action surfaces. Callers must gate on isConfigured().
*/
async function createIssue(payload, reporterId) {
	const base = baseUrl();
	if (!base) throw new Error("No IssueDesk is configured (set ISSUEDESK_URL).");
	const res = await fetch(`${base}/api/issues`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...authHeaders()
		},
		body: JSON.stringify({
			...payload,
			reporterId
		})
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`IssueDesk rejected the issue (${res.status}). ${detail}`.trim());
	}
	const body = await res.json();
	if (!body.issue?.id) throw new Error("IssueDesk returned no issue id.");
	return { id: body.issue.id };
}
/** Resolve one issue's title/status, or null if unconfigured / not found. */
async function getIssue(id) {
	const base = baseUrl();
	if (!base) return null;
	try {
		const res = await fetch(`${base}/api/issues/${encodeURIComponent(id)}`, { headers: authHeaders() });
		if (!res.ok) return null;
		return (await res.json()).issue ?? null;
	} catch {
		return null;
	}
}
/** Open issues for the parent-issue picker, or [] if unconfigured / unreachable. */
async function listIssues() {
	const base = baseUrl();
	if (!base) return [];
	try {
		const res = await fetch(`${base}/api/issues`, { headers: authHeaders() });
		if (!res.ok) return [];
		return (await res.json()).issues ?? [];
	} catch {
		return [];
	}
}
//#endregion
export { listIssues as a, isConfigured as i, createIssue as n, getIssue as r, configuredUrl as t };
