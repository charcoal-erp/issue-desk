import '../../../chunks/internal.js-CuIsDgeO.js';
import { a1 as ensure_array_like, X as attr_class, a0 as escape_html, $ as stringify, Z as attr, y as derived } from '../../../chunks/server.js-CDtqtqwP.js';
import { T as TEST_KINDS, b as TEST_CASE_STATUSES } from '../../../chunks/types.js-BxhiHiuh.js';
import { P as PRIORITY_META } from '../../../chunks/priority.js-BTgJFiQJ.js';
import { T as TEST_KIND_META, C as CASE_STATUS_META, a as RESULT_META, f as formatDuration, R as REPORT_FORMAT_LABEL, m as matchStrategyLabel } from '../../../chunks/meta.js-Drcdnnre.js';
import '../../../chunks/client.js-DlRkZ906.js';
import { p as page } from '../../../chunks/state.js-BlYCQXBb.js';
import { I as Icon, K as KindBadge } from '../../../chunks/KindBadge.js-DqDHG5dw.js';
import { R as ResultDot } from '../../../chunks/ResultDot.js-D80U_RhS.js';
import '../../../chunks/shared.js-C8TgK89F.js';
import '../../../chunks/exports.js-Bq66Su2C.js';
import '../../../chunks/utils.js-r4C_CEqs.js';

