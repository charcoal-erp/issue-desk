import { C as clsx, a as ensure_array_like, i as derived, n as attr_style, t as attr_class } from "./server.js";
import { o as PRIORITY_META } from "./types.js";
//#region src/lib/components/PriorityMeter.svelte
function PriorityMeter($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { priority, variant = "meter" } = $$props;
		const meta = derived(() => PRIORITY_META[priority]);
		$$renderer.push(`<span${attr_class(clsx(variant), "svelte-1f6gk5d")}><!--[-->`);
		const each_array = ensure_array_like({ length: 5 });
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			each_array[i];
			$$renderer.push(`<i${attr_style(i < meta().pips ? `background:${meta().color}` : "")} class="svelte-1f6gk5d"></i>`);
		}
		$$renderer.push(`<!--]--></span>`);
	});
}
//#endregion
export { PriorityMeter as t };
