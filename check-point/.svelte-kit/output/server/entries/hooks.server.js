import { t as private_env } from "../chunks/shared-server.js";
import { B as dataDir, C as reload, p as ensureLoaded } from "../chunks/checkpoint.js";
import path from "node:path";
//#region src/lib/server/store/watch.ts
var watching = false;
/**
* Optional chokidar re-sync (WATCH_FILES=true): if a content JSON file is
* edited out-of-band — say a `git pull` in the content repo this Checkpoint
* points at — reload the whole store so memory and disk stay consistent. A
* full reload is cheap at this scale and simpler than per-file patching.
*/
async function startWatcherIfEnabled(reload) {
	if (watching || private_env.WATCH_FILES !== "true") return;
	watching = true;
	const { watch } = await import("chokidar");
	let timer;
	watch([
		path.join(dataDir(), "config"),
		path.join(dataDir(), "tests"),
		path.join(dataDir(), "suites"),
		path.join(dataDir(), "runs"),
		path.join(dataDir(), "runners.json")
	], {
		ignoreInitial: true,
		ignored: (p) => p.endsWith(".tmp")
	}).on("all", () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			console.log("[checkpoint] Content changed on disk — re-syncing store");
			reload().catch((e) => console.error("[checkpoint] Re-sync failed:", e));
		}, 250);
	});
}
//#endregion
//#region src/hooks.server.ts
var init = async () => {
	await ensureLoaded();
	await startWatcherIfEnabled(async () => {
		await reload();
	});
};
//#endregion
export { init };
