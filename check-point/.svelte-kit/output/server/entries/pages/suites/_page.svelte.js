import "../../../chunks/internal.js";
import { C as attr, T as escape_html, c as stringify, i as ensure_array_like, l as unsubscribe_stores, lt as run, n as attr_style, r as derived, s as store_get, t as attr_class } from "../../../chunks/server.js";
import { a as SUITE_ENVIRONMENTS } from "../../../chunks/types.js";
import { a as TEST_KIND_META, c as rateColor, n as ENV_LABEL } from "../../../chunks/meta.js";
import { t as goto } from "../../../chunks/client.js";
import "../../../chunks/toasts.svelte.js";
import { n as Icon, t as KindBadge } from "../../../chunks/KindBadge.js";
import { n as openLaunch } from "../../../chunks/checkpoint-ui.svelte.js";
import { t as SuiteTags } from "../../../chunks/SuiteTags.js";
import "../../../chunks/forms.js";
import { t as page } from "../../../chunks/stores.js";
import { t as isActive } from "../../../chunks/catalogFilters.js";
//#region src/lib/components/checkpoint/SuiteEditor.svelte
function SuiteEditor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { applications, editor, onCancel, onSaved } = $$props;
		const s = run(() => editor.suite);
		let name = s?.name ?? "";
		let description = s?.description ?? "";
		let appId = s?.appId ?? run(() => applications[0]?.id) ?? "";
		let defaultEnv = s?.defaultEnv ?? "local";
		let tags = s?.tags.join(", ") ?? "";
		let caseIds = s ? [...s.caseIds] : [];
		let libApp = "all";
		let libType = "all";
		let saving = false;
		const caseById = derived(() => new Map(editor.allCases.map((c) => [c.id, c])));
		const membership = derived(() => caseIds.map((id) => caseById().get(id)).filter(Boolean));
		const library = derived(() => editor.allCases.filter((c) => !caseIds.includes(c.id) && true));
		function runnerFor(c) {
			if (c.runnerId) {
				const own = editor.runners.find((r) => r.id === c.runnerId);
				if (own?.enabled && own.kind === c.kind) return own;
			}
			return editor.runners.find((r) => r.kind === c.kind && r.enabled) ?? null;
		}
		/** One row per runner this suite will invoke — several per kind is normal. */
		const invokes = derived(() => {
			const rows = /* @__PURE__ */ new Map();
			for (const c of membership()) {
				const runner = c.kind === "manual" ? null : runnerFor(c);
				const key = runner ? runner.id : `none:${c.kind}`;
				const row = rows.get(key);
				if (row) row.count += 1;
				else rows.set(key, {
					key,
					kind: c.kind,
					count: 1,
					runner
				});
			}
			return [...rows.values()];
		});
		const appLetters = derived(() => [...new Set(editor.allCases.map((c) => c.appCode))]);
		$$renderer.push(`<div class="editor"><div class="ed-grid"><div class="card" style="padding:16px"><div class="sec-title">Suite details</div> <div class="field"><label for="se-name">Name</label> <input id="se-name" class="inp" name="name"${attr("value", name)} placeholder="Billing release" form="suite-form"/></div> <div class="field"><label for="se-desc">Description</label> <textarea id="se-desc" class="inp" name="description" placeholder="What this suite guarantees" form="suite-form">`);
		const $$body = escape_html(description);
		if ($$body) $$renderer.push(`${$$body}`);
		$$renderer.push(`</textarea></div> <div class="grid2"><div class="field"><label for="se-app">Application</label> `);
		$$renderer.select({
			id: "se-app",
			class: "sel",
			name: "appId",
			value: appId,
			form: "suite-form"
		}, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(applications);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let a = each_array[$$index];
				$$renderer.option({ value: a.id }, ($$renderer) => {
					$$renderer.push(`${escape_html(a.name)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</div> <div class="field"><label for="se-env">Default environment</label> `);
		$$renderer.select({
			id: "se-env",
			class: "sel",
			name: "defaultEnv",
			value: defaultEnv,
			form: "suite-form"
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
		$$renderer.push(`</div></div> <div class="field"><label for="se-tags">Tags <span class="hint">· comma-separated</span></label> <input id="se-tags" class="inp" name="tags"${attr("value", tags)} placeholder="release, billing" form="suite-form"/></div></div> <div class="card" style="padding:16px"><div class="sec-title">Runners this suite will invoke</div> `);
		if (invokes().length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="panel-bd tight" style="padding:0"><!--[-->`);
			const each_array_2 = ensure_array_like(invokes());
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let row = each_array_2[$$index_2];
				$$renderer.push(`<div class="health-row"><span${attr_class(`hdot ${row.runner || row.kind === "manual" ? "h-ok" : "h-idle"}`)}></span> <div class="hr-b"><div class="hr-n">`);
				KindBadge($$renderer, {
					kind: row.kind,
					small: true
				});
				$$renderer.push(`<!----> ${escape_html(row.runner?.name ?? (row.kind === "manual" ? "Manual execution" : "No runner defined"))}</div> <div class="hr-m">${escape_html(row.kind === "manual" ? "a person marks each case in the run" : row.runner?.command ?? "—")}</div></div> <div class="hr-s"><b>${escape_html(row.count)}</b>case${escape_html(row.count === 1 ? "" : "s")}</div></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<p style="color:var(--muted);font-size:12.5px">Add cases to see which runners this suite will invoke.</p>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="ed-grid"><div class="picker"><div class="picker-hd">Case library <span class="pk-n">${escape_html(library().length)} available</span></div> <div class="pk-filter"><button${attr_class("pk-chip", void 0, { "on": true })}>All apps</button> <!--[-->`);
		const each_array_3 = ensure_array_like(appLetters());
		for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
			let code = each_array_3[$$index_3];
			const appId2 = editor.allCases.find((c) => c.appCode === code)?.appId ?? "";
			$$renderer.push(`<button${attr_class("pk-chip", void 0, { "on": libApp === appId2 })}>${escape_html(code)}</button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="pk-filter"><button${attr_class("pk-chip", void 0, { "on": true })}>All types</button> <!--[-->`);
		const each_array_4 = ensure_array_like(Object.keys(TEST_KIND_META));
		for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
			let k = each_array_4[$$index_4];
			$$renderer.push(`<button${attr_class("pk-chip", void 0, { "on": libType === k })}>${escape_html(TEST_KIND_META[k].label)}</button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="picker-body">`);
		const each_array_5 = ensure_array_like(library());
		if (each_array_5.length !== 0) {
			$$renderer.push("<!--[-->");
			for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
				let c = each_array_5[$$index_5];
				$$renderer.push(`<div class="pk-row"><span class="pk-id">${escape_html(c.id)}</span> <span class="pk-t">${escape_html(c.title)}</span> `);
				KindBadge($$renderer, {
					kind: c.kind,
					small: true
				});
				$$renderer.push(`<!----> <button class="mini-btn" aria-label="Add">`);
				Icon($$renderer, { name: "plus" });
				$$renderer.push(`<!----></button></div>`);
			}
		} else {
			$$renderer.push("<!--[!-->");
			$$renderer.push(`<div class="pk-row" style="color:var(--faint);justify-content:center">No more cases match this filter.</div>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="picker"><div class="picker-hd">In this suite <span class="pk-n">${escape_html(membership().length)} selected · runs in order</span></div> <div class="picker-body">`);
		const each_array_6 = ensure_array_like(membership());
		if (each_array_6.length !== 0) {
			$$renderer.push("<!--[-->");
			for (let i = 0, $$length = each_array_6.length; i < $$length; i++) {
				let c = each_array_6[i];
				$$renderer.push(`<div class="pk-row"><span class="pk-ord">${escape_html(i + 1)}</span> <span class="pk-id">${escape_html(c.id)}</span> <span class="pk-t">${escape_html(c.title)}</span> `);
				KindBadge($$renderer, {
					kind: c.kind,
					small: true
				});
				$$renderer.push(`<!----> <button class="mini-btn"${attr("disabled", i === 0, true)} aria-label="Up">`);
				Icon($$renderer, { name: "arrow-up" });
				$$renderer.push(`<!----></button> <button class="mini-btn"${attr("disabled", i === membership().length - 1, true)} aria-label="Down">`);
				Icon($$renderer, { name: "arrow-down" });
				$$renderer.push(`<!----></button> <button class="mini-btn danger" aria-label="Remove">`);
				Icon($$renderer, { name: "x" });
				$$renderer.push(`<!----></button></div>`);
			}
		} else {
			$$renderer.push("<!--[!-->");
			$$renderer.push(`<div class="pk-row" style="color:var(--faint);justify-content:center">Empty — add cases from the library on the left.</div>`);
		}
		$$renderer.push(`<!--]--></div></div></div> <form id="suite-form" method="POST" action="/suites?/upsertSuite">`);
		if (editor.suite) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<input type="hidden" name="id"${attr("value", editor.suite.id)}/>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <input type="hidden" name="caseIds"${attr("value", JSON.stringify(caseIds))}/> <div class="launch-panel" style="margin-top:4px"><div><div class="lp-t">${escape_html(editor.suite ? "Ready to launch" : "Save, then launch")}</div> <div class="lp-d">${escape_html(membership().length)} case${escape_html(membership().length === 1 ? "" : "s")} across ${escape_html(invokes().length)} runner${escape_html(invokes().length === 1 ? "" : "s")} · default env ${escape_html(ENV_LABEL[defaultEnv])}</div></div> <div class="lp-sp"></div> <button type="button" class="btn btn-ghost btn-sm">Cancel</button> <button type="submit" class="btn btn-primary btn-sm"${attr("disabled", saving, true)}>`);
		Icon($$renderer, { name: "check" });
		$$renderer.push(`<!----> Save suite</button> <button type="submit" class="btn btn-dark btn-sm"${attr("disabled", !membership().length, true)}>`);
		Icon($$renderer, { name: "play" });
		$$renderer.push(`<!----> Save &amp; launch</button></div></form></div>`);
	});
}
//#endregion
//#region src/routes/suites/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { data } = $$props;
		const KIND_OPTIONS = [
			{
				value: "unit",
				label: "Unit"
			},
			{
				value: "api",
				label: "API"
			},
			{
				value: "e2e",
				label: "E2E"
			},
			{
				value: "visual",
				label: "Visual"
			},
			{
				value: "shell",
				label: "Shell"
			},
			{
				value: "manual",
				label: "Manual"
			},
			{
				value: "seed",
				label: "Seeding"
			}
		];
		const filterActive = derived(() => isActive(data.filter));
		/** Filters live in the URL so a narrowed grid is shareable and Back undoes it. */
		function setParam(key, value) {
			const params = new URLSearchParams(store_get($$store_subs ??= {}, "$page", page).url.searchParams);
			if (value) params.set(key, value);
			else params.delete(key);
			params.delete("edit");
			params.delete("new");
			goto(`/suites?${params}`, {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}
		function onSaved(suite, launch) {
			goto("/suites").then(() => {
				if (launch) openLaunch(suite.id);
			});
		}
		if (data.editor) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="table-area"><div class="toolbar"><h1>${escape_html(data.editor.suite ? "Edit suite" : "New suite")}</h1> <div class="toolbar-spacer"></div> <a class="btn btn-ghost" href="/suites">`);
			Icon($$renderer, {
				name: "arrow-right",
				class: "flip"
			});
			$$renderer.push(`<!----> All suites</a></div> `);
			SuiteEditor($$renderer, {
				applications: data.applications,
				editor: data.editor,
				onCancel: () => goto("/suites"),
				onSaved
			});
			$$renderer.push(`<!----></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="table-area"><div class="toolbar"><h1>Test Suites</h1> <span class="count">${escape_html(data.cards.length === data.total ? `${data.total} suites` : `${data.cards.length} of ${data.total} suites`)}</span> <div class="toolbar-spacer"></div> <a class="btn btn-primary" href="/suites?new=1">`);
			Icon($$renderer, { name: "plus" });
			$$renderer.push(`<!----> New suite</a></div> <div class="filter-bar"><div class="fb-search">`);
			Icon($$renderer, { name: "search" });
			$$renderer.push(`<!----> <input class="inp inp-sm" placeholder="Name, id or tag…"${attr("value", data.filter.q)}/></div> `);
			$$renderer.select({
				class: "sel sel-sm",
				value: data.filter.kind,
				onchange: (e) => setParam("kind", e.currentTarget.value)
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`Any type`);
				});
				$$renderer.push(`<!--[-->`);
				const each_array = ensure_array_like(KIND_OPTIONS);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let k = each_array[$$index];
					if (data.kindCounts[k.value]) {
						$$renderer.push("<!--[0-->");
						$$renderer.option({ value: k.value }, ($$renderer) => {
							$$renderer.push(`${escape_html(k.label)} (${escape_html(data.kindCounts[k.value])})`);
						});
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			});
			$$renderer.push(` `);
			$$renderer.select({
				class: "sel sel-sm",
				value: data.filter.env,
				onchange: (e) => setParam("env", e.currentTarget.value)
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`Any environment`);
				});
				$$renderer.push(`<!--[-->`);
				const each_array_1 = ensure_array_like(data.envs);
				for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
					let e = each_array_1[$$index_1];
					$$renderer.option({ value: e }, ($$renderer) => {
						$$renderer.push(`${escape_html(ENV_LABEL[e])}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			});
			$$renderer.push(` `);
			$$renderer.select({
				class: "sel sel-sm",
				value: data.filter.state,
				onchange: (e) => setParam("state", e.currentTarget.value)
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`Any last run`);
				});
				$$renderer.option({ value: "failing" }, ($$renderer) => {
					$$renderer.push(`Failing or blocked (${escape_html(data.failingTotal)})`);
				});
				$$renderer.option({ value: "passing" }, ($$renderer) => {
					$$renderer.push(`Last run clean`);
				});
				$$renderer.option({ value: "never" }, ($$renderer) => {
					$$renderer.push(`Never run`);
				});
			});
			$$renderer.push(` <div class="fb-spacer"></div> `);
			if (filterActive()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<a class="btn btn-ghost btn-sm" href="/suites">`);
				Icon($$renderer, { name: "x" });
				$$renderer.push(`<!----> Reset</a>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="scroll">`);
			if (data.cards.length) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="suite-grid"><!--[-->`);
				const each_array_2 = ensure_array_like(data.cards);
				for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
					let s = each_array_2[$$index_3];
					$$renderer.push(`<div class="suite-card tone-card"${attr("data-tone", s.tone)}><a class="suite-hd"${attr("href", `/suites?edit=${stringify(s.id)}`)}${attr("title", s.description || s.name)}><div class="sh-top"><span class="suite-id">${escape_html(s.id)}</span> <span class="suite-app">${escape_html(s.appName)}</span> <span class="env-chip" style="margin-left:auto">${escape_html(ENV_LABEL[s.defaultEnv])}</span></div> <div class="suite-name">${escape_html(s.name)}</div> `);
					if (s.tags.length) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="suite-tagrow">`);
						SuiteTags($$renderer, {
							tags: s.tags,
							compact: true,
							max: 2
						});
						$$renderer.push(`<!----></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></a> <div class="suite-bd"><div class="suite-kinds"><!--[-->`);
					const each_array_3 = ensure_array_like(s.kinds);
					for (let $$index_2 = 0, $$length = each_array_3.length; $$index_2 < $$length; $$index_2++) {
						let k = each_array_3[$$index_2];
						KindBadge($$renderer, {
							kind: k,
							small: true
						});
					}
					$$renderer.push(`<!--]--> `);
					if (!s.kinds.length) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<span style="color:var(--faint);font-size:12px">no cases yet</span>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></div> <div class="suite-nums"><div class="sn"><span class="v">${escape_html(s.total)}</span><span class="k">cases</span></div> <div class="sn"><span class="v" style="color:var(--k-manual)">${escape_html(s.manual)}</span><span class="k">manual</span></div> <div class="sn"><span class="v" style="color:var(--k-e2e)">${escape_html(s.automated)}</span><span class="k">automated</span></div> <div style="margin-left:auto;text-align:right"><div class="v"${attr_style(`font-family:var(--font-display);font-weight:600;font-size:17px;color:${stringify(rateColor(s.lastPassRate))}`)}>${escape_html(s.lastPassRate === null ? "—" : `${s.lastPassRate}%`)}</div> <span class="k" style="font-size:10px;color:var(--muted)">last run</span></div></div> `);
					if (s.lastRun) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<a class="lastrun"${attr("href", `/runs/${stringify(s.lastRun.runId)}`)}${attr("title", `Open ${stringify(s.lastRun.runId)}`)}><span${attr_class("lr-pill lr-pass", void 0, { "zero": !s.lastRun.pass })}>${escape_html(s.lastRun.pass)} passed</span> <span${attr_class("lr-pill lr-fail", void 0, { "zero": !s.lastRun.fail })}>${escape_html(s.lastRun.fail)} failed</span> `);
						if (s.lastRun.blocked) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<span class="lr-pill lr-blocked">${escape_html(s.lastRun.blocked)} blocked</span>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						if (s.lastRun.skipped) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<span class="lr-pill lr-skipped">${escape_html(s.lastRun.skipped)} skipped</span>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> <span class="lr-when">${escape_html(s.lastRun.when)} ago</span></a>`);
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<div class="lastrun empty-run">Never run</div>`);
					}
					$$renderer.push(`<!--]--></div> <div class="suite-foot"><button class="btn btn-primary btn-sm">`);
					Icon($$renderer, { name: "play" });
					$$renderer.push(`<!----> Launch</button> `);
					if (s.lastRun && s.lastRun.fail + s.lastRun.blocked > 0) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<button class="btn btn-danger btn-sm"${attr("title", `Build a Claude Code prompt from this suite's ${stringify(s.lastRun.fail)} failing and ${stringify(s.lastRun.blocked)} blocked case${s.lastRun.fail + s.lastRun.blocked === 1 ? "" : "s"} — with the runner output`)}>`);
						Icon($$renderer, { name: "code" });
						$$renderer.push(`<!----> Fix ${escape_html(s.lastRun.fail + s.lastRun.blocked)}</button>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <a class="btn btn-ghost btn-sm"${attr("href", `/runs?suite=${stringify(s.id)}`)} aria-label="Run history" title="This suite's run history — archive or clean up its runs">`);
					Icon($$renderer, { name: "play" });
					$$renderer.push(`<!---->`);
					if (s.runCount) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<span class="foot-n svelte-1f6t6ye">${escape_html(s.runCount)}`);
						if (s.archivedRuns) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`·${escape_html(s.archivedRuns)}★`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></span>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></a> <a class="btn btn-ghost btn-sm"${attr("href", `/suites?edit=${stringify(s.id)}`)} aria-label="Edit suite" title="Edit suite">`);
					Icon($$renderer, { name: "edit" });
					$$renderer.push(`<!----></a> <form method="POST" action="?/duplicateSuite"><button class="btn btn-ghost btn-sm" aria-label="Duplicate suite" title="Duplicate suite">`);
					Icon($$renderer, { name: "copy" });
					$$renderer.push(`<!----></button> <input type="hidden" name="id"${attr("value", s.id)}/></form> <form method="POST" action="?/deleteSuite"><input type="hidden" name="id"${attr("value", s.id)}/> <button class="btn btn-ghost btn-sm" aria-label="Delete suite" title="Delete suite">`);
					Icon($$renderer, { name: "trash" });
					$$renderer.push(`<!----></button></form></div></div>`);
				}
				$$renderer.push(`<!--]--></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="empty"><div class="empty-in"><div class="ei">`);
				Icon($$renderer, { name: "layers" });
				$$renderer.push(`<!----></div> `);
				if (filterActive()) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<h3>No suites match this filter</h3> <p>${escape_html(data.total)} suite${escape_html(data.total === 1 ? "" : "s")} in the catalogue — clear the filter to see them.</p> <a class="btn btn-primary" style="margin-top:14px" href="/suites">`);
					Icon($$renderer, { name: "x" });
					$$renderer.push(`<!----> Reset filter</a>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<h3>No suites yet</h3> <p>Group cases into a suite to run them together — mix API, e2e, visual and manual under one pass rate.</p> <a class="btn btn-primary" style="margin-top:14px" href="/suites?new=1">`);
					Icon($$renderer, { name: "plus" });
					$$renderer.push(`<!----> New suite</a>`);
				}
				$$renderer.push(`<!--]--></div></div>`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		}
		$$renderer.push(`<!--]-->`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
