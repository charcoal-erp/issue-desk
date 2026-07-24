import { b as private_env } from '../chunks/shared-server.js-9-2j12mp.js';
import { d as dataDir } from '../chunks/paths.js-Erst5pJ8.js';
import { e as ensureLoaded, s as sweepPending, r as reload } from '../chunks/store.js-B62sRqIC.js';
import { stat, mkdir, cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import '../chunks/types.js-CwJArkfF.js';
import 'uuid';
import 'zod';

//#region src/lib/server/store/backup.ts
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
var KEEP = Number(private_env.DATA_SNAPSHOT_KEEP) || 10;
var ISSUE_TARGETS = ["config", "issues"];
async function snapshotOnBoot() {
	if (private_env.DATA_SNAPSHOTS === "false") return;
	const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	const base = dataDir();
	let hasData = false;
	for (const t of ISSUE_TARGETS) try {
		await stat(path.join(base, t));
		hasData = true;
		break;
	} catch {}
	if (!hasData) return;
	const backupsRoot = path.join(base, ".backups");
	const dest = path.join(backupsRoot, stamp);
	try {
		await mkdir(dest, { recursive: true });
		for (const t of ISSUE_TARGETS) try {
			await cp(path.join(base, t), path.join(dest, t), { recursive: true });
		} catch {}
		await rotate(backupsRoot);
		console.log(`[issuedesk] Data snapshot written to .backups/${stamp} (keeping ${KEEP})`);
	} catch (e) {
		console.error("[issuedesk] Data snapshot failed (non-fatal):", e.message);
	}
}
async function rotate(backupsRoot) {
	let entries = [];
	try {
		entries = (await readdir(backupsRoot, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
	} catch {
		return;
	}
	for (const old of entries.slice(0, Math.max(0, entries.length - KEEP))) await rm(path.join(backupsRoot, old), {
		recursive: true,
		force: true
	});
}
//#endregion
//#region src/lib/server/store/watch.ts
var watching = false;
/**
* Optional chokidar re-sync (§10, WATCH_FILES=true): if a JSON file is edited
* out-of-band, reload the whole store so memory and disk stay consistent.
* A full reload is cheap at this scale and simpler than per-file patching.
*/
async function startWatcherIfEnabled(reload) {
	if (watching || private_env.WATCH_FILES !== "true") return;
	watching = true;
	const { watch } = await import('chokidar');
	let timer;
	watch([path.join(dataDir(), "config"), path.join(dataDir(), "issues")], {
		ignoreInitial: true,
		ignored: (p) => p.endsWith(".tmp")
	}).on("all", () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			console.log("[issuedesk] Data files changed on disk — re-syncing store");
			reload().catch((e) => console.error("[issuedesk] Re-sync failed:", e));
		}, 250);
	});
}
//#endregion
//#region src/hooks.server.ts
var init = async () => {
	await ensureLoaded();
	await snapshotOnBoot();
	await sweepPending();
	await startWatcherIfEnabled(async () => {
		await reload();
	});
};

export { init };
//# sourceMappingURL=hooks.server.js-B7RDs2YG.js.map
