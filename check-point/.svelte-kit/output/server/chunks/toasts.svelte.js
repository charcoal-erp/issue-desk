import "./server.js";
import "./client.js";
//#region src/lib/stores/toasts.svelte.ts
var items = [];
function toasts() {
	return items;
}
//#endregion
export { toasts as t };
