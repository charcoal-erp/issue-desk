import { c as stringify, n as attr_style, w as escape_html } from "./server.js";
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
//#endregion
export { AppChip as t };
