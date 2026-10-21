import path from 'node:path';
import { env } from '$env/dynamic/private';
import { dataDir } from '../fs/paths';
import { isOwnWrite } from '../fs/write';

let watching = false;

/**
 * Optional chokidar re-sync (§10, WATCH_FILES=true): if a JSON file is edited
 * out-of-band, reload the whole store so memory and disk stay consistent.
 * A full reload is cheap at this scale and simpler than per-file patching.
 *
 * Changes that are just this process's own writes are skipped: reloading on
 * every create turned a burst of agent filings into a storm of reloads.
 */
export async function startWatcherIfEnabled(reload: () => Promise<void>): Promise<void> {
	if (watching || env.WATCH_FILES !== 'true') return;
	watching = true;
	const { watch } = await import('chokidar');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const changed = new Set<string>();
	watch(
		[path.join(dataDir(), 'config'), path.join(dataDir(), 'issues')],
		{
			ignoreInitial: true,
			ignored: (p) => p.endsWith('.tmp')
		}
	).on('all', (_event, file) => {
		changed.add(file);
		clearTimeout(timer);
		timer = setTimeout(async () => {
			const files = [...changed];
			changed.clear();
			const own = await Promise.all(files.map(isOwnWrite));
			if (own.every(Boolean)) return;
			console.log('[issuedesk] Data files changed on disk — re-syncing store');
			reload().catch((e) => console.error('[issuedesk] Re-sync failed:', e));
		}, 250);
	});
}
