import { a1 as escape_html } from '../../chunks/server.js-BMijsOvr.js';
import { p as page } from '../../chunks/state.js-CblDxhZw.js';
import '../../chunks/internal.js-gk8fQVhU.js';
import '../../chunks/client.js-Bshttxu0.js';
import '../../chunks/shared.js-By7i_rqW.js';
import '../../chunks/exports.js-Bq66Su2C.js';
import '../../chunks/utils.js-C3Eckavg.js';

//#region node_modules/@sveltejs/kit/src/runtime/components/svelte-5/error.svelte
function Error($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<h1>${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message)}</p>`);
	});
}

export { Error as default };
//# sourceMappingURL=error.svelte.js-6pA7p3lX.js.map
