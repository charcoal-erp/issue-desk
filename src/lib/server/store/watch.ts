import path from 'node:path';
import { env } from '$env/dynamic/private';
import { checkpointDataDir, dataDir } from '../fs/paths';

let watching = false;

/**
 * Optional chokidar re-sync (§10, WATCH_FILES=true): if a JSON file is edited
 * out-of-band, reload the whole store so memory and disk stay consistent.
 * A full reload is cheap at this scale and simpler than per-file patching.
 */
export async function startWatcherIfEnabled(reload: () => Promise<void>): Promise<void> {
	if (watching || env.WATCH_FILES !== 'true') return;
	watching = true;
	const { watch } = await import('chokidar');
	let timer: ReturnType<typeof setTimeout> | undefined;
	watch(
		[
			path.join(dataDir(), 'config'),
			path.join(dataDir(), 'issues'),
			// Checkpoint data directories + the global runner catalogue — these
			// live under CHECKPOINT_DATA_DIR when it is set (same dir otherwise).
			path.join(checkpointDataDir(), 'tests'),
			path.join(checkpointDataDir(), 'suites'),
			path.join(checkpointDataDir(), 'runs'),
			path.join(checkpointDataDir(), 'runners.json')
		],
		{
			ignoreInitial: true,
			ignored: (p) => p.endsWith('.tmp')
		}
	).on('all', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			console.log('[issuedesk] Data files changed on disk — re-syncing store');
			reload().catch((e) => console.error('[issuedesk] Re-sync failed:', e));
		}, 250);
	});
}
