import path from 'node:path';
import { env } from '$env/dynamic/private';
import { dataDir } from '../fs/paths';

let watching = false;

/**
 * Optional chokidar re-sync (WATCH_FILES=true): if a content JSON file is
 * edited out-of-band — say a `git pull` in the content repo this Checkpoint
 * points at — reload the whole store so memory and disk stay consistent. A
 * full reload is cheap at this scale and simpler than per-file patching.
 */
export async function startWatcherIfEnabled(reload: () => Promise<void>): Promise<void> {
	if (watching || env.WATCH_FILES !== 'true') return;
	watching = true;
	const { watch } = await import('chokidar');
	let timer: ReturnType<typeof setTimeout> | undefined;
	watch(
		[
			path.join(dataDir(), 'config'),
			path.join(dataDir(), 'tests'),
			path.join(dataDir(), 'suites'),
			path.join(dataDir(), 'runs'),
			path.join(dataDir(), 'runners.json')
		],
		{
			ignoreInitial: true,
			ignored: (p) => p.endsWith('.tmp')
		}
	).on('all', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			console.log('[checkpoint] Content changed on disk — re-syncing store');
			reload().catch((e) => console.error('[checkpoint] Re-sync failed:', e));
		}, 250);
	});
}