//#region src/lib/components/checkpoint/PipMeter.svelte
function PipMeter($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { priority, showLabel = true } = $$props;
		const CLS = {
			critical: "crit",
			very_high: "veryHigh",
			high: "high",
			medium: "med",
			low: "low"
		};
		const filled = derived(() => PRIORITY_META[priority].pips);
		$$renderer.push(`<span${attr_class(`pip ${stringify(CLS[priority])}`)}><span class="pips"><!--[-->`);
		const each_array = ensure_array_like(Array(5));
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			each_array[i];
			$$renderer.push(`<span${attr_class("pip-b", void 0, { "on": i < filled() })}></span>`);
		}
		$$renderer.push(`<!--]--></span> `);
		if (showLabel) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="plabel">${escape_html(PRIORITY_META[priority].label)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></span>`);
	});
}
//#endregion
//#region src/lib/components/checkpoint/CaseDrawer.svelte
function CaseDrawer($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const issuedeskUrl = derived(() => page.data.issuedeskUrl);
		const issueHref = (id) => issuedeskUrl() ? `${issuedeskUrl()}/issues/${id}` : null;
		let { drawer} = $$props;
		const c = derived(() => drawer.case);
		const failing = derived(() => drawer.last?.status === "fail" || drawer.last?.status === "blocked");
		$$renderer.push(`<div class="cp-drawer-backdrop" role="presentation"><div class="cp-drawer" role="dialog" aria-modal="true"><div class="dr-hd"><div class="dr-top"><span class="dr-tag">${escape_html(c().id)}</span> <span${attr_class(`cs-badge ${stringify(CASE_STATUS_META[c().status].cls)}`)}>${escape_html(CASE_STATUS_META[c().status].label)}</span> `);
		KindBadge($$renderer, { kind: c().kind });
		$$renderer.push(`<!----> <button class="x" aria-label="Close">`);
		Icon($$renderer, { name: "x" });
		$$renderer.push(`<!----></button></div> <h2>${escape_html(c().title)}</h2></div> <div class="dr-body">`);
		if (c().parentIssueId) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="xlink-note">`);
			Icon($$renderer, { name: "link" });
			$$renderer.push(`<!----> <div>Parent issue `);
			if (issueHref(c().parentIssueId)) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<a class="parent-chip"${attr("href", issueHref(c().parentIssueId))} style="margin:0 3px">${escape_html(c().parentIssueId)}</a>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<span class="parent-chip" style="margin:0 3px">${escape_html(c().parentIssueId)}</span>`);
			}
			$$renderer.push(`<!--]--> ${escape_html(drawer.parentTitle ? `— ${drawer.parentTitle}. ` : ". ")}This test exists to verify that issue; it is tracked in IssueDesk.</div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="dr-meta"><div class="row"><div class="rk">Application</div><div class="rv">${escape_html(c().appName)}</div></div> <div class="row"><div class="rk">Target</div> <div class="rv"><span class="tag">${escape_html(c().target.moduleName)}</span> `);
		if (c().target.pageName) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="tag">${escape_html(c().target.pageName)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (c().target.formName) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="tag">${escape_html(c().target.formName)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div> <div class="row"><div class="rk">Priority</div><div class="rv">`);
		PipMeter($$renderer, { priority: c().priority });
		$$renderer.push(`<!----></div></div> <div class="row"><div class="rk">Last result</div> <div class="rv">`);
		ResultDot($$renderer, { status: drawer.last?.status ?? "none" });
		$$renderer.push(`<!----> ${escape_html(drawer.last ? RESULT_META[drawer.last.status].label : "Not run")} `);
		if (drawer.last?.durationMs != null) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span style="color:var(--muted)">· ${escape_html(formatDuration(drawer.last.durationMs))}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div> <div class="row"><div class="rk">In suites</div> <div class="rv">`);
		if (drawer.suites.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(drawer.suites);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let s = each_array[$$index];
				$$renderer.push(`<span class="tag">${escape_html(s.name)}</span>`);
			}
			$$renderer.push(`<!--]-->`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<span style="color:var(--faint)">none</span>`);
		}
		$$renderer.push(`<!--]--></div></div> `);
		if (drawer.filedIssues.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="row"><div class="rk">Filed bugs</div> <div class="rv"><!--[-->`);
			const each_array_1 = ensure_array_like(drawer.filedIssues);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let id = each_array_1[$$index_1];
				if (issueHref(id)) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<a class="issue-chip"${attr("href", issueHref(id))}>${escape_html(id)}</a>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<span class="issue-chip">${escape_html(id)}</span>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		if (failing() && drawer.last) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="dr-sec-t">Last failure</div> <div class="err-box" style="margin:0 0 12px">${escape_html(drawer.last.stack || drawer.last.message || "No output captured.")}</div> `);
			if (drawer.last.artifacts.length) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="tagrow" style="margin-bottom:20px"><!--[-->`);
				const each_array_2 = ensure_array_like(drawer.last.artifacts);
				for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
					let a = each_array_2[$$index_2];
					$$renderer.push(`<span class="artifact">`);
					Icon($$renderer, { name: "paperclip" });
					$$renderer.push(`<!----> ${escape_html(a)}</span>`);
				}
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]-->`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="dr-sec-t">Execution</div> `);
		if (drawer.runner && c().kind !== "manual") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="dr-meta"><div class="row"><div class="rk">Runner</div><div class="rv">${escape_html(drawer.runner.name)} <span style="color:var(--muted)">(${escape_html(drawer.runner.language)})</span></div></div> <div class="row"><div class="rk">Command</div><div class="rv" style="font-family:var(--font-mono);font-size:11.5px">${escape_html(drawer.runner.command)}</div></div> `);
			if (c().specPath) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="row"><div class="rk">Spec file</div><div class="rv" style="font-family:var(--font-mono);font-size:11.5px">${escape_html(c().specPath)}</div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (c().externalTestId) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="row"><div class="rk">Test id</div><div class="rv" style="font-family:var(--font-mono);font-size:11.5px">${escape_html(c().externalTestId)}</div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="row"><div class="rk">Reports as</div><div class="rv"><span class="tag">${escape_html(REPORT_FORMAT_LABEL[drawer.runner.reportFormat])}</span> → matched by ${escape_html(matchStrategyLabel(drawer.runner.matchStrategy))}</div></div></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="manual-note">Manual case — a person executes the steps in a run and marks the result. No command, no report file.</div>`);
		}
		$$renderer.push(`<!--]--> `);
		if (c().preconditions) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="dr-sec-t">Preconditions</div> <div class="pre-box">${escape_html(c().preconditions)}</div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (c().steps.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="dr-sec-t">Steps</div> <table class="steps-tbl"><thead><tr><th class="stepn">#</th><th>Action</th><th>Expected</th></tr></thead><tbody><!--[-->`);
			const each_array_3 = ensure_array_like(c().steps);
			for (let i = 0, $$length = each_array_3.length; i < $$length; i++) {
				let s = each_array_3[i];
				$$renderer.push(`<tr><td class="stepn">${escape_html(i + 1)}</td><td>${escape_html(s.action)}</td><td class="exp">${escape_html(s.expected)}</td></tr>`);
			}
			$$renderer.push(`<!--]--></tbody></table>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="dr-foot"><button class="btn btn-ghost">`);
		Icon($$renderer, { name: "edit" });
		$$renderer.push(`<!----> Edit</button> `);
		if (c().kind !== "manual") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="btn btn-ghost">`);
			Icon($$renderer, { name: "play" });
			$$renderer.push(`<!----> Run this test</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (failing()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="btn btn-danger" style="margin-left:auto">`);
			Icon($$renderer, { name: "markdown" });
			$$renderer.push(`<!----> Failure → Markdown</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div></div>`);
	});
}
//#endregion
//#region src/routes/cases/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const RESULT_FILTERS = [
			{
				key: "pass",
				label: "Passing"
			},
			{
				key: "fail",
				label: "Failing"
			},
			{
				key: "blocked",
				label: "Blocked"
			},
			{
				key: "skipped",
				label: "Skipped"
			},
			{
				key: "none",
				label: "Not run"
			}
		];
		const kindActive = (k) => data.filter.kind?.includes(k) ?? false;
		const statusActive = (s) => data.filter.status?.includes(s) ?? false;
		const resultActive = (r) => data.filter.lastResult?.includes(r) ?? false;
		$$renderer.push(`<section class="table-area" style="flex-direction:row;display:flex"><div class="filters"><div class="f-block"><div class="f-title">Application <button class="clear">Reset</button></div> <!--[-->`);
		const each_array = ensure_array_like(data.applications);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let a = each_array[$$index];
			$$renderer.push(`<button${attr_class("chk", void 0, { "on": data.filter.appId === a.id })}><span class="box">`);
			Icon($$renderer, { name: "check-sm" });
			$$renderer.push(`<!----></span> <span class="cl">${escape_html(a.name)}</span> <span class="cn">${escape_html(data.counts.byApp[a.id] ?? 0)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="f-block"><div class="f-title">Test type</div> <!--[-->`);
		const each_array_1 = ensure_array_like(TEST_KINDS);
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let k = each_array_1[$$index_1];
			$$renderer.push(`<button${attr_class("chk", void 0, { "on": kindActive(k) })}><span class="box">`);
			Icon($$renderer, { name: "check-sm" });
			$$renderer.push(`<!----></span> <span class="cl">${escape_html(TEST_KIND_META[k].label)}</span> <span class="cn">${escape_html(data.counts.byKind[k] ?? 0)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="f-block"><div class="f-title">Status</div> <!--[-->`);
		const each_array_2 = ensure_array_like(TEST_CASE_STATUSES);
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let s = each_array_2[$$index_2];
			$$renderer.push(`<button${attr_class("chk", void 0, { "on": statusActive(s) })}><span class="box">`);
			Icon($$renderer, { name: "check-sm" });
			$$renderer.push(`<!----></span> <span class="cl">${escape_html(CASE_STATUS_META[s].label)}</span> <span class="cn">${escape_html(data.counts.byStatus[s] ?? 0)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="f-block"><div class="f-title">Last result</div> <!--[-->`);
		const each_array_3 = ensure_array_like(RESULT_FILTERS);
		for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
			let r = each_array_3[$$index_3];
			$$renderer.push(`<button${attr_class("chk", void 0, { "on": resultActive(r.key) })}><span class="box">`);
			Icon($$renderer, { name: "check-sm" });
			$$renderer.push(`<!----></span> <span${attr_class(`res-dot ${stringify(r.key === "none" ? "rd-none" : RESULT_META[r.key].cls)}`)} style="margin-right:2px"></span> <span class="cl">${escape_html(r.label)}</span> <span class="cn">${escape_html(data.counts.byResult[r.key] ?? 0)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="table-area"><div class="toolbar"><h1>Test Cases</h1> <span class="count">${escape_html(data.total)} of ${escape_html(data.counts.byApp ? Object.values(data.counts.byApp).reduce((a, b) => a + b, 0) : data.total)} cases</span> <div class="toolbar-spacer"></div> <button class="btn btn-ghost">`);
		Icon($$renderer, { name: "markdown" });
		$$renderer.push(`<!----> Failures → Markdown</button> <button class="btn btn-ghost">`);
		Icon($$renderer, { name: "upload" });
		$$renderer.push(`<!----> Import</button> <button class="btn btn-primary">`);
		Icon($$renderer, { name: "plus" });
		$$renderer.push(`<!----> New case</button></div> <div class="scroll">`);
		if (data.rows.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<table class="tbl"><thead><tr><th>ID</th><th>Title</th><th>Module</th><th>Type</th><th>Priority</th><th>Parent issue</th><th>Last result</th></tr></thead><tbody><!--[-->`);
			const each_array_4 = ensure_array_like(data.rows);
			for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
				let r = each_array_4[$$index_4];
				$$renderer.push(`<tr><td class="rid">${escape_html(r.id)}</td><td><div class="rtitle">${escape_html(r.title)}</div> <div class="rtarget">${escape_html(r.specPath ?? `${r.appCode.toLowerCase()} › ${r.moduleName.toLowerCase()}`)}</div></td><td><span class="tag">${escape_html(r.appCode)} · ${escape_html(r.moduleName)}</span></td><td>`);
				KindBadge($$renderer, { kind: r.kind });
				$$renderer.push(`<!----></td><td>`);
				PipMeter($$renderer, { priority: r.priority });
				$$renderer.push(`<!----></td><td>`);
				if (r.parentIssueId) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="parent-chip">${escape_html(r.parentIssueId)}</span>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<span style="color:var(--faint)">—</span>`);
				}
				$$renderer.push(`<!--]--></td><td><span style="display:inline-flex;align-items:center;gap:7px">`);
				ResultDot($$renderer, { status: r.lastResult });
				$$renderer.push(`<!----> ${escape_html(r.lastResult === "none" ? "Not run" : RESULT_META[r.lastResult].label)}</span></td></tr>`);
			}
			$$renderer.push(`<!--]--></tbody></table>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="empty"><div class="empty-in"><div class="ei">`);
			Icon($$renderer, { name: "task" });
			$$renderer.push(`<!----></div> <h3>No test cases yet</h3> <p>Author a case to define correct behaviour, then group cases into suites and run them.</p> <button class="btn btn-primary" style="margin-top:14px">`);
			Icon($$renderer, { name: "plus" });
			$$renderer.push(`<!----> New case</button></div></div>`);
		}
		$$renderer.push(`<!--]--></div></div></section> `);
		if (data.drawer) {
			$$renderer.push("<!--[0-->");
			CaseDrawer($$renderer, {
				drawer: data.drawer});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-CLTz1sv9.js.map
