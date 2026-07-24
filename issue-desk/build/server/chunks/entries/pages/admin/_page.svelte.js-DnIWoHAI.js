import { X as attr_class, a2 as ensure_array_like, a1 as escape_html } from '../../../chunks/server.js-BMijsOvr.js';
import { I as Icon } from '../../../chunks/Avatar.js-PAM5HSzZ.js';
import '../../../chunks/client.js-Bshttxu0.js';
import { A as AppChip } from '../../../chunks/AppChip.js-Dl3f4hni.js';
import '../../../chunks/format.js-DMHwXcId.js';
import '../../../chunks/internal.js-gk8fQVhU.js';
import '../../../chunks/shared.js-By7i_rqW.js';
import '../../../chunks/exports.js-Bq66Su2C.js';
import '../../../chunks/utils.js-C3Eckavg.js';

//#region src/routes/admin/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		$$renderer.push(`<section class="screen screen-admin"><div class="admin"><h1>Configuration</h1> <p class="sub">Reference data that powers the dropdowns. No database — these edit your JSON config files.</p> <div class="admin-note">`);
		Icon($$renderer, { name: "warning" });
		$$renderer.push(`<!----> <span>Saving here writes to <b>data/config/*.json</b>. Files stay human-readable and
				git-committable — you can also edit them by hand and the app re-syncs.</span></div> <div class="admin-tabs"><button${attr_class("admin-tab", void 0, { "on": true })}>Applications</button> <button${attr_class("admin-tab", void 0, { "on": false })}>Users</button> <button${attr_class("admin-tab", void 0, { "on": false })}>Data</button></div> `);
		{
			$$renderer.push("<!--[1-->");
			$$renderer.push(`<div class="admin-panel on"><div class="admin-card-head"><h3>Applications, modules, pages &amp; forms</h3> <button class="btn btn-primary btn-sm">`);
			Icon($$renderer, { name: "plus" });
			$$renderer.push(`<!---->Add application</button></div> <div class="data-card"><table><thead><tr><th>Application</th><th>Code</th><th>Modules</th><th>Open</th><th>Total</th></tr></thead><tbody><!--[-->`);
			const each_array = ensure_array_like(data.applications);
			for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
				let app = each_array[$$index_1];
				$$renderer.push(`<tr class="rowbtn svelte-1jef3w8"><td>`);
				AppChip($$renderer, {
					name: app.name,
					color: app.color,
					bold: true
				});
				$$renderer.push(`<!----></td><td><span class="code-badge">${escape_html(app.code)}</span></td><td><div class="mod-tags"><!--[-->`);
				const each_array_1 = ensure_array_like(app.modules);
				for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
					let m = each_array_1[$$index];
					$$renderer.push(`<span class="mod-tag">${escape_html(m.name)}</span>`);
				}
				$$renderer.push(`<!--]--></div></td><td>${escape_html(data.perApp[app.id]?.open ?? 0)}</td><td>${escape_html(data.perApp[app.id]?.total ?? 0)}</td></tr>`);
			}
			$$renderer.push(`<!--]--></tbody></table></div></div>`);
		}
		$$renderer.push(`<!--]--></div></section> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-DnIWoHAI.js.map
