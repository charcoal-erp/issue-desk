import "../../../chunks/internal.js";
import { C as attr, T as escape_html, c as stringify, i as ensure_array_like, lt as run, r as derived, t as attr_class } from "../../../chunks/server.js";
import { o as TEST_CASE_STATUSES, s as TEST_KINDS } from "../../../chunks/types.js";
import { n as PRIORITY_ORDER, t as PRIORITY_META } from "../../../chunks/priority.js";
import { a as TEST_KIND_META, i as RESULT_META, o as formatDuration, r as REPORT_FORMAT_LABEL, s as matchStrategyLabel, t as CASE_STATUS_META } from "../../../chunks/meta.js";
import { t as goto } from "../../../chunks/client.js";
import { t as page } from "../../../chunks/state.js";
import "../../../chunks/toasts.svelte.js";
import { n as Icon, t as KindBadge } from "../../../chunks/KindBadge.js";
import "../../../chunks/checkpoint-ui.svelte.js";
import { t as ResultDot } from "../../../chunks/ResultDot.js";
import "../../../chunks/forms.js";
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
		let { drawer, onClose, onEdit } = $$props;
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
//#region src/lib/components/checkpoint/CaseFormModal.svelte
function CaseFormModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { applications, runners, suites, issues, editCase = null, nextId, onClose } = $$props;
		const KIND_ICON = {
			unit: "flask",
			api: "code",
			e2e: "monitor",
			visual: "eye",
			shell: "terminal",
			manual: "task"
		};
		const seed = run(() => editCase);
		let appId = seed?.appId ?? run(() => applications[0]?.id) ?? "";
		let moduleId = seed?.target.moduleId ?? "";
		let pageName = seed?.target.pageName ?? "";
		let formArea = seed?.target.formName ?? "";
		let title = seed?.title ?? "";
		let priority = seed?.priority ?? "medium";
		let parentIssueId = seed?.parentIssueId ?? "";
		let kind = seed?.kind ?? "manual";
		let runnerId = seed?.runnerId ?? "";
		let specPath = seed?.specPath ?? "";
		let externalTestId = seed?.externalTestId ?? "";
		let preconditions = seed?.preconditions ?? "";
		let steps = seed?.steps.length ? seed.steps.map((s) => ({ ...s })) : [{
			action: "",
			expected: ""
		}];
		let suiteIds = seed ? [...seed.suiteIds] : [];
		let saving = false;
		let errors = {};
		const app = derived(() => applications.find((a) => a.id === appId));
		const modules = derived(() => app()?.modules ?? []);
		const appIssues = derived(() => issues.filter((i) => i.appId === appId));
		const appSuites = derived(() => suites.filter((s) => s.appId === appId));
		const kindRunners = derived(() => runners.filter((r) => r.kind === kind));
		const runner = derived(() => runners.find((r) => r.id === runnerId));
		const isManual = derived(() => kind === "manual");
		const cleanSteps = derived(() => steps.filter((s) => s.action.trim() || s.expected.trim()));
		const runnerHint = derived(() => runner() ? `Runs \`${runner().command}\` in \`${runner().workingDir || "."}\`, reads \`${runner().reportPath}\` (${REPORT_FORMAT_LABEL[runner().reportFormat]}), matched by ${matchStrategyLabel(runner().matchStrategy)}.` : "Select a runner to see what will run.");
		$$renderer.push(`<div class="cp-backdrop" role="presentation"><div class="cp-modal wide" role="dialog" aria-modal="true"><div class="modal-head"><div class="mh-icon">`);
		Icon($$renderer, { name: "task" });
		$$renderer.push(`<!----></div> <div><h2>${escape_html(editCase ? "Edit test case" : "New test case")}</h2> <div class="mh-sub">${escape_html(editCase ? `${editCase.id} — ${editCase.appName}` : "Define what is tested, how it runs, and the issue it belongs to")}</div></div> <button class="x" aria-label="Close">`);
		Icon($$renderer, { name: "x" });
		$$renderer.push(`<!----></button></div> <form method="POST" action="/cases?/upsertCase">`);
		if (editCase) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<input type="hidden" name="id"${attr("value", editCase.id)}/>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <input type="hidden" name="kind"${attr("value", kind)}/> <input type="hidden" name="status"${attr("value", editCase?.status ?? "active")}/> <input type="hidden" name="tags"${attr("value", editCase?.tags.join(",") ?? "")}/> <input type="hidden" name="steps"${attr("value", JSON.stringify(cleanSteps()))}/> <input type="hidden" name="suiteIds"${attr("value", JSON.stringify(suiteIds))}/> <div class="modal-body"><div class="field"><label for="cf-title">Title <span class="hint">· what must hold true</span></label> <input id="cf-title" class="inp" name="title"${attr("value", title)} placeholder="Tax computed on the discounted subtotal"/> `);
		if (errors.title) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="hint" style="color:var(--fail)">${escape_html(errors.title)}</div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="grid2"><div class="field"><label for="cf-app">Application</label> `);
		$$renderer.select({
			id: "cf-app",
			class: "sel",
			name: "appId",
			value: appId
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
		$$renderer.push(`</div> <div class="field"><label for="cf-prio">Priority</label> `);
		$$renderer.select({
			id: "cf-prio",
			class: "sel",
			name: "priority",
			value: priority
		}, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(PRIORITY_ORDER);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let p = each_array_1[$$index_1];
				$$renderer.option({ value: p }, ($$renderer) => {
					$$renderer.push(`${escape_html(PRIORITY_META[p].label)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</div></div> <div class="grid3"><div class="field"><label for="cf-mod">Module</label> `);
		$$renderer.select({
			id: "cf-mod",
			class: "sel",
			name: "moduleId",
			value: moduleId
		}, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array_2 = ensure_array_like(modules());
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let m = each_array_2[$$index_2];
				$$renderer.option({ value: m.id }, ($$renderer) => {
					$$renderer.push(`${escape_html(m.name)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(` `);
		if (errors.moduleId) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="hint" style="color:var(--fail)">${escape_html(errors.moduleId)}</div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="field"><label for="cf-page">Page</label> <input id="cf-page" class="inp" name="page"${attr("value", pageName)} placeholder="Invoice"/></div> <div class="field"><label for="cf-form">Form / area</label> <input id="cf-form" class="inp" name="form"${attr("value", formArea)} placeholder="Line items"/></div></div> <div class="field"><label for="cf-parent">Parent issue <span class="hint">· the bug or request this test verifies — leave empty for general regression cases</span></label> `);
		$$renderer.select({
			id: "cf-parent",
			class: "sel",
			name: "parentIssueId",
			value: parentIssueId
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`— none —`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array_3 = ensure_array_like(appIssues());
			for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
				let i = each_array_3[$$index_3];
				$$renderer.option({ value: i.id }, ($$renderer) => {
					$$renderer.push(`${escape_html(i.id)} — ${escape_html(i.title)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</div> <div class="field"><label>Test type</label> <div class="seg"><!--[-->`);
		const each_array_4 = ensure_array_like(TEST_KINDS);
		for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
			let kk = each_array_4[$$index_4];
			$$renderer.push(`<button type="button"${attr_class("", void 0, { "on": kind === kk })}>`);
			Icon($$renderer, { name: KIND_ICON[kk] });
			$$renderer.push(`<!----> ${escape_html(TEST_KIND_META[kk].label)}</button>`);
		}
		$$renderer.push(`<!--]--></div></div> `);
		if (isManual()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="manual-note">Manual case — it will appear as a checklist item in any run that includes it. A tester
						marks pass / fail / blocked and can file a bug straight from the failure.</div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="auto-fields"><div class="field"><label for="cf-runner">Runner <span class="hint">· defines the command and how results are read back</span></label> `);
			$$renderer.select({
				id: "cf-runner",
				class: "sel",
				name: "runnerId",
				value: runnerId
			}, ($$renderer) => {
				if (!kindRunners().length) {
					$$renderer.push("<!--[0-->");
					$$renderer.option({ value: "" }, ($$renderer) => {
						$$renderer.push(`No ${escape_html(TEST_KIND_META[kind].label)} runner defined yet`);
					});
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--><!--[-->`);
				const each_array_5 = ensure_array_like(kindRunners());
				for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
					let r = each_array_5[$$index_5];
					$$renderer.option({ value: r.id }, ($$renderer) => {
						$$renderer.push(`${escape_html(r.name)} — ${escape_html(REPORT_FORMAT_LABEL[r.reportFormat])}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			});
			$$renderer.push(`</div> <div class="grid2"><div class="field"><label for="cf-spec">Spec file</label> <input id="cf-spec" class="inp" style="font-family:var(--font-mono)" name="specPath"${attr("value", specPath)} placeholder="tests/api/billing/test_tax.py"/></div> <div class="field"><label for="cf-tid">Test identifier <span class="hint">· how the report names it</span></label> <input id="cf-tid" class="inp" style="font-family:var(--font-mono)" name="externalTestId"${attr("value", externalTestId)} placeholder="test_tax.py::test_discounted"/></div></div> <div class="hint" style="line-height:1.5">${escape_html(runnerHint())}</div></div>`);
		}
		$$renderer.push(`<!--]--> <div class="field"><label for="cf-pre">Preconditions</label> <textarea id="cf-pre" class="inp" name="preconditions" placeholder="An invoice exists with a discounted line item.">`);
		const $$body = escape_html(preconditions);
		if ($$body) $$renderer.push(`${$$body}`);
		$$renderer.push(`</textarea></div> <div class="field"><label>Steps <span class="hint">· action and the expected result</span></label> <!--[-->`);
		const each_array_6 = ensure_array_like(steps);
		for (let i = 0, $$length = each_array_6.length; i < $$length; i++) {
			let step = each_array_6[i];
			$$renderer.push(`<div class="step-edit"><span class="se-n">${escape_html(i + 1)}</span> <input class="inp" placeholder="Action"${attr("value", step.action)}/> <input class="inp" placeholder="Expected result"${attr("value", step.expected)}/> <button type="button" class="mini-btn danger" aria-label="Remove step">`);
			Icon($$renderer, { name: "trash" });
			$$renderer.push(`<!----></button></div>`);
		}
		$$renderer.push(`<!--]--> <button type="button" class="btn btn-ghost btn-sm">`);
		Icon($$renderer, { name: "plus" });
		$$renderer.push(`<!----> Add step</button></div> `);
		if (appSuites().length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="field"><label>Add to suites</label> <div class="tagrow"><!--[-->`);
			const each_array_7 = ensure_array_like(appSuites());
			for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
				let s = each_array_7[$$index_7];
				$$renderer.push(`<button type="button"${attr_class("scope-chip", void 0, { "on": suiteIds.includes(s.id) })}>${escape_html(s.name)}</button>`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (errors.form) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="hint" style="color:var(--fail)">${escape_html(errors.form)}</div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="modal-foot"><div class="ff">`);
		if (!editCase) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`Numbering follows the app — e.g. the next ${escape_html(app()?.name ?? "")} case is ${escape_html(nextId[appId] ?? "—")}.`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <button type="button" class="btn btn-ghost">Cancel</button> <button type="submit" class="btn btn-primary"${attr("disabled", saving, true)}>`);
		Icon($$renderer, { name: "check" });
		$$renderer.push(`<!----> ${escape_html(editCase ? "Save changes" : "Create case")}</button></div></form></div></div>`);
	});
}
//#endregion
//#region src/lib/components/checkpoint/CaseImportModal.svelte
function CaseImportModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { filterQuery = "", onClose } = $$props;
		let content = "";
		const exportBase = derived(() => `/api/export/cases?${filterQuery ? filterQuery + "&" : ""}format=`);
		$$renderer.push(`<div class="cp-backdrop" role="presentation"><div class="cp-modal" role="dialog" aria-modal="true"><div class="modal-head"><div class="mh-icon">`);
		Icon($$renderer, { name: "upload" });
		$$renderer.push(`<!----></div> <div><h2>Import &amp; export cases</h2> <div class="mh-sub">Paste JSON or CSV to add cases; download the current view for review</div></div> <button class="x" aria-label="Close">`);
		Icon($$renderer, { name: "x" });
		$$renderer.push(`<!----></button></div> <div class="modal-body"><div class="field"><label>Import</label> <div class="exp-toggle"><button${attr_class("", void 0, { "on": true })}>JSON</button> <button${attr_class("", void 0, { "on": false })}>CSV</button></div> <textarea class="inp" style="min-height:130px;font-family:var(--font-mono);font-size:12px"${attr("placeholder", "[ { \"appId\": \"charcoal\", \"moduleId\": \"accounting\", \"title\": \"…\", \"kind\": \"manual\" } ]")}>`);
		const $$body = escape_html(content);
		if ($$body) $$renderer.push(`${$$body}`);
		$$renderer.push(`</textarea> <div class="hint" style="margin-top:4px">Rows missing an application, module or title are skipped. New ids are allocated per app.</div></div> <div class="field"><label>Export the current filter</label> <div class="tagrow"><a class="btn btn-ghost btn-sm"${attr("href", `${exportBase()}json`)} download="">`);
		Icon($$renderer, { name: "json" });
		$$renderer.push(`<!----> JSON</a> <a class="btn btn-ghost btn-sm"${attr("href", `${exportBase()}csv`)} download="">`);
		Icon($$renderer, { name: "download" });
		$$renderer.push(`<!----> CSV</a> <a class="btn btn-ghost btn-sm"${attr("href", `${exportBase()}md`)} download="">`);
		Icon($$renderer, { name: "markdown" });
		$$renderer.push(`<!----> Markdown</a></div></div></div> <div class="modal-foot"><div class="ff">Discovery from a runner report is planned; JSON / CSV import is available now.</div> <button class="btn btn-ghost">Cancel</button> <button class="btn btn-primary"${attr("disabled", !content.trim(), true)}>`);
		Icon($$renderer, { name: "upload" });
		$$renderer.push(`<!----> Import</button></div></div></div>`);
	});
}
//#endregion
//#region src/routes/cases/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		let showForm = false;
		let formCase = null;
		let showImport = false;
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
		function params() {
			return new URLSearchParams(page.url.search);
		}
		function closeDrawer() {
			const p = params();
			p.delete("case");
			goto(`/cases?${p}`, { noScroll: true });
		}
		function editCase(c) {
			closeDrawer();
			formCase = c;
			showForm = true;
		}
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
				drawer: data.drawer,
				onClose: closeDrawer,
				onEdit: editCase
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (showForm) {
			$$renderer.push("<!--[0-->");
			CaseFormModal($$renderer, {
				applications: data.applications,
				runners: data.runners,
				suites: data.suites,
				issues: data.issues,
				editCase: formCase,
				nextId: data.nextCaseIds,
				onClose: () => showForm = false
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (showImport) {
			$$renderer.push("<!--[0-->");
			CaseImportModal($$renderer, {
				filterQuery: page.url.search.slice(1),
				onClose: () => showImport = false
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { _page as default };
