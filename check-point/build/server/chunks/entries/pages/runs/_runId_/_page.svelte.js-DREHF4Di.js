import { a0 as escape_html, a3 as attr_style, $ as stringify, Z as attr, a1 as ensure_array_like, X as attr_class, y as derived } from '../../../../chunks/server.js-CDtqtqwP.js';
import { E as ENV_LABEL, r as rateColor, a as RESULT_META, f as formatDuration } from '../../../../chunks/meta.js-Drcdnnre.js';
import '../../../../chunks/client.js-DlRkZ906.js';
import { I as Icon, K as KindBadge } from '../../../../chunks/KindBadge.js-DqDHG5dw.js';
import { P as ProgressBar } from '../../../../chunks/ProgressBar.js-C9cl1rnw.js';
import '../../../../chunks/internal.js-CuIsDgeO.js';
import '../../../../chunks/shared.js-C8TgK89F.js';
import '../../../../chunks/exports.js-Bq66Su2C.js';
import '../../../../chunks/utils.js-r4C_CEqs.js';

//#region src/routes/runs/[runId]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const run = derived(() => data.run);
		const issuedeskUrl = derived(() => data.issuedeskUrl);
		const issuedeskConfigured = derived(() => data.issuedeskConfigured);
		const TOGGLE = [
			"pass",
			"fail",
			"blocked",
			"skipped"
		];
		let completing = false;
		const isFail = (s) => s === "fail" || s === "blocked";
		function rowActions($$renderer, row) {
			if (isFail(row.status)) {
				$$renderer.push("<!--[0-->");
				if (row.issueId) {
					$$renderer.push("<!--[0-->");
					if (issuedeskUrl()) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<a class="issue-chip svelte-mm0jrk"${attr("href", `${stringify(issuedeskUrl())}/issues/${stringify(row.issueId)}`)}>${escape_html(row.issueId)}</a>`);
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<span class="issue-chip svelte-mm0jrk">${escape_html(row.issueId)}</span>`);
					}
					$$renderer.push(`<!--]-->`);
				} else if (issuedeskConfigured()) {
					$$renderer.push("<!--[1-->");
					$$renderer.push(`<button class="btn btn-ghost btn-xs svelte-mm0jrk">`);
					Icon($$renderer, { name: "bug" });
					$$renderer.push(`<!----> File bug</button>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <button class="btn btn-danger btn-xs svelte-mm0jrk">Markdown</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<div class="table-area svelte-mm0jrk"><div class="toolbar svelte-mm0jrk"><h1 class="svelte-mm0jrk">${escape_html(run().id)}</h1> <div class="toolbar-spacer svelte-mm0jrk"></div> `);
		if (data.failingCount) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="btn btn-danger svelte-mm0jrk">`);
			Icon($$renderer, { name: "markdown" });
			$$renderer.push(`<!----> Failures → Markdown</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <a class="btn btn-ghost svelte-mm0jrk" href="/runs">All runs</a></div> <div class="scroll svelte-mm0jrk"><div class="card svelte-mm0jrk" style="padding:15px 17px;margin-bottom:14px"><div class="run-top svelte-mm0jrk"><span class="run-id svelte-mm0jrk">${escape_html(run().id)}</span> <span class="run-suite svelte-mm0jrk">${escape_html(run().suiteName)}</span> <span class="env-chip svelte-mm0jrk">${escape_html(ENV_LABEL[run().environment])}</span> <span class="run-meta svelte-mm0jrk">${escape_html(run().by)} · ${escape_html(run().when)}${escape_html(run().state === "running" ? " · running" : run().state === "awaiting-manual" ? " · awaiting manual results" : run().state === "interrupted" ? " · interrupted" : "")}</span> `);
		if (run().state === "running") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="live-dot svelte-mm0jrk" title="Runners are executing"></span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		ProgressBar($$renderer, { counts: run().counts });
		$$renderer.push(`<!----> <div class="run-counts svelte-mm0jrk"><span class="rc svelte-mm0jrk"><span class="res-dot rd-pass svelte-mm0jrk"></span> ${escape_html(run().counts.pass)} pass</span> <span class="rc svelte-mm0jrk"><span class="res-dot rd-fail svelte-mm0jrk"></span> ${escape_html(run().counts.fail)} fail</span> `);
		if (run().counts.blocked) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="rc svelte-mm0jrk"><span class="res-dot rd-blocked svelte-mm0jrk"></span> ${escape_html(run().counts.blocked)} blocked</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (run().counts.skipped) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="rc svelte-mm0jrk"><span class="res-dot rd-skipped svelte-mm0jrk"></span> ${escape_html(run().counts.skipped)} skipped</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <span class="passrate svelte-mm0jrk"${attr_style(`color:${stringify(rateColor(run().passRate))}`)}>${escape_html(run().passRate === null ? "—" : `${run().passRate}% pass`)}</span></div></div> `);
		if (run().state === "interrupted") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="launch-panel svelte-mm0jrk" style="margin-bottom:14px"><div class="svelte-mm0jrk"><div class="lp-t svelte-mm0jrk">This run was interrupted</div> <div class="lp-d svelte-mm0jrk">The server restarted while runners were executing, so no dispatch is in flight. The
						results below are what completed; close the run to record it as history, or launch it again.</div></div> <div class="lp-sp svelte-mm0jrk"></div> <button class="btn btn-primary btn-sm svelte-mm0jrk"${attr("disabled", completing, true)}>`);
			Icon($$renderer, { name: "check" });
			$$renderer.push(`<!----> Close run</button></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (data.failingCount) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="launch-panel svelte-mm0jrk" style="margin-bottom:14px"><div class="svelte-mm0jrk"><div class="lp-t svelte-mm0jrk">${escape_html(data.failingCount)} failure${escape_html(data.failingCount === 1 ? "" : "s")} in this run</div> <div class="lp-d svelte-mm0jrk">Export them as one Markdown prompt — spec paths, commands, expected vs actual.</div></div> <div class="lp-sp svelte-mm0jrk"></div> <button class="btn btn-primary btn-sm svelte-mm0jrk">`);
			Icon($$renderer, { name: "code" });
			$$renderer.push(`<!----> Failures → Claude Code</button></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <!--[-->`);
		const each_array = ensure_array_like(data.groups);
		for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
			let g = each_array[$$index_2];
			$$renderer.push(`<div class="rgroup svelte-mm0jrk"><div class="rg-hd svelte-mm0jrk">`);
			KindBadge($$renderer, {
				kind: g.kind,
				small: true
			});
			$$renderer.push(`<!----> <span class="rg-n svelte-mm0jrk">${escape_html(g.name)}</span> <span style="font-size:12px;color:var(--muted)" class="svelte-mm0jrk">${escape_html(g.pass)}/${escape_html(g.fail + g.pass)} pass</span> `);
			if (g.reportFormat) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="rg-fmt svelte-mm0jrk">${escape_html(g.reportFormat)}</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="rg-cmd svelte-mm0jrk"><span style="color:var(--term-muted)" class="svelte-mm0jrk">$</span>${escape_html(g.command)}</div> <!--[-->`);
			const each_array_1 = ensure_array_like(g.rows);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let row = each_array_1[$$index_1];
				$$renderer.push(`<div class="exec-row svelte-mm0jrk">`);
				if (row.status === "pass") {
					$$renderer.push("<!--[0-->");
					Icon($$renderer, {
						name: "check",
						class: "tick-ok"
					});
				} else if (isFail(row.status)) {
					$$renderer.push("<!--[1-->");
					Icon($$renderer, {
						name: "x",
						class: "tick-fail"
					});
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<span${attr_class(`res-dot ${stringify(RESULT_META[row.status].cls)}`, "svelte-mm0jrk")}></span>`);
				}
				$$renderer.push(`<!--]--> <div class="xr-b svelte-mm0jrk"><div class="xr-t svelte-mm0jrk">${escape_html(row.title)}</div> <div class="xr-m svelte-mm0jrk">${escape_html(row.testCaseId)} · ${escape_html(row.specPath ?? "no spec")}</div></div> <span class="xr-dur svelte-mm0jrk">${escape_html(formatDuration(row.durationMs))}</span> `);
				rowActions($$renderer, row);
				$$renderer.push(`<!----></div> `);
				if (isFail(row.status) && (row.stack || row.message)) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="err-box svelte-mm0jrk">${escape_html(row.stack || row.message)}</div> `);
					if (row.artifacts.length) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="tagrow svelte-mm0jrk" style="margin:0 15px 11px"><!--[-->`);
						const each_array_2 = ensure_array_like(row.artifacts);
						for (let $$index = 0, $$length = each_array_2.length; $$index < $$length; $$index++) {
							let a = each_array_2[$$index];
							$$renderer.push(`<span class="artifact svelte-mm0jrk">`);
							Icon($$renderer, { name: "paperclip" });
							$$renderer.push(`<!----> ${escape_html(a)}</span>`);
						}
						$$renderer.push(`<!--]--></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--> `);
		if (data.manualRows.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="rgroup svelte-mm0jrk"><div class="rg-hd svelte-mm0jrk">`);
			KindBadge($$renderer, {
				kind: "manual",
				small: true
			});
			$$renderer.push(`<!----> <span class="rg-n svelte-mm0jrk">Manual execution</span> <span style="font-size:12px;color:var(--muted)" class="svelte-mm0jrk">mark each case</span></div> <!--[-->`);
			const each_array_3 = ensure_array_like(data.manualRows);
			for (let $$index_4 = 0, $$length = each_array_3.length; $$index_4 < $$length; $$index_4++) {
				let row = each_array_3[$$index_4];
				$$renderer.push(`<div class="exec-row svelte-mm0jrk">`);
				if (row.pending) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="res-dot rd-none svelte-mm0jrk"></span>`);
				} else if (row.status === "pass") {
					$$renderer.push("<!--[1-->");
					Icon($$renderer, {
						name: "check",
						class: "tick-ok"
					});
				} else if (isFail(row.status)) {
					$$renderer.push("<!--[2-->");
					Icon($$renderer, {
						name: "x",
						class: "tick-fail"
					});
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<span${attr_class(`res-dot ${stringify(RESULT_META[row.status].cls)}`, "svelte-mm0jrk")}></span>`);
				}
				$$renderer.push(`<!--]--> <div class="xr-b svelte-mm0jrk"><div class="xr-t svelte-mm0jrk">${escape_html(row.title)}</div> <div class="xr-m svelte-mm0jrk">${escape_html(row.testCaseId)} · manual execution</div></div> <div class="res-toggle svelte-mm0jrk"><!--[-->`);
				const each_array_4 = ensure_array_like(TOGGLE);
				for (let $$index_3 = 0, $$length = each_array_4.length; $$index_3 < $$length; $$index_3++) {
					let s = each_array_4[$$index_3];
					$$renderer.push(`<button${attr_class("svelte-mm0jrk", void 0, {
						"on-pass": !row.pending && row.status === s && s === "pass",
						"on-fail": !row.pending && row.status === s && s === "fail",
						"on-blocked": !row.pending && row.status === s && s === "blocked",
						"on-skipped": !row.pending && row.status === s && s === "skipped"
					})}>${escape_html(s)}</button>`);
				}
				$$renderer.push(`<!--]--></div> `);
				rowActions($$renderer, row);
				$$renderer.push(`<!----></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (!data.groups.length && !data.manualRows.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="empty svelte-mm0jrk"><div class="empty-in svelte-mm0jrk"><div class="ei svelte-mm0jrk">`);
			Icon($$renderer, { name: "play" });
			$$renderer.push(`<!----></div><h3 class="svelte-mm0jrk">No results recorded</h3><p class="svelte-mm0jrk">This run has no participating cases.</p></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div>`);
	});
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-DREHF4Di.js.map
