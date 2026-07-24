import { a2 as head, Z as attr, a0 as escape_html, a1 as ensure_array_like, X as attr_class, y as derived } from '../../chunks/server.js-CDtqtqwP.js';
import { p as page } from '../../chunks/state.js-BlYCQXBb.js';
import { t as toasts } from '../../chunks/toasts.svelte.js-CODzRUBG.js';
import { I as Icon } from '../../chunks/KindBadge.js-DqDHG5dw.js';
import '../../chunks/internal.js-CuIsDgeO.js';
import '../../chunks/client.js-DlRkZ906.js';
import '../../chunks/shared.js-C8TgK89F.js';
import '../../chunks/exports.js-Bq66Su2C.js';
import '../../chunks/utils.js-r4C_CEqs.js';
import '../../chunks/meta.js-Drcdnnre.js';

//#region src/lib/assets/favicon.svg
var favicon_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3e%3cdefs%3e%3clinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='1'%3e%3cstop%20offset='0'%20stop-color='%235B4BFF'%20/%3e%3cstop%20offset='1'%20stop-color='%238A7BFF'%20/%3e%3c/linearGradient%3e%3c/defs%3e%3crect%20width='32'%20height='32'%20rx='9'%20fill='url(%23g)'%20/%3e%3cg%20transform='translate(4%204)'%20fill='none'%20stroke='%23fff'%20stroke-width='2.4'%20stroke-linecap='round'%20stroke-linejoin='round'%3e%3cpath%20d='M12%202l3%203h4v4l3%203-3%203v4h-4l-3%203-3-3H5v-4l-3-3%203-3V5h4z'%20/%3e%3ccircle%20cx='12'%20cy='11'%20r='2.5'%20fill='%23fff'%20stroke='none'%20/%3e%3c/g%3e%3c/svg%3e";
//#endregion
//#region src/lib/components/ToastHost.svelte
function ToastHost($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<div class="toast-host"><!--[-->`);
		const each_array = ensure_array_like(toasts());
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let item = each_array[$$index];
			$$renderer.push(`<div${attr_class("toast", void 0, { "out": item.out })}>`);
			Icon($$renderer, { name: "toast-check" });
			$$renderer.push(`<!----> <div class="tbody"><div>${escape_html(item.title)}</div> `);
			if (item.sub) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="tsub">${escape_html(item.sub)}</div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <button type="button" class="tx" aria-label="Dismiss notification">`);
			Icon($$renderer, { name: "x-sm" });
			$$renderer.push(`<!----></button></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/checkpoint/LaunchModal.svelte
function LaunchModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/checkpoint/FailuresModal.svelte
function FailuresModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data, children } = $$props;
		const NAV = [
			{
				href: "/",
				label: "Dashboard",
				icon: "dashboard"
			},
			{
				href: "/cases",
				label: "Cases",
				icon: "task"
			},
			{
				href: "/suites",
				label: "Suites",
				icon: "layers"
			},
			{
				href: "/runs",
				label: "Runs",
				icon: "play"
			},
			{
				href: "/runners",
				label: "Runners",
				icon: "terminal"
			}
		];
		function isActive(href) {
			return href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href);
		}
		/**
		* The box keeps whatever was searched for while you are on the results page,
		* so refining a query means editing it rather than retyping it; anywhere else
		* it starts empty.
		*/
		let q = page.url.pathname === "/search" ? page.url.searchParams.get("q") ?? "" : "";
		const currentUser = derived(() => data.users.find((u) => u.id === data.currentUserId) ?? data.users[0]);
		const initials = derived(() => (currentUser()?.name ?? "QA").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase());
		const firstName = derived(() => (currentUser()?.name ?? "QA").split(/\s+/)[0]);
		head("12qhfyh", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>Checkpoint — test management</title>`);
			});
			$$renderer.push(`<link rel="icon"${attr("href", favicon_default)}/>`);
		});
		$$renderer.push(`<div class="cp"><header class="topbar"><a class="bm" href="/" aria-label="Checkpoint home">`);
		Icon($$renderer, { name: "task" });
		$$renderer.push(`<!----></a> <span class="brand-name">Checkpoint</span> <div class="topbar-spacer"></div> <form class="topsearch">`);
		Icon($$renderer, { name: "search" });
		$$renderer.push(`<!----> <input name="q"${attr("value", q)} placeholder="Search cases, suites, runs…" aria-label="Search Checkpoint"/></form> <button class="icon-btn" title="Export failures for Claude Code" aria-label="Export failures">`);
		Icon($$renderer, { name: "code" });
		$$renderer.push(`<!----></button> <span class="user-btn"><span class="ua">${escape_html(initials())}</span> <span class="un">${escape_html(firstName())}</span></span></header> <div class="body"><nav class="nav"><!--[-->`);
		const each_array = ensure_array_like(NAV);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let item = each_array[$$index];
			$$renderer.push(`<a${attr_class("nav-item", void 0, { "active": isActive(item.href) })}${attr("href", item.href)}>`);
			Icon($$renderer, { name: item.icon });
			$$renderer.push(`<!----> <span>${escape_html(item.label)}</span></a>`);
		}
		$$renderer.push(`<!--]--></nav> <div class="workspace">`);
		children($$renderer);
		$$renderer.push(`<!----></div></div> `);
		LaunchModal($$renderer, { suites: data.launchSuites });
		$$renderer.push(`<!----> `);
		FailuresModal($$renderer);
		$$renderer.push(`<!----></div> `);
		ToastHost($$renderer);
		$$renderer.push(`<!---->`);
	});
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte.js-D-1PN14N.js.map
