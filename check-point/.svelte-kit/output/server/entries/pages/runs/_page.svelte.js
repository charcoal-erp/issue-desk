import { C as attr, T as escape_html, c as stringify, i as ensure_array_like, l as unsubscribe_stores, n as attr_style, r as derived, s as store_get, t as attr_class } from "../../../chunks/server.js";
import { c as rateColor, n as ENV_LABEL } from "../../../chunks/meta.js";
import { t as goto } from "../../../chunks/client.js";
import "../../../chunks/toasts.svelte.js";
import { n as Icon, t as KindBadge } from "../../../chunks/KindBadge.js";
import "../../../chunks/checkpoint-ui.svelte.js";
import "../../../chunks/forms.js";
import { t as page } from "../../../chunks/stores.js";
import { t as ProgressBar } from "../../../chunks/ProgressBar.js";
//#region src/routes/runs/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { data } = $$props;
		/** Filters live in the URL, so any view — including one suite's history — is shareable. */
		function setParam(key, value) {
			const params = new URLSearchParams(store_get($$store_subs ??= {}, "$page", page).url.searchParams);
			if (value) params.set(key, value);
			else params.delete(key);
			goto(`/runs?${params}`, {
				keepFocus: true,
				noScroll: true
			});
		}
		derived(() => data.suites.find((s) => s.id === data.filter.suiteId)?.name ?? null);
		$$renderer.push(`<div class="table-area"><div class="toolbar"><h1>Test Runs</h1> <span class="count">${escape_html(data.runs.length)} run${escape_html(data.runs.length === 1 ? "" : "s")}</span> <div class="toolbar-spacer"></div> <button class="btn btn-ghost">`);
		Icon($$renderer, { name: "trash" });
		$$renderer.push(`<!----> Clean up</button> <button class="btn btn-primary">`);
		Icon($$renderer, { name: "play" });
		$$renderer.push(`<!----> Launch run</button></div> <div class="run-filters svelte-1btsuzj"><div class="run-tabs svelte-1btsuzj"><!--[-->`);
		const each_array = ensure_array_like(data.tabs);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let t = each_array[$$index];
			$$renderer.push(`<button${attr_class("run-tab svelte-1btsuzj", void 0, { "on": data.filter.age === t.key })}>${escape_html(t.label)}<span class="rt-n svelte-1btsuzj">${escape_html(t.count)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="rf-spacer svelte-1btsuzj"></div> `);
		$$renderer.select({
			class: "sel sel-sm",
			value: data.filter.suiteId,
			onchange: (e) => setParam("suite", e.currentTarget.value)
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`All suites`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(data.suites);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let s = each_array_1[$$index_1];
				$$renderer.option({ value: s.id }, ($$renderer) => {
					$$renderer.push(`${escape_html(s.name)} (${escape_html(s.runs)})`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-1btsuzj");
		$$renderer.push(` `);
		$$renderer.select({
			class: "sel sel-sm",
			value: data.filter.outcome,
			onchange: (e) => setParam("outcome", e.currentTarget.value)
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`Any outcome`);
			});
			$$renderer.option({ value: "failing" }, ($$renderer) => {
				$$renderer.push(`With failures`);
			});
			$$renderer.option({ value: "passing" }, ($$renderer) => {
				$$renderer.push(`No failures`);
			});
		}, "svelte-1btsuzj");
		$$renderer.push(`</div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="scroll">`);
		if (data.runs.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<!--[-->`);
			const each_array_3 = ensure_array_like(data.runs);
			for (let $$index_4 = 0, $$length = each_array_3.length; $$index_4 < $$length; $$index_4++) {
				let r = each_array_3[$$index_4];
				$$renderer.push(`<div${attr_class("run-card svelte-1btsuzj", void 0, { "archived": r.archived })}><button class="run-open svelte-1btsuzj"${attr("aria-label", `Open ${stringify(r.id)}`)}><div class="run-top"><span class="run-id">${escape_html(r.id)}</span> <span class="run-suite">${escape_html(r.suiteName)}</span> <!--[-->`);
				const each_array_4 = ensure_array_like(r.kinds);
				for (let $$index_3 = 0, $$length = each_array_4.length; $$index_3 < $$length; $$index_3++) {
					let k = each_array_4[$$index_3];
					KindBadge($$renderer, {
						kind: k,
						small: true
					});
				}
				$$renderer.push(`<!--]--> <span class="env-chip">${escape_html(ENV_LABEL[r.environment])}</span> `);
				if (r.archived) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="arch-chip svelte-1btsuzj">`);
					Icon($$renderer, { name: "check" });
					$$renderer.push(`<!----> archived</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (r.running) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="arch-chip live svelte-1btsuzj">running</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <span class="run-meta">${escape_html(r.by)} · ${escape_html(r.when)}</span></div> `);
				ProgressBar($$renderer, { counts: r.counts });
				$$renderer.push(`<!----> <div class="run-counts"><span class="rc"><span class="res-dot rd-pass"></span> ${escape_html(r.counts.pass)} pass</span> <span class="rc"><span class="res-dot rd-fail"></span> ${escape_html(r.counts.fail)} fail</span> `);
				if (r.counts.blocked) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="rc"><span class="res-dot rd-blocked"></span> ${escape_html(r.counts.blocked)} blocked</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (r.counts.skipped) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="rc"><span class="res-dot rd-skipped"></span> ${escape_html(r.counts.skipped)} skipped</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <span class="passrate"${attr_style(`color:${stringify(rateColor(r.passRate))}`)}>${escape_html(r.passRate === null ? "—" : `${r.passRate}%`)}</span></div></button> <div class="run-actions svelte-1btsuzj">`);
				if (r.counts.fail + r.counts.blocked > 0) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<button class="btn btn-danger btn-xs"${attr("title", `Build a Claude Code prompt from this run's ${stringify(r.counts.fail)} failing and ${stringify(r.counts.blocked)} blocked case${r.counts.fail + r.counts.blocked === 1 ? "" : "s"} — with the runner output`)}>`);
					Icon($$renderer, { name: "code" });
					$$renderer.push(`<!----> Fix ${escape_html(r.counts.fail + r.counts.blocked)}</button>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <form method="POST" action="?/archiveRun"><input type="hidden" name="id"${attr("value", r.id)}/> <input type="hidden" name="archived"${attr("value", r.archived ? "false" : "true")}/> <button class="btn btn-ghost btn-xs"${attr("title", r.archived ? "Allow cleanup to delete this run" : "Keep this run through cleanups")}>`);
				Icon($$renderer, { name: "check" });
				$$renderer.push(`<!----> ${escape_html(r.archived ? "Un-archive" : "Archive")}</button></form> <form method="POST" action="?/deleteRun"><input type="hidden" name="id"${attr("value", r.id)}/> <button class="btn btn-ghost btn-xs"${attr("aria-label", `Delete ${stringify(r.id)}`)} title="Delete this run">`);
				Icon($$renderer, { name: "trash" });
				$$renderer.push(`<!----></button></form></div></div>`);
			}
			$$renderer.push(`<!--]-->`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="empty"><div class="empty-in"><div class="ei">`);
			Icon($$renderer, { name: "play" });
			$$renderer.push(`<!----></div> <h3>${escape_html(data.filter.age !== "all" || data.filter.suiteId || data.filter.outcome ? "No runs match this filter" : "No runs yet")}</h3> <p>`);
			if (data.filter.age !== "all" || data.filter.suiteId || data.filter.outcome) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`Clear the filters to see the whole history.`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`Launch a suite to record a run — automated runners execute, manual cases become a checklist, all under one pass rate.`);
			}
			$$renderer.push(`<!--]--></p> <button class="btn btn-primary" style="margin-top:14px">`);
			Icon($$renderer, { name: "play" });
			$$renderer.push(`<!----> Launch run</button></div></div>`);
		}
		$$renderer.push(`<!--]--></div></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
