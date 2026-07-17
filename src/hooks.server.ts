import type { ServerInit } from '@sveltejs/kit';
import { ensureLoaded, reload, sweepPending } from '$lib/server/store';
import { startWatcherIfEnabled } from '$lib/server/store/watch';

export const init: ServerInit = async () => {
	await ensureLoaded();
	await sweepPending();
	await startWatcherIfEnabled(reload);
};
