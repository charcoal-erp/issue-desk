import { env as kitEnv } from '$env/dynamic/private';

// Same pattern as fs/paths: $env/dynamic/private is empty under vitest unless an
// .env is present and outranks process.env, so fall back to process.env for
// values (and test overrides) set outside a .env file.
const env = new Proxy({} as Record<string, string | undefined>, {
	get: (_, key: string) => kitEnv[key] ?? process.env[key]
});

/**
 * Optional HTTP link to the central IssueDesk.
 *
 * Checkpoint runs on many machines and environments; IssueDesk is one shared
 * instance. When `ISSUEDESK_URL` is set, a failure can be filed as a bug there
 * and issue references resolve to real titles and links. When it is not set,
 * Checkpoint is fully standalone — the "file a bug" affordances hide and
 * failures export as a Claude Code prompt instead. No code is shared with
 * IssueDesk; this is a plain JSON API call.
 */

/** The body IssueDesk's `POST /api/issues` accepts (its createIssueSchema). */
export interface CreateIssuePayload {
	type: 'bug' | 'feature';
	title: string;
	description: string;
	appId: string;
	moduleId: string;
	page?: string;
	form?: string;
	priority: string;
	status: string;
	assigneeId?: string;
	tags: string[];
	attachments: never[];
	testCaseId?: string;
	runId?: string;
}

export interface IssueRef {
	id: string;
	title: string;
	status: string;
}

function baseUrl(): string | null {
	const raw = env.ISSUEDESK_URL?.trim();
	return raw ? raw.replace(/\/$/, '') : null;
}

/** Is a central IssueDesk wired up for this Checkpoint? */
export function isConfigured(): boolean {
	return baseUrl() !== null;
}

/** The configured IssueDesk base URL (no trailing slash), or null. */
export function configuredUrl(): string | null {
	return baseUrl();
}

/** The browser-facing URL of an issue, or null when no IssueDesk is configured. */
export function issueUrl(id: string): string | null {
	const base = baseUrl();
	return base ? `${base}/issues/${encodeURIComponent(id)}` : null;
}

function authHeaders(): Record<string, string> {
	const token = env.ISSUEDESK_TOKEN?.trim();
	return token ? { authorization: `Bearer ${token}` } : {};
}

/**
 * File a bug in IssueDesk. Returns the created issue's id, or throws with a
 * readable message the action surfaces. Callers must gate on isConfigured().
 */
export async function createIssue(
	payload: CreateIssuePayload,
	reporterId: string
): Promise<{ id: string }> {
	const base = baseUrl();
	if (!base) throw new Error('No IssueDesk is configured (set ISSUEDESK_URL).');
	const res = await fetch(`${base}/api/issues`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ ...payload, reporterId })
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new Error(`IssueDesk rejected the issue (${res.status}). ${detail}`.trim());
	}
	const body = (await res.json()) as { issue?: { id?: string } };
	if (!body.issue?.id) throw new Error('IssueDesk returned no issue id.');
	return { id: body.issue.id };
}

/** Resolve one issue's title/status, or null if unconfigured / not found. */
export async function getIssue(id: string): Promise<IssueRef | null> {
	const base = baseUrl();
	if (!base) return null;
	try {
		const res = await fetch(`${base}/api/issues/${encodeURIComponent(id)}`, {
			headers: authHeaders()
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { issue?: IssueRef };
		return body.issue ?? null;
	} catch {
		// A central tracker that is momentarily unreachable must not break the
		// page — the id still renders, just without a resolved title.
		return null;
	}
}

/** Open issues for the parent-issue picker, or [] if unconfigured / unreachable. */
export async function listIssues(): Promise<Array<{ id: string; title: string; appId: string }>> {
	const base = baseUrl();
	if (!base) return [];
	try {
		const res = await fetch(`${base}/api/issues`, { headers: authHeaders() });
		if (!res.ok) return [];
		const body = (await res.json()) as { issues?: Array<{ id: string; title: string; appId: string }> };
		return body.issues ?? [];
	} catch {
		return [];
	}
}
