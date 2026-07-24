import "../../../../chunks/server.js";
import "../../../../chunks/ui.svelte.js";
//#region src/routes/issues/[id]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		$$renderer.push(`<section class="screen"></section>`);
	});
}
//#endregion
export { _page as default };
