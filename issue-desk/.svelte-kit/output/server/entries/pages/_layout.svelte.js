import { S as attr, a as ensure_array_like, c as stringify, i as derived, n as attr_style, o as head, r as bind_props, t as attr_class, u as html, w as escape_html } from "../../chunks/server.js";
import { i as STATUS_META, n as PRIORITIES, o as PRIORITY_META, r as STATUSES } from "../../chunks/types.js";
import { t as page } from "../../chunks/state.js";
import { i as Icon, r as toasts, t as Avatar } from "../../chunks/Avatar.js";
import { i as fmtWhen, n as fmtDateTime, r as fmtSize, t as fmtDate } from "../../chunks/format.js";
import "../../chunks/forms.js";
import { r as ui } from "../../chunks/ui.svelte.js";
import { t as PriorityMeter } from "../../chunks/PriorityMeter.js";
import "../../chunks/actions.js";
import { t as StatusBadge } from "../../chunks/StatusBadge.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
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
//#region src/lib/components/AttachmentDropzone.svelte
function AttachmentDropzone($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { attachments = void 0, appId, issueId, draftId } = $$props;
		let dragover = false;
		const pasteKey = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
		$$renderer.push(`<button type="button"${attr_class("dropzone", void 0, { "dragover": dragover })}>`);
		Icon($$renderer, { name: "upload" });
		$$renderer.push(`<!----> <div class="dz-t">${escape_html("Drop screenshots or PDFs here, or click to browse")}</div> <div class="dz-s">Paste a screenshot with <kbd>${escape_html(pasteKey)}</kbd><kbd>V</kbd> · files land in <span style="font-family:var(--font-mono)">/uploads/&lt;app>/&lt;id>/</span></div></button> <input type="file" multiple="" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" style="display:none"/> <div class="dz-list"><!--[-->`);
		const each_array = ensure_array_like(attachments);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let att = each_array[$$index];
			$$renderer.push(`<div class="dz-file">`);
			if (att.kind === "image") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button type="button" class="thumb thumb-shot"${attr("aria-label", `Preview ${stringify(att.filename)}`)}><img${attr("src", att.url)} alt="" loading="lazy"/></button>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<span class="thumb thumb-pdf">`);
				Icon($$renderer, { name: "file" });
				$$renderer.push(`<!----></span>`);
			}
			$$renderer.push(`<!--]--> <div class="fmeta"><div class="fn">${escape_html(att.filename)}</div> <div class="fs">${escape_html(fmtSize(att.size))} · ${escape_html(att.kind === "image" ? "Image" : "PDF")}</div></div> <button type="button" class="frm"${attr("aria-label", `Remove ${stringify(att.filename)}`)}>`);
			Icon($$renderer, { name: "x-sm" });
			$$renderer.push(`<!----></button></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
		bind_props($$props, { attachments });
	});
}
//#endregion
//#region src/lib/components/IssueModal.svelte
function IssueModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { mode, applications, users, currentUserId } = $$props;
		const editing = derived(() => mode.mode === "edit" ? mode.issue : null);
		let type = "bug";
		let appId = "";
		let moduleId = "";
		let pageText = "";
		let formText = "";
		let title = "";
		let description = "";
		let priority = "high";
		let status = "open";
		let assigneeId = "";
		let tags = "";
		let attachments = [];
		let fieldErrors = {};
		let saving = false;
		const draftId = crypto.randomUUID();
		const assignees = derived(() => users.filter((u) => u.assignable));
		const app = derived(() => applications.find((a) => a.id === appId));
		const nextIdPreview = derived(() => editing() ? editing().id : "—");
		function onAppChange() {
			moduleId = "";
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="backdrop" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title"><div class="modal-head"><div class="mh-icon">`);
			Icon($$renderer, { name: "task" });
			$$renderer.push(`<!----></div> <div><h2 id="issue-modal-title">${escape_html(editing() ? `Edit ${editing().id}` : "New issue")}</h2> <div class="mh-sub">${escape_html(editing() ? `${editing().appName} / ${editing().moduleName}` : "Capture a bug or feature request")}</div></div> <button class="x" aria-label="Close">`);
			Icon($$renderer, { name: "x" });
			$$renderer.push(`<!----></button></div> <form method="POST"${attr("action", editing() ? "/?/updateIssue" : "/?/createIssue")}>`);
			if (editing()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<input type="hidden" name="id"${attr("value", editing().id)}/>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <input type="hidden" name="type"${attr("value", type)}/> <input type="hidden" name="priority"${attr("value", priority)}/> <input type="hidden" name="status"${attr("value", status)}/> <input type="hidden" name="draftId"${attr("value", draftId)}/> <input type="hidden" name="attachments"${attr("value", JSON.stringify(attachments))}/> <div class="modal-body"><div class="form-grid"><div class="field full"><label for="f-type">Type</label> <div class="type-picker" id="f-type"><button type="button"${attr_class("type-opt", void 0, { "on": true })}>`);
			Icon($$renderer, { name: "bug" });
			$$renderer.push(`<!----> Bug</button> <button type="button"${attr_class("type-opt", void 0, { "on": false })}>`);
			Icon($$renderer, { name: "feature" });
			$$renderer.push(`<!----> Feature</button></div></div> <div class="field"><label for="f-app">Application <span class="req">*</span></label> `);
			$$renderer.select({
				class: "sel",
				id: "f-app",
				name: "appId",
				value: appId,
				onchange: onAppChange
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`Select application…`);
				});
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
			$$renderer.push(` `);
			if (fieldErrors.appId) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="err">${escape_html(fieldErrors.appId)}</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="field"><label for="f-module">Module <span class="req">*</span></label> `);
			$$renderer.select({
				class: "sel",
				id: "f-module",
				name: "moduleId",
				value: moduleId,
				disabled: !app()
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`Select module…`);
				});
				$$renderer.push(`<!--[-->`);
				const each_array_1 = ensure_array_like(app()?.modules ?? []);
				for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
					let m = each_array_1[$$index_1];
					$$renderer.option({ value: m.id }, ($$renderer) => {
						$$renderer.push(`${escape_html(m.name)}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			});
			$$renderer.push(` `);
			if (fieldErrors.moduleId) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="err">${escape_html(fieldErrors.moduleId)}</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="field"><label for="f-page">Page <span class="hint">· free text</span></label> <input class="inp" id="f-page" name="page"${attr("value", pageText)} placeholder="e.g. /login or Login screen"/></div> <div class="field"><label for="f-form">Form <span class="hint">· free text</span></label> <input class="inp" id="f-form" name="form"${attr("value", formText)} placeholder="e.g. OTP Verification"/></div> <div class="field full"><label for="f-title">Title <span class="req">*</span></label> <input class="inp" id="f-title" name="title"${attr("value", title)} placeholder="Short, specific summary — e.g. “Login fails with a valid OTP”"/> `);
			if (fieldErrors.title) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="err">${escape_html(fieldErrors.title)}</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="field full"><label for="f-desc">Description <span class="hint">· Markdown supported</span></label> <textarea class="ta" id="f-desc" name="description" placeholder="What happens, what you expected, and steps to reproduce…

1. Go to /login
2. Enter a valid OTP
3. …">`);
			const $$body = escape_html(description);
			if ($$body) $$renderer.push(`${$$body}`);
			$$renderer.push(`</textarea></div> <div class="field"><label for="f-prio">Priority <span class="req">*</span></label> <div class="prio-picker" id="f-prio"><!--[-->`);
			const each_array_2 = ensure_array_like(PRIORITIES);
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let p = each_array_2[$$index_2];
				$$renderer.push(`<button type="button"${attr_class("prio-opt", void 0, { "on": priority === p })}>`);
				PriorityMeter($$renderer, {
					priority: p,
					variant: "pm"
				});
				$$renderer.push(`<!----> <span class="pl">${escape_html(PRIORITY_META[p].label)}</span></button>`);
			}
			$$renderer.push(`<!--]--></div></div> <div class="field"><label for="f-status">Status</label> <div class="status-picker" id="f-status"><!--[-->`);
			const each_array_3 = ensure_array_like(STATUSES);
			for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
				let s = each_array_3[$$index_3];
				$$renderer.push(`<button type="button"${attr_class(`status-opt ${stringify(STATUS_META[s].pickerClass)}`, void 0, { "on": status === s })}><span class="dot"${attr_style(`background:${stringify(STATUS_META[s].color)}`)}></span> ${escape_html(STATUS_META[s].shortLabel)}</button>`);
			}
			$$renderer.push(`<!--]--></div></div> <div class="field"><label for="f-assignee">Assignee</label> `);
			$$renderer.select({
				class: "sel",
				id: "f-assignee",
				name: "assigneeId",
				value: assigneeId
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`Unassigned`);
				});
				$$renderer.push(`<!--[-->`);
				const each_array_4 = ensure_array_like(assignees());
				for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
					let u = each_array_4[$$index_4];
					$$renderer.option({ value: u.id }, ($$renderer) => {
						$$renderer.push(`${escape_html(u.name)}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			});
			$$renderer.push(`</div> <div class="field"><label for="f-tags">Tags <span class="hint">· comma-separated</span></label> <input class="inp" id="f-tags" name="tags"${attr("value", tags)} placeholder="auth, regression"/></div> <div class="field full"><label for="f-dz">Attachments <span class="hint">· PNG, JPG, WEBP, GIF, PDF · max 15 MB each</span></label> `);
			AttachmentDropzone($$renderer, {
				appId,
				issueId: editing() ? editing().id : "pending",
				draftId,
				get attachments() {
					return attachments;
				},
				set attachments($$value) {
					attachments = $$value;
					$$settled = false;
				}
			});
			$$renderer.push(`<!----></div></div></div> <div class="modal-foot"><div class="ff">A per-app ID is assigned on create — e.g. <span style="font-family:var(--font-mono);color:var(--muted)">${escape_html(nextIdPreview())}</span></div> <button type="button" class="btn btn-ghost">Cancel</button> <button type="submit" class="btn btn-primary"${attr("disabled", saving, true)}>${escape_html(editing() ? "Save changes" : "Create issue")}</button></div></form></div></div>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
//#endregion
//#region src/lib/components/IssueDetailDrawer.svelte
function IssueDetailDrawer($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { issue, users, applications } = $$props;
		const reporter = derived(() => users.find((u) => u.id === issue.reporterId));
		const assignee = derived(() => users.find((u) => u.id === issue.assigneeId));
		const appColor = derived(() => applications.find((a) => a.id === issue.appId)?.color);
		const descHtml = derived(() => DOMPurify.sanitize(marked.parse(issue.description, { async: false })));
		function userName(id) {
			return users.find((u) => u.id === id)?.name ?? id;
		}
		function esc(s) {
			return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
		function activityText(kind, from, to, by) {
			switch (kind) {
				case "status": return `Status moved to <b>${STATUS_META[to]?.label ?? to}</b>`;
				case "priority": return `Priority changed to <b>${PRIORITY_META[to]?.label ?? to}</b>`;
				case "assignee": return to ? `Assigned to <b>${esc(userName(to))}</b>` : "Unassigned";
				case "edit": return `<b>${esc(userName(by ?? ""))}</b> edited this issue`;
				case "attachment": return `Attachment <b>${esc(from ?? "")}</b> removed`;
				default: return `<b>${esc(userName(by ?? ""))}</b> updated this issue`;
			}
		}
		$$renderer.push(`<div class="drawer-backdrop" role="presentation"><div class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div class="dr-head"><div class="dr-top"><span class="dr-id">${escape_html(issue.id)}</span> <span${attr_class(`type-tag ${issue.type === "bug" ? "type-bug" : "type-feature"}`)}>${escape_html(issue.type)}</span> `);
		StatusBadge($$renderer, { status: issue.status });
		$$renderer.push(`<!----> <button class="x" aria-label="Close">`);
		Icon($$renderer, { name: "x" });
		$$renderer.push(`<!----></button></div> <h2 id="drawer-title">${escape_html(issue.title)}</h2></div> <div class="dr-body">`);
		if (issue.testCaseId) {
			$$renderer.push("<!--[0-->");
			if (page.data.checkpointUrl) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<a class="test-origin svelte-ml59x3"${attr("href", `${stringify(page.data.checkpointUrl)}/cases?case=${stringify(issue.testCaseId)}`)}>`);
				Icon($$renderer, { name: "task" });
				$$renderer.push(`<!----> <span>Filed from test <b class="svelte-ml59x3">${escape_html(issue.testCaseId)}</b>${escape_html(issue.runId ? ` · run ${issue.runId}` : "")} — open in Checkpoint</span></a>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<span class="test-origin static svelte-ml59x3">`);
				Icon($$renderer, { name: "task" });
				$$renderer.push(`<!----> <span>Filed from test <b class="svelte-ml59x3">${escape_html(issue.testCaseId)}</b>${escape_html(issue.runId ? ` · run ${issue.runId}` : "")}</span></span>`);
			}
			$$renderer.push(`<!--]-->`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="dr-quick"><button class="btn btn-ghost btn-sm">`);
		Icon($$renderer, { name: "edit" });
		$$renderer.push(`<!---->Edit</button> <button class="btn btn-ghost btn-sm">`);
		Icon($$renderer, { name: "refresh" });
		$$renderer.push(`<!---->Advance status</button> <button class="btn btn-primary btn-sm">`);
		Icon($$renderer, { name: "copy" });
		$$renderer.push(`<!---->Copy for Claude Code</button></div> <div class="dr-meta"><div class="row"><span class="rk">Application</span> <span class="rv"><span class="app-dot"${attr_style(`background:${stringify(appColor())}`)}></span>${escape_html(issue.appName)}</span></div> <div class="row"><span class="rk">Module</span><span class="rv">${escape_html(issue.moduleName)}</span></div> <div class="row"><span class="rk">Page / Form</span> <span class="rv"><span style="font-family:var(--font-mono);font-size:12px">${escape_html(issue.pagePath || "—")}</span>${escape_html(issue.formName ? " · " + issue.formName : "")}</span></div> <div class="row"><span class="rk">Priority</span> <span class="rv">`);
		PriorityMeter($$renderer, { priority: issue.priority });
		$$renderer.push(`<!----> ${escape_html(PRIORITY_META[issue.priority].label)}</span></div> <div class="row"><span class="rk">Reporter</span> <span class="rv">`);
		Avatar($$renderer, { user: reporter() });
		$$renderer.push(`<!----> ${escape_html(reporter()?.name ?? issue.reporterId)}</span></div> <div class="row"><span class="rk">Assignee</span> <span class="rv">`);
		if (assignee()) {
			$$renderer.push("<!--[0-->");
			Avatar($$renderer, { user: assignee() });
			$$renderer.push(`<!----> ${escape_html(assignee().name)}`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<span style="color:var(--faint)">Unassigned</span>`);
		}
		$$renderer.push(`<!--]--></span></div> <div class="row"><span class="rk">Reported</span> <span class="rv"${attr("title", fmtDateTime(issue.createdAt))}>${escape_html(fmtWhen(issue.createdAt))} <span style="color:var(--faint);font-size:12px">· ${escape_html(fmtDateTime(issue.createdAt))}</span></span></div> <div class="row"><span class="rk">Last modified</span> <span class="rv"${attr("title", fmtDateTime(issue.updatedAt))}>${escape_html(fmtWhen(issue.updatedAt))} <span style="color:var(--faint);font-size:12px">· ${escape_html(fmtDateTime(issue.updatedAt))}</span></span></div> <div class="row"><span class="rk">Tags</span> <span class="rv">`);
		const each_array = ensure_array_like(issue.tags);
		if (each_array.length !== 0) {
			$$renderer.push("<!--[-->");
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let tag = each_array[$$index];
				$$renderer.push(`<span class="mod-tag">${escape_html(tag)}</span>`);
			}
		} else {
			$$renderer.push("<!--[!-->");
			$$renderer.push(`<!---->—`);
		}
		$$renderer.push(`<!--]--></span></div></div> <div class="dr-sec-t">Description</div> <div class="dr-desc">${html(descHtml())}</div> `);
		if (issue.attachments.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="dr-sec-t">Attachments · public URLs</div> <div class="gallery"><!--[-->`);
			const each_array_1 = ensure_array_like(issue.attachments);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let att = each_array_1[$$index_1];
				if (att.kind === "image") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<button type="button" class="gal-item"><div class="gal-thumb img"><img${attr("src", att.url)}${attr("alt", att.filename)} loading="lazy"/></div> <div class="gal-name">${escape_html(att.filename)}</div></button>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<a class="gal-item"${attr("href", att.url)} target="_blank" rel="noopener"><div class="gal-thumb pdf">`);
					Icon($$renderer, { name: "file-lt" });
					$$renderer.push(`<!----></div> <div class="gal-name">${escape_html(att.filename)}</div></a>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="dr-sec-t">Activity</div> <div class="timeline"><!--[-->`);
		const each_array_2 = ensure_array_like(issue.activity);
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let entry = each_array_2[$$index_2];
			if (entry.kind === "created") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="tl-item"><div class="tl-txt"><b>${escape_html(userName(entry.by))}</b> created this issue</div> <div class="tl-time">${escape_html(fmtDate(entry.at))} · via IssueDesk</div></div>`);
			} else if (entry.kind === "comment") {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`<div class="tl-item muted"><div class="tl-txt"><b>${escape_html(userName(entry.by))}</b>: ${escape_html(entry.message)}</div> <div class="tl-time">${escape_html(fmtDate(entry.at))}</div></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="tl-item muted"><div class="tl-txt">${html(activityText(entry.kind, entry.from, entry.to, entry.by))}</div> <div class="tl-time">${escape_html(fmtDate(entry.at))}</div></div>`);
			}
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="dr-foot"><div style="flex:1"></div> <button class="btn btn-ghost btn-sm">Close</button></div></div></div>`);
	});
}
//#endregion
//#region src/lib/components/ExportPanel.svelte
function ExportPanel($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { applications: _applications } = $$props;
		let raw = "";
		let copied = false;
		const appSlug = derived(() => page.url.searchParams.get("appId") || "all");
		const filename = derived(() => `fix-batch-${appSlug()}.md`);
		function esc(s) {
			return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
		function highlightMd(t) {
			return esc(t).replace(/^(#.*)$/gm, "<span class=\"h\">$1</span>").replace(/^(---)$/gm, "<span class=\"c\">$1</span>").replace(/^(_.*_)$/gm, "<span class=\"c\">$1</span>").replace(/(\*\*[^*]+\*\*)/g, "<span class=\"k\">$1</span>").replace(/(https?:\/\/[^\s]+)/g, "<span class=\"s\">$1</span>");
		}
		const highlighted = derived(() => highlightMd(raw));
		$$renderer.push(`<div class="backdrop" role="presentation"><div class="modal export-modal" role="dialog" aria-modal="true" aria-label="Export"><div class="export-head"><div class="win-dots"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i></div> <div class="fname">`);
		Icon($$renderer, { name: "file" });
		$$renderer.push(`<!----><span>${escape_html(filename())}</span></div> <button class="x" aria-label="Close">`);
		Icon($$renderer, { name: "x" });
		$$renderer.push(`<!----></button></div> <div class="export-toolbar"><div class="export-seg"><button${attr_class("", void 0, { "on": true })}>`);
		Icon($$renderer, { name: "markdown" });
		$$renderer.push(`<!----> Markdown</button> <button${attr_class("", void 0, { "on": false })}>`);
		Icon($$renderer, { name: "json" });
		$$renderer.push(`<!----> JSON</button></div> <div class="export-info">${escape_html(ui.exportTotal)} ${escape_html(ui.exportTotal === 1 ? "issue" : "issues")}</div></div> <div class="export-code"><pre>${html(highlighted())}</pre></div> <div class="export-foot"><div class="ef">Reflects the current filter. Paste straight into a Claude Code session.</div> <button class="btn btn-term btn-sm">`);
		Icon($$renderer, { name: "download" });
		$$renderer.push(`<!----> Download</button> <button${attr_class("btn btn-copy btn-sm", void 0, { "done": copied })}>`);
		$$renderer.push("<!--[-1-->");
		Icon($$renderer, { name: "copy" });
		$$renderer.push(`<!----> Copy for Claude Code`);
		$$renderer.push(`<!--]--></button></div></div></div>`);
	});
}
//#endregion
//#region src/lib/components/ImageLightbox.svelte
function ImageLightbox($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const box = derived(() => ui.lightbox);
		const current = derived(() => box().items[box().index]);
		const many = derived(() => box().items.length > 1);
		$$renderer.push(`<div class="lb" role="presentation"><div class="lb-bar"><div class="lb-meta"><div class="lb-name">${escape_html(current().filename)}</div> <div class="lb-sub">${escape_html(fmtSize(current().size))} `);
		if (many()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`· ${escape_html(box().index + 1)} of ${escape_html(box().items.length)}`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div> <a class="lb-btn"${attr("href", current().url)} target="_blank" rel="noopener" title="Open original">`);
		Icon($$renderer, { name: "download" });
		$$renderer.push(`<!----></a> <button type="button" class="lb-btn" aria-label="Close preview">`);
		Icon($$renderer, { name: "x" });
		$$renderer.push(`<!----></button></div> <div class="lb-stage" role="presentation">`);
		if (many()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button type="button" class="lb-nav prev" aria-label="Previous image">`);
			Icon($$renderer, { name: "chevron" });
			$$renderer.push(`<!----></button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <!---->`);
		$$renderer.push(`<img class="lb-img"${attr("src", current().url)}${attr("alt", current().filename)}/>`);
		$$renderer.push(`<!----> `);
		if (many()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button type="button" class="lb-nav next" aria-label="Next image">`);
			Icon($$renderer, { name: "chevron" });
			$$renderer.push(`<!----></button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div>`);
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
		if (ui.issueModal) {
			$$renderer.push("<!--[0-->");
			IssueModal($$renderer, {
				mode: ui.issueModal,
				applications: data.applications,
				users: data.users,
				currentUserId: data.currentUserId
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (ui.drawerIssue) {
			$$renderer.push("<!--[0-->");
			IssueDetailDrawer($$renderer, {
				issue: ui.drawerIssue,
				users: data.users,
				applications: data.applications
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (ui.exportOpen) {
			$$renderer.push("<!--[0-->");
			ExportPanel($$renderer, { applications: data.applications });
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (ui.lightbox) {
			$$renderer.push("<!--[0-->");
			ImageLightbox($$renderer, {});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		ToastHost($$renderer, {});
		$$renderer.push(`<!---->`);
	});
}
//#endregion
export { _layout as default };
