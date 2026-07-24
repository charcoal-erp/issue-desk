import { $ as attr_style, a1 as escape_html, a0 as stringify } from './server.js-BMijsOvr.js';

//#region src/lib/components/AppChip.svelte
function AppChip($$renderer, $$props) {
	let { name, color, bold = false } = $$props;
	$$renderer.push(`<span class="app-chip"><span class="app-dot"${attr_style(`background:${stringify(color ?? "var(--muted)")}`)}></span> `);
	if (bold) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<b>${escape_html(name)}</b>`);
	} else {
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`${escape_html(name)}`);
	}
	$$renderer.push(`<!--]--></span>`);
}

export { AppChip as A };
//# sourceMappingURL=AppChip.js-Dl3f4hni.js.map
