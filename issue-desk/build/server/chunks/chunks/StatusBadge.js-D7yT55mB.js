import { X as attr_class, a0 as stringify, $ as attr_style, a1 as escape_html, y as derived } from './server.js-BMijsOvr.js';
import { a as STATUS_META } from './types.js-CwJArkfF.js';

//#region src/lib/components/StatusBadge.svelte
function StatusBadge($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { status } = $$props;
		const meta = derived(() => STATUS_META[status]);
		$$renderer.push(`<span${attr_class(`status-badge ${stringify(meta().badgeClass)}`)}><span class="status-dot"${attr_style(`background:${stringify(meta().color)}`)}></span>${escape_html(meta().label)}</span>`);
	});
}

export { StatusBadge as S };
//# sourceMappingURL=StatusBadge.js-D7yT55mB.js.map
