import "../../../chunks/internal.js";
import { C as attr, T as escape_html, c as stringify, i as ensure_array_like, l as unsubscribe_stores, lt as run, n as attr_style, r as derived, s as store_get, t as attr_class } from "../../../chunks/server.js";
import { i as RUNNER_LANGUAGES, n as REPORT_FORMATS, s as TEST_KINDS } from "../../../chunks/types.js";
import { a as TEST_KIND_META, r as REPORT_FORMAT_LABEL } from "../../../chunks/meta.js";
import { t as goto } from "../../../chunks/client.js";
import "../../../chunks/toasts.svelte.js";
import { n as Icon, t as KindBadge } from "../../../chunks/KindBadge.js";
import "../../../chunks/forms.js";
import { t as page } from "../../../chunks/stores.js";
import { t as isActive } from "../../../chunks/catalogFilters.js";
import { n as runnerTone } from "../../../chunks/tone.js";
//#region src/lib/components/CopyButton.svelte
function CopyButton($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* A copy button that reports what actually happened — if the write fails
		* (see writeClipboard for when that happens) it says so rather than showing
		* a tick and copying nothing.
		*/
		let { text, label = "", title = "Copy to clipboard", variant = "light" } = $$props;
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
//#region src/lib/components/checkpoint/RunnerFormModal.svelte
function RunnerFormModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { editRunner = null, onClose } = $$props;
		const MATCH_BY = [
			"nodeid",
			"annotation",
			"testName",
			"snapshotName",
			"tapName",
			"explicitMap"
		];
		const seed = run(() => editRunner);
		let name = seed?.name ?? "";
		let kind = seed?.kind ?? "api";
		let language = seed?.language ?? "python";
		let command = seed?.command ?? "";
		let workingDir = seed?.workingDir ?? "";
		let reportFormat = seed?.reportFormat ?? "junit-xml";
		let reportPath = seed?.reportPath ?? "";
		let matchBy = seed?.matchStrategy.by ?? "nodeid";
		let matchTag = seed && seed.matchStrategy.by === "annotation" ? seed.matchStrategy.tag : "@checkpoint";
		let timeoutSec = seed?.timeoutSec ? String(seed.timeoutSec) : "";
		let envText = seed?.env ? Object.entries(seed.env).map(([k, v]) => `${k}=${v}`).join("\n") : "";
		let enabled = seed?.enabled ?? true;
		let saving = false;
		$$renderer.push(`<div class="cp-backdrop" role="presentation"><div class="cp-modal wide" role="dialog" aria-modal="true"><div class="modal-head"><div class="mh-icon">`);
		Icon($$renderer, { name: "terminal" });
		$$renderer.push(`<!----></div> <div><h2>${escape_html(editRunner ? "Edit runner" : "New runner")}</h2> <div class="mh-sub">Define a command, working dir, report format and how results map back</div></div> <button class="x" aria-label="Close">`);
		Icon($$renderer, { name: "x" });
		$$renderer.push(`<!----></button></div> <form method="POST" action="/runners?/upsertRunner">`);
		if (editRunner) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<input type="hidden" name="id"${attr("value", editRunner.id)}/>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <input type="hidden" name="matchBy"${attr("value", matchBy)}/> <input type="hidden" name="enabled"${attr("value", enabled ? "true" : "false")}/> <div class="modal-body"><div class="field"><label for="rf-name">Name</label> <input id="rf-name" class="inp" name="name"${attr("value", name)} placeholder="API contract (pytest)"/></div> <div class="grid2"><div class="field"><label for="rf-kind">Kind</label> `);
		$$renderer.select({
			id: "rf-kind",
			class: "sel",
			name: "kind",
			value: kind
		}, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(TEST_KINDS);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let k = each_array[$$index];
				$$renderer.option({ value: k }, ($$renderer) => {
					$$renderer.push(`${escape_html(TEST_KIND_META[k].label)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</div> <div class="field"><label for="rf-lang">Language</label> `);
		$$renderer.select({
			id: "rf-lang",
			class: "sel",
			name: "language",
			value: language
		}, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(RUNNER_LANGUAGES);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let l = each_array_1[$$index_1];
				$$renderer.option({ value: l }, ($$renderer) => {
					$$renderer.push(`${escape_html(l)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</div></div> <div class="field"><label for="rf-cmd">Command</label> <input id="rf-cmd" class="inp" style="font-family:var(--font-mono)" name="command"${attr("value", command)} placeholder="pytest tests/api -q --junitxml=reports/api-junit.xml"/></div> <div class="grid2"><div class="field"><label for="rf-dir">Working dir</label> <input id="rf-dir" class="inp" style="font-family:var(--font-mono)" name="workingDir"${attr("value", workingDir)} placeholder="services/api"/></div> <div class="field"><label for="rf-timeout">Timeout (sec) <span class="hint">· optional</span></label> <input id="rf-timeout" class="inp" name="timeoutSec"${attr("value", timeoutSec)} placeholder="120" inputmode="numeric"/></div></div> <div class="grid2"><div class="field"><label for="rf-fmt">Report format</label> `);
		$$renderer.select({
			id: "rf-fmt",
			class: "sel",
			name: "reportFormat",
			value: reportFormat
		}, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array_2 = ensure_array_like(REPORT_FORMATS);
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let f = each_array_2[$$index_2];
				$$renderer.option({ value: f }, ($$renderer) => {
					$$renderer.push(`${escape_html(REPORT_FORMAT_LABEL[f])}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</div> <div class="field"><label for="rf-path">Report path</label> <input id="rf-path" class="inp" style="font-family:var(--font-mono)" name="reportPath"${attr("value", reportPath)} placeholder="reports/api-junit.xml or stdout"/></div></div> <div class="grid2"><div class="field"><label for="rf-match">Case matched by</label> `);
		$$renderer.select({
			id: "rf-match",
			class: "sel",
			value: matchBy
		}, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array_3 = ensure_array_like(MATCH_BY);
			for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
				let m = each_array_3[$$index_3];
				$$renderer.option({ value: m }, ($$renderer) => {
					$$renderer.push(`${escape_html(m)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</div> `);
		if (matchBy === "annotation") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="field"><label for="rf-tag">Annotation tag</label> <input id="rf-tag" class="inp" style="font-family:var(--font-mono)" name="matchTag"${attr("value", matchTag)} placeholder="@checkpoint"/></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="field"><label for="rf-env">Environment substitutions <span class="hint">· KEY=VALUE per line, optional</span></label> <textarea id="rf-env" class="inp" name="env" placeholder="BASE_URL=http://localhost:3000">`);
		const $$body = escape_html(envText);
		if ($$body) $$renderer.push(`${$$body}`);
		$$renderer.push(`</textarea></div> <button type="button" class="chk svelte-1rohwss" style="width:auto;display:inline-flex"><span${attr_class(`box ${enabled ? "on" : ""}`, "svelte-1rohwss")}${attr_style(`background:${enabled ? "var(--ws)" : "#fff"};border-color:${enabled ? "var(--ws)" : "#CBD3DE"}`)}>`);
		if (enabled) {
			$$renderer.push("<!--[0-->");
			Icon($$renderer, { name: "check-sm" });
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></span> <span class="cl">Enabled — participates in runs</span></button></div> <div class="modal-foot"><div class="ff">Runners are numbered globally — e.g. RNR-1.</div> <button type="button" class="btn btn-ghost">Cancel</button> <button type="submit" class="btn btn-primary"${attr("disabled", saving, true)}>`);
		Icon($$renderer, { name: "check" });
		$$renderer.push(`<!----> ${escape_html(editRunner ? "Save changes" : "Create runner")}</button></div></form></div></div>`);
	});
}
//#endregion
//#region src/routes/runners/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { data } = $$props;
		let showForm = false;
		let formRunner = null;
		const filterActive = derived(() => isActive(data.filter));
		/** Filters live in the URL so a narrowed grid is shareable and Back undoes it. */
		function setParam(key, value) {
			const params = new URLSearchParams(store_get($$store_subs ??= {}, "$page", page).url.searchParams);
			if (value) params.set(key, value);
			else params.delete(key);
			goto(`/runners?${params}`, {
				keepFocus: true,
				noScroll: true,
				replaceState: true
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
		if (showForm) {
			$$renderer.push("<!--[0-->");
			RunnerFormModal($$renderer, {
				editRunner: formRunner,
				onClose: () => showForm = false
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
