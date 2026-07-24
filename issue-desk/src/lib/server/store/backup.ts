import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import { dataDir } from '../fs/paths';

/**
 * Boot-time data snapshots. This is a file-backed store: the JSON under `data/`
 * IS the database, not disposable demo data. On every boot we copy the small,
 * irreplaceable structured data (config + all issue JSON) into a rotating set
 * of restore points under `data/.backups/<timestamp>/`, so an accidental
 * deletion or bad edit is always one restart away from recovery.
 *
 * Uploads (large, content-addressed, rarely the loss vector) are excluded from
 * the auto-snapshot — use `npm run backup:data` for a full archive including
 * them. Disable with DATA_SNAPSHOTS=false. `.backups` is outside every reader
 * and the file watcher, so it never feeds back into the store.
 */
const KEEP = Number(env.DATA_SNAPSHOT_KEEP) || 10;
const ISSUE_TARGETS = ['config', 'issues'];

export async function snapshotOnBoot(): Promise<void> {
	if (env.DATA_SNAPSHOTS === 'false') return;
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const base = dataDir();

	// Only snapshot if there is real data to protect.
	let hasData = false;
	for (const t of ISSUE_TARGETS) {
		try {
			await stat(path.join(base, t));
			hasData = true;
			break;
		} catch {
			/* missing — ignore */
		}
	}
	if (!hasData) return;

	const backupsRoot = path.join(base, '.backups');
	const dest = path.join(backupsRoot, stamp);
	try {
		await mkdir(dest, { recursive: true });
		for (const t of ISSUE_TARGETS) {
			try {
				await cp(path.join(base, t), path.join(dest, t), { recursive: true });
			} catch {
				/* target absent — skip */
			}
		}
		await rotate(backupsRoot);
		console.log(`[issuedesk] Data snapshot written to .backups/${stamp} (keeping ${KEEP})`);
	} catch (e) {
		console.error('[issuedesk] Data snapshot failed (non-fatal):', (e as Error).message);
	}
}

async function rotate(backupsRoot: string): Promise<void> {
	let entries: string[] = [];
	try {
		entries = (await readdir(backupsRoot, { withFileTypes: true }))
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.sort(); // ISO timestamps sort chronologically
	} catch {
		return;
	}
	for (const old of entries.slice(0, Math.max(0, entries.length - KEEP))) {
		await rm(path.join(backupsRoot, old), { recursive: true, force: true });
	}
}
