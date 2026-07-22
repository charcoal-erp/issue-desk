import type { ServerInit } from '@sveltejs/kit';
import { ensureLoaded, reload, sweepPending } from '$lib/server/store';
import * as checkpoint from '$lib/server/store/checkpoint';
import { startWatcherIfEnabled } from '$lib/server/store/watch';

export const init: ServerInit = async () => {
	await ensureLoaded();
	await checkpoint.ensureLoaded();
	await sweepPending();
	await startWatcherIfEnabled(async () => {
		await reload();
		await checkpoint.reload();
	});
};
