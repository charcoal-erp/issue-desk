import { X as attr_class, $ as stringify, y as derived } from './server.js-CDtqtqwP.js';
import { a as RESULT_META } from './meta.js-Drcdnnre.js';

//#region src/lib/components/checkpoint/ResultDot.svelte
function ResultDot($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { status } = $$props;
		const cls = derived(() => status === "none" ? "rd-none" : RESULT_META[status].cls);
		$$renderer.push(`<span${attr_class(`res-dot ${stringify(cls())}`)}></span>`);
	});
}

export { ResultDot as R };
//# sourceMappingURL=ResultDot.js-D80U_RhS.js.map
