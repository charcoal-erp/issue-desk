import type { ServerInit } from '@sveltejs/kit';
import * as checkpoint from '$lib/server/store/checkpoint';
import { startWatcherIfEnabled } from '$lib/server/store/watch';

export const init: ServerInit = async () => {
	await checkpoint.ensureLoaded();
	await startWatcherIfEnabled(async () => {
		await checkpoint.reload();
	});
};
