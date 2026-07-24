import "./server.js";
//#region src/lib/stores/checkpoint-ui.svelte.ts
var cpUi = {
	launch: null,
	failures: null
};
function openLaunch(suiteId = null) {
	cpUi.launch = { suiteId };
}
//#endregion
export { openLaunch as n, cpUi as t };
