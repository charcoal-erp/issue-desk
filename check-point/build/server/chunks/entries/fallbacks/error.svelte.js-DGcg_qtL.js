import { a0 as escape_html } from '../../chunks/server.js-CDtqtqwP.js';
import { p as page } from '../../chunks/state.js-BlYCQXBb.js';
import '../../chunks/internal.js-CuIsDgeO.js';
import '../../chunks/client.js-DlRkZ906.js';
import '../../chunks/shared.js-C8TgK89F.js';
import '../../chunks/exports.js-Bq66Su2C.js';
import '../../chunks/utils.js-r4C_CEqs.js';

//#region node_modules/@sveltejs/kit/src/runtime/components/svelte-5/error.svelte
function Error($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<h1>${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message)}</p>`);
	});
}

export { Error as default };
//# sourceMappingURL=error.svelte.js-DGcg_qtL.js.map
