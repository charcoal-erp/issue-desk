import '../../../chunks/internal.js-CuIsDgeO.js';
import { a0 as escape_html, Z as attr, a1 as ensure_array_like, X as attr_class, $ as stringify, a4 as store_get, y as derived, a5 as unsubscribe_stores } from '../../../chunks/server.js-CDtqtqwP.js';
import { T as TEST_KINDS } from '../../../chunks/types.js-BxhiHiuh.js';
import { T as TEST_KIND_META } from '../../../chunks/meta.js-Drcdnnre.js';
import { g as goto } from '../../../chunks/client.js-DlRkZ906.js';
import { I as Icon, K as KindBadge } from '../../../chunks/KindBadge.js-DqDHG5dw.js';
import { p as page } from '../../../chunks/stores.js-DUjTzTZH.js';
import { i as isActive } from '../../../chunks/catalogFilters.js-GAdx040e.js';
import { r as runnerTone } from '../../../chunks/tone.js-BNWx3iVu.js';
import '../../../chunks/shared.js-C8TgK89F.js';
import '../../../chunks/exports.js-Bq66Su2C.js';
import '../../../chunks/utils.js-r4C_CEqs.js';

//#region src/lib/components/CopyButton.svelte
function CopyButton($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* A copy button that reports what actually happened — if the write fails
		* (see writeClipboard for when that happens) it says so rather than showing
		* a tick and copying nothing.
		*/
		let { label = "", title = "Copy to clipboard", variant = "light" } = $$props;
		const caption = derived(() => label);
		$$renderer.push(`<button type="button"${attr_class(`copy-btn ${stringify(variant)}`, "svelte-1kw4msz", {
			"done": false,
			"failed": false
		})}${attr("title", title)}${attr("aria-label", title)}>`);
		Icon($$renderer, { name: "copy" });
		$$renderer.push(`<!----> `);
		if (caption()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="cb-label svelte-1kw4msz">${escape_html(caption())}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></button>`);
	});
}
//#endregion
//#region src/routes/runners/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { data } = $$props;
		const filterActive = derived(() => isActive(data.filter));
		/** Filters live in the URL so a narrowed grid is shareable and Back undoes it. */
		function setParam(key, value) {
			const params = new URLSearchParams(store_get($$store_subs ??= {}, "$page", page).url.searchParams);
			if (value) params.set(key, value);
			else params.delete(key);
			goto(`/runners?${params}`, {
				});
		}
		$$renderer.push(`<div class="table-area"><div class="toolbar"><h1>Runners</h1> <span class="count">${escape_html(data.runners.length === data.total ? `${data.total} runners` : `${data.runners.length} of ${data.total} runners`)}</span> <div class="toolbar-spacer"></div> <button class="btn btn-primary">`);
		Icon($$renderer, { name: "plus" });
		$$renderer.push(`<!----> New runner</button></div> <div class="filter-bar"><div class="fb-search">`);
		Icon($$renderer, { name: "search" });
		$$renderer.push(`<!----> <input class="inp inp-sm" placeholder="Name, id or command…"${attr("value", data.filter.q)}/></div> `);
		$$renderer.select({
			class: "sel sel-sm",
			value: data.filter.kind,
			onchange: (e) => setParam("kind", e.currentTarget.value)
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`Any type`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(TEST_KINDS);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let k = each_array[$$index];
				if (data.kindCounts[k]) {
					$$renderer.push("<!--[0-->");
					$$renderer.option({ value: k }, ($$renderer) => {
						$$renderer.push(`${escape_html(TEST_KIND_META[k].label)} (${escape_html(data.kindCounts[k])})`);
					});
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(` `);
		$$renderer.select({
			class: "sel sel-sm",
			value: data.filter.lang,
			onchange: (e) => setParam("lang", e.currentTarget.value)
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`Any language`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(Object.entries(data.langCounts).sort());
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let [lang, n] = each_array_1[$$index_1];
				$$renderer.option({ value: lang }, ($$renderer) => {
					$$renderer.push(`${escape_html(lang)} (${escape_html(n)})`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(` `);
		$$renderer.select({
			class: "sel sel-sm",
			value: data.filter.health,
			onchange: (e) => setParam("health", e.currentTarget.value)
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`Any health`);
			});
			$$renderer.option({ value: "healthy" }, ($$renderer) => {
				$$renderer.push(`Healthy`);
			});
			$$renderer.option({ value: "flaky" }, ($$renderer) => {
				$$renderer.push(`Flaky`);
			});
			$$renderer.option({ value: "failing" }, ($$renderer) => {
				$$renderer.push(`Failing`);
			});
			$$renderer.option({ value: "unknown" }, ($$renderer) => {
				$$renderer.push(`Never run`);
			});
		});
		$$renderer.push(` `);
		$$renderer.select({
			class: "sel sel-sm",
			value: data.filter.enabled,
			onchange: (e) => setParam("enabled", e.currentTarget.value)
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`Enabled &amp; disabled`);
			});
			$$renderer.option({ value: "on" }, ($$renderer) => {
				$$renderer.push(`Enabled only`);
			});
			$$renderer.option({ value: "off" }, ($$renderer) => {
				$$renderer.push(`Disabled only (${escape_html(data.disabledTotal)})`);
			});
		});
		$$renderer.push(` <div class="fb-spacer"></div> `);
		if (filterActive()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<a class="btn btn-ghost btn-sm" href="/runners">`);
			Icon($$renderer, { name: "x" });
			$$renderer.push(`<!----> Reset</a>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="scroll">`);
		if (data.runners.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="runner-grid"><!--[-->`);
			const each_array_2 = ensure_array_like(data.runners);
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let r = each_array_2[$$index_2];
				$$renderer.push(`<div${attr_class("runner-card tone-card", void 0, { "off": !r.enabled })}${attr("data-tone", runnerTone(r.kind))}><div class="runner-hd">`);
				KindBadge($$renderer, {
					kind: r.kind,
					small: true
				});
				$$renderer.push(`<!----> <div class="rn-title"><span class="rn-n">${escape_html(r.name)}</span> <span class="rn-id">${escape_html(r.id)} · ${escape_html(r.language)}</span></div> <span style="margin-left:auto"></span> `);
				if (!r.enabled) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="rn-off">disabled</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <span${attr_class(`hdot h-${stringify(r.health)}`)}${attr("title", `Health: ${stringify(r.health)}`)}></span></div> <div class="cmd-box"><code class="cmd-text"${attr("title", r.command || void 0)}><span class="pfx">$</span>${escape_html(r.command || "(performed by a person)")}</code> `);
				if (r.command) {
					$$renderer.push("<!--[0-->");
					CopyButton($$renderer, {
						text: r.command,
						variant: "dark",
						title: "Copy the command"
					});
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div> <div class="runner-meta"><div><div class="rm-k">Working dir</div><div class="rm-v">${escape_html(r.workingDir || "—")}</div></div> <div><div class="rm-k">Report format</div><div class="rm-v">${escape_html(r.reportFormat)}</div></div> <div><div class="rm-k">Report path</div><div class="rm-v">${escape_html(r.reportPath || "—")}</div></div> <div><div class="rm-k">Case matched by</div><div class="rm-v">${escape_html(r.matchLabel)}</div></div></div> <div class="runner-foot"><span class="rf-stat">avg <b>${escape_html(r.avgLabel)}</b></span> <span${attr_class("rf-stat", void 0, { "flaky": r.flakeRatePct >= 5 })}>flake <b>${escape_html(r.flakeRatePct)}%</b></span> <span class="rf-stat">last ${escape_html(r.lastLabel)}</span> <span style="flex:1"></span> `);
				if (r.kind !== "manual") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<button class="btn btn-ghost btn-xs">`);
					Icon($$renderer, { name: "play" });
					$$renderer.push(`<!----> Run now</button>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <button class="btn btn-ghost btn-xs">`);
				Icon($$renderer, { name: "edit" });
				$$renderer.push(`<!----> Edit</button> <form method="POST" action="?/toggleRunner"><input type="hidden" name="id"${attr("value", r.id)}/> <input type="hidden" name="enabled"${attr("value", r.enabled ? "false" : "true")}/> <button class="btn btn-ghost btn-xs">${escape_html(r.enabled ? "Disable" : "Enable")}</button></form> <form method="POST" action="?/deleteRunner"><input type="hidden" name="id"${attr("value", r.id)}/> <button class="btn btn-ghost btn-xs" aria-label="Delete runner">`);
				Icon($$renderer, { name: "trash" });
				$$renderer.push(`<!----></button></form></div></div>`);
			}
			$$renderer.push(`<!--]--></div> <div class="sec-title" style="margin-top:26px">Report normalization</div> <div class="card" style="padding:16px 18px;font-size:13px;color:var(--ink-2);line-height:1.65;max-width:900px">Each runner declares a <b>report format</b> and <b>report path</b>. An adapter parses every
				format into one normalized shape — <span class="tag" style="font-family:var(--font-mono)">{ caseId, status, durationMs, message, stack, artifacts[] }</span> — matched back to a case by its <b>test identifier</b>. That is why a single run can span
				pytest, Playwright and a shell script and still yield one pass rate and one failure export.</div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="empty"><div class="empty-in"><div class="ei">`);
			Icon($$renderer, { name: "terminal" });
			$$renderer.push(`<!----></div> `);
			if (filterActive()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<h3>No runners match this filter</h3> <p>${escape_html(data.total)} runner${escape_html(data.total === 1 ? "" : "s")} defined — clear the filter to see them.</p> <a class="btn btn-primary" style="margin-top:14px" href="/runners">`);
				Icon($$renderer, { name: "x" });
				$$renderer.push(`<!----> Reset filter</a>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<h3>No runners yet</h3> <p>A runner is the single place that knows how a class of test is invoked and how its report is read. Define one to start recording automated results.</p> <button class="btn btn-primary" style="margin-top:14px">`);
				Icon($$renderer, { name: "plus" });
				$$renderer.push(`<!----> New runner</button>`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		}
		$$renderer.push(`<!--]--></div></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-jyDNtG_f.js.map
