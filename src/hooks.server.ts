import type { ServerInit } from '@sveltejs/kit';
import { ensureLoaded, reload, sweepPending } from '$lib/server/store';
import { snapshotOnBoot } from '$lib/server/store/backup';
import { startWatcherIfEnabled } from '$lib/server/store/watch';

export const init: ServerInit = async () => {
	await ensureLoaded();
	await snapshotOnBoot(); // rotating restore point of the file-backed data
	await sweepPending();
	await startWatcherIfEnabled(async () => {
		await reload();
	});
};
