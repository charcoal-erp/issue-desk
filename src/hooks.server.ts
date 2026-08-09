import { json, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, failureMessage, resolveRequest } from '$lib/server/auth';
import { bootstrapAdmin } from '$lib/server/auth/credentials';
import { ensureLoaded, reload, sweepPending } from '$lib/server/store';
import { snapshotOnBoot } from '$lib/server/store/backup';
import { startWatcherIfEnabled } from '$lib/server/store/watch';

export const init: ServerInit = async () => {
	await ensureLoaded();
	await snapshotOnBoot(); // rotating restore point of the file-backed data
	await bootstrapAdmin(); // first run only: an admin nobody could otherwise create
	await sweepPending();
	await startWatcherIfEnabled(async () => {
		await reload();
	});
};

/**
 * Everything is behind authentication except the handful of paths below, which
 * exist precisely so an unauthenticated client can obtain credentials. The list
 * is exact-match — no prefix matching — so a new route is private by default
 * and becomes public only by being named here.
 */
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login']);

/**
 * The Checkpoint ingest path predates JWTs: when ISSUEDESK_INGEST_TOKEN is set,
 * a matching bearer token still authorises `POST /api/issues` on its own, so an
 * existing Checkpoint deployment keeps filing bugs across this upgrade. The
 * route re-checks the token itself; this only decides whether the request may
 * reach it. With the variable unset there is no exemption and a JWT is required.
 */
function isIngestRequest(pathname: string, request: Request): boolean {
	if (pathname !== '/api/issues' || request.method !== 'POST') return false;
	const required = env.ISSUEDESK_INGEST_TOKEN?.trim();
	if (!required) return false;
	const got = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
	return got === required;
}

export const handle: Handle = async ({ event, resolve }) => {
	await ensureLoaded();

	const { pathname } = event.url;
	const resolved = await resolveRequest(event.request, event.cookies.get(SESSION_COOKIE));
	event.locals.user = resolved.ok ? resolved.user : null;
	event.locals.ingest = false;

	// A stale or tampered cookie is cleared rather than left to fail on every
	// subsequent request — otherwise the login page itself keeps re-reading it.
	if (!resolved.ok && resolved.reason !== 'absent' && event.cookies.get(SESSION_COOKIE)) {
		event.cookies.delete(SESSION_COOKIE, { path: '/' });
	}

	if (event.locals.user || PUBLIC_PATHS.has(pathname)) return resolve(event);

	if (isIngestRequest(pathname, event.request)) {
		event.locals.ingest = true;
		return resolve(event);
	}

	// APIs get a 401 they can act on; browsers get sent to the login form with
	// their destination preserved. `isDataRequest` covers SvelteKit's own
	// client-side load fetches, which are navigations wearing a fetch costume.
	if (pathname.startsWith('/api/')) {
		return json(
			{ message: failureMessage(resolved.ok ? 'absent' : resolved.reason) },
			{ status: 401, headers: { 'www-authenticate': 'Bearer realm="issuedesk"' } }
		);
	}

	const target = event.url.pathname + event.url.search;
	redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
};
