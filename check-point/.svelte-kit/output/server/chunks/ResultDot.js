import { c as stringify, r as derived, t as attr_class } from "./server.js";
import { i as RESULT_META } from "./meta.js";
//#region src/lib/components/checkpoint/ResultDot.svelte
function ResultDot($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { status } = $$props;
		const cls = derived(() => status === "none" ? "rd-none" : RESULT_META[status].cls);
		$$renderer.push(`<span${attr_class(`res-dot ${stringify(cls())}`)}></span>`);
	});
}
//#endregion
export { ResultDot as t };
