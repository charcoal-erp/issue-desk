import { X as attr_class, Y as clsx$1, a2 as ensure_array_like, $ as attr_style, y as derived } from './server.js-BMijsOvr.js';
import { b as PRIORITY_META } from './types.js-CwJArkfF.js';

//#region src/lib/components/PriorityMeter.svelte
function PriorityMeter($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { priority, variant = "meter" } = $$props;
		const meta = derived(() => PRIORITY_META[priority]);
		$$renderer.push(`<span${attr_class(clsx$1(variant), "svelte-1f6gk5d")}><!--[-->`);
		const each_array = ensure_array_like({ length: 5 });
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			each_array[i];
			$$renderer.push(`<i${attr_style(i < meta().pips ? `background:${meta().color}` : "")} class="svelte-1f6gk5d"></i>`);
		}
		$$renderer.push(`<!--]--></span>`);
	});
}

export { PriorityMeter as P };
//# sourceMappingURL=PriorityMeter.js-cpaZ7Gre.js.map
