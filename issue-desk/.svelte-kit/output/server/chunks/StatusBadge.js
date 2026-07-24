import { c as stringify, i as derived, n as attr_style, t as attr_class, w as escape_html } from "./server.js";
import { i as STATUS_META } from "./types.js";
//#region src/lib/components/StatusBadge.svelte
function StatusBadge($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { status } = $$props;
		const meta = derived(() => STATUS_META[status]);
		$$renderer.push(`<span${attr_class(`status-badge ${stringify(meta().badgeClass)}`)}><span class="status-dot"${attr_style(`background:${stringify(meta().color)}`)}></span>${escape_html(meta().label)}</span>`);
	});
}
//#endregion
export { StatusBadge as t };
