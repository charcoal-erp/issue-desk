import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import { dataDir } from '../fs/paths';
import { withAllWriteLocks } from './index';

/**
 * Data snapshots. This is a file-backed store: the JSON under `data/` IS the
 * database, not disposable demo data. On every boot, and then every hour, we
 * copy the small, irreplaceable structured data (config + all issue JSON) into
 * a restore point under `data/.backups/<timestamp>/`, so an accidental
 * deletion or bad edit is never more than an hour of work away from recovery.
 * The hourly run is skipped when nothing changed since the latest snapshot.
 *
 * Retention keeps the newest DATA_SNAPSHOT_KEEP snapshots plus the last one of
 * each of the newest DATA_SNAPSHOT_DAYS days, so a loss noticed days later is
 * still recoverable. Only timestamp-named folders rotate; `pre-import-*`
 * folders are left alone.
 *
 * Uploads (large, content-addressed, rarely the loss vector) are excluded —
 * use `npm run backup:data` for a full archive including them. Disable with
 * DATA_SNAPSHOTS=false. `.backups` is outside every reader and the file
 * watcher, so it never feeds back into the store.
 */
const KEEP = Number(env.DATA_SNAPSHOT_KEEP) || 48;
const KEEP_DAYS = Number(env.DATA_SNAPSHOT_DAYS) || 14;
const INTERVAL_MINUTES = Number(env.DATA_SNAPSHOT_INTERVAL_MINUTES ?? 60);
const ISSUE_TARGETS = ['config', 'issues'];
const STAMPED = /^\d{4}-\d{2}-\d{2}T[\d-]+Z$/;

let timer: ReturnType<typeof setInterval> | undefined;

export async function snapshotOnBoot(): Promise<void> {
	await snapshot('boot');
}

/** Hourly snapshots for as long as the server runs (DATA_SNAPSHOT_INTERVAL_MINUTES=0 disables). */
export function startSnapshotSchedule(): void {
	if (timer || env.DATA_SNAPSHOTS === 'false' || !(INTERVAL_MINUTES > 0)) return;
	timer = setInterval(() => void snapshot('scheduled', { skipUnchanged: true }), INTERVAL_MINUTES * 60_000);
	timer.unref();
}

/**
 * Write one snapshot and rotate. Store writes are paused for the copy so it
 * never catches a module mid-update. Returns the folder name, or undefined
 * when skipped. Never throws — a failed snapshot must not take the server down.
 */
export async function snapshot(
	reason: string,
	{ skipUnchanged = false }: { skipUnchanged?: boolean } = {}
): Promise<string | undefined> {
	if (env.DATA_SNAPSHOTS === 'false') return;
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
	try {
		return await withAllWriteLocks(async () => {
			if (skipUnchanged) {
				const latest = (await stampedDirs(backupsRoot)).at(-1);
				if (latest && (await digest(base)) === (await digest(path.join(backupsRoot, latest)))) {
					return undefined;
				}
			}
			const stamp = new Date().toISOString().replace(/[:.]/g, '-');
			const dest = path.join(backupsRoot, stamp);
			await mkdir(dest, { recursive: true });
			for (const t of ISSUE_TARGETS) {
				try {
					await cp(path.join(base, t), path.join(dest, t), {
						recursive: true,
						filter: (src) => !src.endsWith('.tmp')
					});
				} catch {
					/* target absent — skip */
				}
			}
			await rotate(backupsRoot);
			console.log(`[issuedesk] Data snapshot (${reason}) written to .backups/${stamp}`);
			return stamp;
		});
	} catch (e) {
		console.error('[issuedesk] Data snapshot failed (non-fatal):', (e as Error).message);
		return undefined;
	}
}

/** Delete timestamped snapshots outside both the newest-N and the per-day windows. */
export async function rotate(backupsRoot: string, keep = KEEP, keepDays = KEEP_DAYS): Promise<void> {
	const dirs = await stampedDirs(backupsRoot);
	const kept = new Set(dirs.slice(-keep));
	const lastOfDay = new Map<string, string>();
	for (const d of dirs) lastOfDay.set(d.slice(0, 10), d); // ISO stamps sort chronologically
	for (const day of [...lastOfDay.keys()].slice(-keepDays)) kept.add(lastOfDay.get(day)!);
	for (const d of dirs) {
		if (!kept.has(d)) await rm(path.join(backupsRoot, d), { recursive: true, force: true });
	}
}

async function stampedDirs(backupsRoot: string): Promise<string[]> {
	try {
		return (await readdir(backupsRoot, { withFileTypes: true }))
			.filter((d) => d.isDirectory() && STAMPED.test(d.name))
			.map((d) => d.name)
			.sort();
	} catch {
		return [];
	}
}

/** Content hash of the snapshot targets under `root`, for the unchanged check. */
async function digest(root: string): Promise<string> {
	const hash = createHash('sha256');
	for (const t of ISSUE_TARGETS) {
		for (const rel of await listFiles(path.join(root, t))) {
			hash.update(`${t}/${rel}\0`);
			hash.update(await readFile(path.join(root, t, rel)));
		}
	}
	return hash.digest('hex');
}

async function listFiles(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir, { recursive: true, withFileTypes: true });
		return entries
			.filter((e) => e.isFile() && !e.name.endsWith('.tmp'))
			.map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
			.sort();
	} catch {
		return [];
	}
}
