import { C as attr, T as escape_html, a as head, i as ensure_array_like, n as attr_style, r as derived, t as attr_class } from "../../chunks/server.js";
import { a as SUITE_ENVIRONMENTS } from "../../chunks/types.js";
import { n as ENV_LABEL } from "../../chunks/meta.js";
import { t as page } from "../../chunks/state.js";
import { t as toasts } from "../../chunks/toasts.svelte.js";
import { n as Icon, t as KindBadge } from "../../chunks/KindBadge.js";
import { t as cpUi } from "../../chunks/checkpoint-ui.svelte.js";
import { t as SuiteTags } from "../../chunks/SuiteTags.js";
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
		/** One entry per runner this suite will invoke — resolved server-side. */
		let { suites } = $$props;
		let suiteId = "";
		let environment = "local";
		let selectedKinds = [];
		const suite = derived(() => suites.find((s) => s.id === suiteId));
		/** The runners that will actually be invoked, filtered by the ticked kinds. */
		const activeGroups = derived(() => (suite()?.groups ?? []).filter((g) => selectedKinds.includes(g.kind)));
		const plan = derived(() => {
			if (!suite()) return [];
			const lines = [];
			for (const g of activeGroups()) {
				const cd = g.workingDir && g.workingDir !== "." ? `cd ${g.workingDir} && ` : "";
				lines.push(`$ ${cd}${g.command.replace(/\$ENV\b/g, environment)}`);
				lines.push(`  → parse ${g.reportPath || "stdout"} (${g.reportFormat}) → ${g.count} case(s)`);
			}
			for (const u of suite().unrunnable) if (selectedKinds.includes(u.kind)) lines.push(`# ${u.kind}: no runner configured → ${u.count} case(s) skipped`);
			if (suite().manualCount && selectedKinds.includes("manual")) lines.push(`# ${suite().manualCount} manual case(s) → checklist for the tester`);
			if (activeGroups().length > 1) lines.push(`# ${activeGroups().length} runners execute in order, one at a time`);
			return lines;
		});
		if (cpUi.launch) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="cp-backdrop" role="presentation"><div class="cp-modal wide" role="dialog" aria-modal="true"><div class="modal-head"><div class="mh-icon">`);
			Icon($$renderer, { name: "play" });
			$$renderer.push(`<!----></div> <div><h2>Launch a run</h2> <div class="mh-sub">Pick a suite, an environment, and which runners take part</div></div> <button class="x" aria-label="Close">`);
			Icon($$renderer, { name: "x" });
			$$renderer.push(`<!----></button></div> <div class="modal-body">`);
			if (!suites.length) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<p style="color:var(--muted)">No suites yet — create a suite first, then launch it.</p>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="grid2"><div class="field"><label for="lm-suite">Suite</label> `);
				$$renderer.select({
					id: "lm-suite",
					class: "sel",
					value: suiteId
				}, ($$renderer) => {
					$$renderer.push(`<!--[-->`);
					const each_array = ensure_array_like(suites);
					for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
						let s = each_array[$$index];
						$$renderer.option({ value: s.id }, ($$renderer) => {
							$$renderer.push(`${escape_html(s.appName)} · ${escape_html(s.name)} — ${escape_html(s.caseCount)} cases`);
						});
					}
					$$renderer.push(`<!--]-->`);
				});
				$$renderer.push(`</div> <div class="field"><label for="lm-env">Environment</label> `);
				$$renderer.select({
					id: "lm-env",
					class: "sel",
					value: environment
				}, ($$renderer) => {
					$$renderer.push(`<!--[-->`);
					const each_array_1 = ensure_array_like(SUITE_ENVIRONMENTS);
					for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
						let e = each_array_1[$$index_1];
						$$renderer.option({ value: e }, ($$renderer) => {
							$$renderer.push(`${escape_html(ENV_LABEL[e])}`);
						});
					}
					$$renderer.push(`<!--]-->`);
				});
				$$renderer.push(`</div></div> `);
				if (suite()) {
					$$renderer.push("<!--[0-->");
					if (suite().tags.length) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="field"><label>Before you start `);
						if (suite().tags.some((t) => t.startsWith("destructive:"))) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<span class="hint" style="color:#a52019">· this suite destroys data</span>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></label> `);
						SuiteTags($$renderer, { tags: suite().tags });
						$$renderer.push(`<!----> `);
						if (suite().description) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<div class="lm-desc svelte-atl9kn">${escape_html(suite().description)}</div>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <div class="field"><label>Runners in this launch <span class="hint">· untick to skip a kind of test</span></label> <!--[-->`);
					const each_array_2 = ensure_array_like(suite().groups);
					for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
						let g = each_array_2[$$index_2];
						const on = selectedKinds.includes(g.kind);
						$$renderer.push(`<button type="button" class="health-row svelte-atl9kn" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2)"><span${attr_class(`box chk-box ${on ? "on" : ""}`)}${attr_style(`width:16px;height:16px;border-radius:5px;border:1.5px solid ${on ? "var(--ws)" : "#CBD3DE"};background:${on ? "var(--ws)" : "#fff"};display:grid;place-items:center;flex:0 0 16px`)}>`);
						if (on) {
							$$renderer.push("<!--[0-->");
							Icon($$renderer, {
								name: "check-sm",
								class: "chk-tick"
							});
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></span> <div class="hr-b"><div class="hr-n">`);
						KindBadge($$renderer, {
							kind: g.kind,
							small: true
						});
						$$renderer.push(`<!----> ${escape_html(g.name)}</div> <div class="hr-m">${escape_html(g.command)}</div></div> <div class="hr-s"><b>${escape_html(g.count)}</b>case${escape_html(g.count === 1 ? "" : "s")}</div></button>`);
					}
					$$renderer.push(`<!--]--> <!--[-->`);
					const each_array_3 = ensure_array_like(suite().unrunnable);
					for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
						let u = each_array_3[$$index_3];
						const on = selectedKinds.includes(u.kind);
						$$renderer.push(`<button type="button" class="health-row svelte-atl9kn" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2)"><span class="box chk-box"${attr_style(`width:16px;height:16px;border-radius:5px;border:1.5px solid ${on ? "var(--ws)" : "#CBD3DE"};background:${on ? "var(--ws)" : "#fff"};display:grid;place-items:center;flex:0 0 16px`)}>`);
						if (on) {
							$$renderer.push("<!--[0-->");
							Icon($$renderer, {
								name: "check-sm",
								class: "chk-tick"
							});
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></span> <div class="hr-b"><div class="hr-n">`);
						KindBadge($$renderer, {
							kind: u.kind,
							small: true
						});
						$$renderer.push(`<!----> No runner configured</div> <div class="hr-m">these cases will be recorded as skipped</div></div> <div class="hr-s"><b>${escape_html(u.count)}</b>case${escape_html(u.count === 1 ? "" : "s")}</div></button>`);
					}
					$$renderer.push(`<!--]--> `);
					if (suite().manualCount) {
						$$renderer.push("<!--[0-->");
						const on = selectedKinds.includes("manual");
						$$renderer.push(`<button type="button" class="health-row svelte-atl9kn" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2)"><span${attr_class(`box chk-box ${on ? "on" : ""}`)}${attr_style(`width:16px;height:16px;border-radius:5px;border:1.5px solid ${on ? "var(--ws)" : "#CBD3DE"};background:${on ? "var(--ws)" : "#fff"};display:grid;place-items:center;flex:0 0 16px`)}>`);
						if (on) {
							$$renderer.push("<!--[0-->");
							Icon($$renderer, {
								name: "check-sm",
								class: "chk-tick"
							});
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></span> <div class="hr-b"><div class="hr-n">`);
						KindBadge($$renderer, {
							kind: "manual",
							small: true
						});
						$$renderer.push(`<!----> Manual execution</div> <div class="hr-m">a person marks each case in the run</div></div> <div class="hr-s"><b>${escape_html(suite().manualCount)}</b>case${escape_html(suite().manualCount === 1 ? "" : "s")}</div></button>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></div> <div class="field"><label>What will happen</label> <div class="exp-code"><div class="exp-code-bar"><span class="ec-t">execution plan</span></div> <pre>${escape_html(plan().join("\n") || "# nothing selected")}</pre></div></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div> <div class="modal-foot"><div class="ff">Automated runners execute their command; manual cases become a checklist in the same run.</div> <button class="btn btn-ghost">Cancel</button> <button class="btn btn-primary"${attr("disabled", !suite() || !selectedKinds.length, true)}>`);
			Icon($$renderer, { name: "play" });
			$$renderer.push(`<!----> Start run</button></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/checkpoint/FailuresModal.svelte
function FailuresModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let format = "md";
		let content = "";
		const fileName = derived(() => `test-failures.${format}`);
		const failureCount = derived(() => content.match(/^## \d+\. /gm)?.length ?? 0);
		if (cpUi.failures) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="cp-backdrop" role="presentation"><div class="cp-modal wide" role="dialog" aria-modal="true"><div class="modal-head"><div class="mh-icon" style="background:var(--fail-soft);color:#C0343A">`);
			Icon($$renderer, { name: "code" });
			$$renderer.push(`<!----></div> <div><h2>Test failures → Claude Code</h2> <div class="mh-sub">Every failure with its command, error, expected behaviour and runner output — as one prompt</div></div> <button class="x" aria-label="Close">`);
			Icon($$renderer, { name: "x" });
			$$renderer.push(`<!----></button></div> <div class="modal-body"><div class="scope-row"><button${attr_class("scope-chip", void 0, { "on": true })}>All failing cases</button> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="exp-toggle"><button${attr_class("", void 0, { "on": true })}>Markdown prompt</button> <button${attr_class("", void 0, { "on": false })}>JSON</button></div> <div class="exp-code"><div class="exp-code-bar">`);
			Icon($$renderer, { name: "file" });
			$$renderer.push(`<!----><span class="ec-t">${escape_html(fileName())}</span> <span class="ec-n">${escape_html(`${failureCount()} failure${failureCount() === 1 ? "" : "s"}`)}</span></div> <pre>${escape_html(content)}</pre></div></div> <div class="modal-foot"><div class="ff">Paste into Claude Code — it has the spec path, the reproduce command and the expected result for each failure, plus the console output of every runner that failed.</div> <button class="btn btn-ghost">Close</button> <button class="btn btn-dark">`);
			Icon($$renderer, { name: "copy" });
			$$renderer.push(`<!----> ${escape_html("Copy prompt")}</button></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
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
		FailuresModal($$renderer, {});
		$$renderer.push(`<!----></div> `);
		ToastHost($$renderer, {});
		$$renderer.push(`<!---->`);
	});
}
//#endregion
export { _layout as default };
