import { a3 as head, a2 as ensure_array_like, X as attr_class, Z as attr, a1 as escape_html, a4 as bind_props, y as derived } from '../../chunks/server.js-BMijsOvr.js';
import { p as page } from '../../chunks/state.js-CblDxhZw.js';
import { I as Icon, t as toasts, A as Avatar } from '../../chunks/Avatar.js-PAM5HSzZ.js';
import '../../chunks/client.js-Bshttxu0.js';
import 'marked';
import 'dompurify';
import '../../chunks/internal.js-gk8fQVhU.js';
import '../../chunks/format.js-DMHwXcId.js';
import '../../chunks/shared.js-By7i_rqW.js';
import '../../chunks/exports.js-Bq66Su2C.js';
import '../../chunks/utils.js-C3Eckavg.js';

//#region src/lib/assets/favicon.svg
var favicon_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3e%3cdefs%3e%3clinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='1'%3e%3cstop%20offset='0'%20stop-color='%235B4BFF'%20/%3e%3cstop%20offset='1'%20stop-color='%238A7BFF'%20/%3e%3c/linearGradient%3e%3c/defs%3e%3crect%20width='32'%20height='32'%20rx='9'%20fill='url(%23g)'%20/%3e%3cg%20transform='translate(4%204)'%20fill='none'%20stroke='%23fff'%20stroke-width='2.4'%20stroke-linecap='round'%20stroke-linejoin='round'%3e%3cpath%20d='M12%202l3%203h4v4l3%203-3%203v4h-4l-3%203-3-3H5v-4l-3-3%203-3V5h4z'%20/%3e%3ccircle%20cx='12'%20cy='11'%20r='2.5'%20fill='%23fff'%20stroke='none'%20/%3e%3c/g%3e%3c/svg%3e";
//#endregion
//#region src/lib/components/UserSwitcher.svelte
function UserSwitcher($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { users, currentUserId } = $$props;
		let open = false;
		const current = derived(() => users.find((u) => u.id === currentUserId) ?? users[0]);
		$$renderer.push(`<div class="usw"><button class="usw-btn svelte-w1icr4" aria-haspopup="listbox"${attr("aria-expanded", open)}>`);
		Avatar($$renderer, {
			user: current(),
			size: 30
		});
		$$renderer.push(`<!----> <span class="who svelte-w1icr4"><span class="n">${escape_html(current()?.name)}</span><span class="r">${escape_html(current()?.role)}</span></span> `);
		Icon($$renderer, {
			name: "chevron",
			class: "chev"
		});
		$$renderer.push(`<!----></button> <div${attr_class("usw-menu", void 0, { "open": open })}><div class="lbl">Filing issues as</div> <!--[-->`);
		const each_array = ensure_array_like(users);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let user = each_array[$$index];
			$$renderer.push(`<button${attr_class("usw-item svelte-w1icr4", void 0, { "active": user.id === currentUserId })}>`);
			Avatar($$renderer, {
				user,
				size: 30
			});
			$$renderer.push(`<!----> <span class="who svelte-w1icr4"><span class="n">${escape_html(user.name)}</span><span class="r">${escape_html(user.role)}</span></span> `);
			Icon($$renderer, {
				name: "check",
				class: "tick"
			});
			$$renderer.push(`<!----></button>`);
		}
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/TopBar.svelte
function TopBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { users, currentUserId } = $$props;
		let value = page.url.searchParams.get("q") ?? "";
		function focusSearch() {}
		$$renderer.push(`<header class="topbar"><a class="brand svelte-yic9pk" href="/" aria-label="IssueDesk home"><div class="mark svelte-yic9pk">`);
		Icon($$renderer, { name: "logo" });
		$$renderer.push(`<!----></div></a> <div class="topbar-spacer"></div> <div class="topsearch">`);
		Icon($$renderer, { name: "search" });
		$$renderer.push(`<!----> <input${attr("value", value)} placeholder="Search issues, IDs, modules…"/> <kbd>/</kbd></div> `);
		UserSwitcher($$renderer, {
			users,
			currentUserId
		});
		$$renderer.push(`<!----></header>`);
		bind_props($$props, { focusSearch });
	});
}
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
//#region src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data, children } = $$props;
		const NAV = [
			{
				href: "/",
				label: "Issues",
				icon: "rows"
			},
			{
				href: "/board",
				label: "Board",
				icon: "board"
			},
			{
				href: "/metrics",
				label: "Metrics",
				icon: "dashboard"
			}
		];
		function isActive(href) {
			return href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href);
		}
		head("12qhfyh", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>IssueDesk — bug &amp; feature tracker</title>`);
			});
			$$renderer.push(`<link rel="icon"${attr("href", favicon_default)}/>`);
		});
		$$renderer.push(`<div class="app">`);
		TopBar($$renderer, {
			users: data.users,
			currentUserId: data.currentUserId
		});
		$$renderer.push(`<!----> <div class="body"><nav class="nav"><!--[-->`);
		const each_array = ensure_array_like(NAV);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let item = each_array[$$index];
			$$renderer.push(`<a${attr_class("nav-item", void 0, { "active": isActive(item.href) })}${attr("href", item.href)}>`);
			Icon($$renderer, { name: item.icon });
			$$renderer.push(`<!----> <span>${escape_html(item.label)}</span></a>`);
		}
		$$renderer.push(`<!--]--> <div class="nav-sep"></div> <a${attr_class("nav-item", void 0, { "active": isActive("/admin") })} href="/admin">`);
		Icon($$renderer, { name: "gear" });
		$$renderer.push(`<!----> <span>Config</span></a></nav> <div class="workspace">`);
		children($$renderer);
		$$renderer.push(`<!----></div></div></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		ToastHost($$renderer);
		$$renderer.push(`<!---->`);
	});
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte.js-C7I3SeVO.js.map
