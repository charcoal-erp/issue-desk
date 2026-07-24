import { a1 as escape_html, Z as attr, X as attr_class, a2 as ensure_array_like, $ as attr_style, a0 as stringify, y as derived } from '../../chunks/server.js-BMijsOvr.js';
import { S as STATUSES, a as STATUS_META, P as PRIORITIES, b as PRIORITY_META } from '../../chunks/types.js-CwJArkfF.js';
import '../../chunks/client.js-Bshttxu0.js';
import { p as page } from '../../chunks/state.js-CblDxhZw.js';
import { I as Icon, A as Avatar } from '../../chunks/Avatar.js-PAM5HSzZ.js';
import { f as fmtDateTime, a as fmtWhen } from '../../chunks/format.js-DMHwXcId.js';
import { P as PriorityMeter } from '../../chunks/PriorityMeter.js-cpaZ7Gre.js';
import { S as StatusBadge } from '../../chunks/StatusBadge.js-D7yT55mB.js';
import { A as AppChip } from '../../chunks/AppChip.js-Dl3f4hni.js';
import '../../chunks/internal.js-gk8fQVhU.js';
import '../../chunks/shared.js-By7i_rqW.js';
import '../../chunks/exports.js-Bq66Su2C.js';
import '../../chunks/utils.js-C3Eckavg.js';

//#endregion
//#region src/lib/components/FilterRail.svelte
function FilterRail($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { applications, counts, filter} = $$props;
		const appList = derived(() => applications.filter((a) => (counts.byApp[a.id] ?? 0) > 0));
		$$renderer.push(`<aside class="filters"><div class="f-block"><div class="f-title">Applications <button class="clear">Reset</button></div> <div><button${attr_class("app-item", void 0, { "active": !filter.appId })}><span class="app-dot" style="background:var(--muted)"></span> <span class="an">All applications</span> <span class="ac">${escape_html(counts.total)}</span></button> <!--[-->`);
		const each_array = ensure_array_like(appList());
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let app = each_array[$$index];
			$$renderer.push(`<button${attr_class("app-item", void 0, { "active": filter.appId === app.id })}><span class="app-dot"${attr_style(`background:${stringify(app.color)}`)}></span> <span class="an">${escape_html(app.name)}</span> <span class="ac">${escape_html(counts.byApp[app.id] ?? 0)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="f-block"><div class="f-title">Status</div> <div><!--[-->`);
		const each_array_1 = ensure_array_like(STATUSES);
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let s = each_array_1[$$index_1];
			$$renderer.push(`<button${attr_class("chk", void 0, { "on": filter.status?.includes(s) })}><span class="box">`);
			Icon($$renderer, { name: "check-bold" });
			$$renderer.push(`<!----></span> <span class="status-dot"${attr_style(`background:${stringify(STATUS_META[s].color)}`)}></span> <span class="cl">${escape_html(STATUS_META[s].label)}</span> <span class="cn">${escape_html(counts.byStatus[s] ?? 0)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="f-block"><div class="f-title">Priority</div> <div><!--[-->`);
		const each_array_2 = ensure_array_like(PRIORITIES);
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let p = each_array_2[$$index_2];
			$$renderer.push(`<button${attr_class("chk", void 0, { "on": filter.priority?.includes(p) })}><span class="box">`);
			Icon($$renderer, { name: "check-bold" });
			$$renderer.push(`<!----></span> `);
			PriorityMeter($$renderer, {
				priority: p,
				variant: "pips"
			});
			$$renderer.push(`<!----> <span class="cl">${escape_html(PRIORITY_META[p].label)}</span> <span class="cn">${escape_html(counts.byPriority[p] ?? 0)}</span></button>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="f-block"><div class="f-title">Type</div> <div class="seg"><button${attr_class("", void 0, { "on": !filter.type })}>All</button> <button${attr_class("", void 0, { "on": filter.type === "bug" })}>Bugs</button> <button${attr_class("", void 0, { "on": filter.type === "feature" })}>Features</button></div></div></aside>`);
	});
}
//#endregion
//#region src/lib/components/FilterChips.svelte
function FilterChips($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { filter, applications} = $$props;
		const appName = derived(() => applications.find((a) => a.id === filter.appId)?.name ?? filter.appId);
		const hasAny = derived(() => Boolean(filter.appId || filter.status?.length || filter.priority?.length || filter.type || filter.q));
		$$renderer.push(`<div class="chips">`);
		if (hasAny()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="lead">Filters</span> `);
			if (filter.appId) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="chip">App <b>${escape_html(appName())}</b><button aria-label="Remove app filter">`);
				Icon($$renderer, { name: "x-sm" });
				$$renderer.push(`<!----></button></span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <!--[-->`);
			const each_array = ensure_array_like(filter.status ?? []);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let s = each_array[$$index];
				$$renderer.push(`<span class="chip">Status <b>${escape_html(STATUS_META[s].label)}</b><button aria-label="Remove status filter">`);
				Icon($$renderer, { name: "x-sm" });
				$$renderer.push(`<!----></button></span>`);
			}
			$$renderer.push(`<!--]--> <!--[-->`);
			const each_array_1 = ensure_array_like(filter.priority ?? []);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let p = each_array_1[$$index_1];
				$$renderer.push(`<span class="chip">Priority <b>${escape_html(PRIORITY_META[p].label)}</b><button aria-label="Remove priority filter">`);
				Icon($$renderer, { name: "x-sm" });
				$$renderer.push(`<!----></button></span>`);
			}
			$$renderer.push(`<!--]--> `);
			if (filter.type) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="chip">Type <b>${escape_html(filter.type === "bug" ? "Bugs" : "Features")}</b><button aria-label="Remove type filter">`);
				Icon($$renderer, { name: "x-sm" });
				$$renderer.push(`<!----></button></span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (filter.q) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="chip">Search <b>“${escape_html(filter.q)}”</b><button aria-label="Clear search">`);
				Icon($$renderer, { name: "x-sm" });
				$$renderer.push(`<!----></button></span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <button class="chip clear-all svelte-8g2z2l">Clear all</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/IssueRow.svelte
function IssueRow($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { issue, users, appColor} = $$props;
		const assignee = derived(() => users.find((u) => u.id === issue.assigneeId));
		$$renderer.push(`<tr><td class="rail"><i${attr_style(`background:${stringify(STATUS_META[issue.status].color)}`)}></i></td><td class="id-cell">${escape_html(issue.id)}</td><td class="title-cell"><div class="t">${escape_html(issue.title)}</div> <div class="m"><span${attr_class(`type-tag ${issue.type === "bug" ? "type-bug" : "type-feature"}`)}>${escape_html(issue.type)}</span> <span class="path">${escape_html(issue.pagePath || "")}${escape_html(issue.formName ? " · " + issue.formName : "")}</span></div></td><td>`);
		AppChip($$renderer, {
			name: issue.appName,
			color: appColor
		});
		$$renderer.push(`<!----> <div class="module-txt">${escape_html(issue.moduleName)}</div></td><td><span class="prio">`);
		PriorityMeter($$renderer, { priority: issue.priority });
		$$renderer.push(`<!----> <span class="lbl">${escape_html(PRIORITY_META[issue.priority].label)}</span></span></td><td>`);
		StatusBadge($$renderer, { status: issue.status });
		$$renderer.push(`<!----></td><td><div class="assignee-cell">`);
		Avatar($$renderer, { user: assignee() });
		$$renderer.push(`<!----> <span class="nm">${escape_html(assignee() ? assignee().name.split(" ")[0] : "—")}</span></div></td><td class="att-cell">`);
		if (issue.attachments.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="att-pill">`);
			Icon($$renderer, { name: "paperclip" });
			$$renderer.push(`<!---->${escape_html(issue.attachments.length)}</span>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<span class="att-none">—</span>`);
		}
		$$renderer.push(`<!--]--></td><td class="upd"${attr("title", `Reported ${stringify(fmtDateTime(issue.createdAt))}`)}>${escape_html(fmtWhen(issue.createdAt))}</td><td class="upd"${attr("title", `Last modified ${stringify(fmtDateTime(issue.updatedAt))}`)}>${escape_html(fmtWhen(issue.updatedAt))}</td><td><div class="row-actions"><button title="Edit">`);
		Icon($$renderer, { name: "edit" });
		$$renderer.push(`<!----></button> <button title="Copy for Claude Code">`);
		Icon($$renderer, { name: "copy" });
		$$renderer.push(`<!----></button></div></td></tr>`);
	});
}
//#endregion
//#region src/lib/components/IssueTable.svelte
function IssueTable($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { rows, users, applications, filter} = $$props;
		const appColor = derived(() => new Map(applications.map((a) => [a.id, a.color])));
		function arrow(key) {
			if ((filter.sort ?? "updated") !== key) return "";
			return (filter.dir ?? "desc") === "asc" ? "▲" : "▼";
		}
		$$renderer.push(`<div class="table-wrap">`);
		if (rows.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<table class="tbl"><thead><tr><th class="rail"></th><th class="sortable">ID <span class="sarrow">${escape_html(arrow("id"))}</span></th><th class="sortable">Issue <span class="sarrow">${escape_html(arrow("title"))}</span></th><th>App / Module</th><th class="sortable">Priority <span class="sarrow">${escape_html(arrow("priority"))}</span></th><th class="sortable">Status <span class="sarrow">${escape_html(arrow("status"))}</span></th><th>Assignee</th><th>Files</th><th class="sortable">Reported <span class="sarrow">${escape_html(arrow("created"))}</span></th><th class="sortable">Updated <span class="sarrow">${escape_html(arrow("updated"))}</span></th><th></th></tr></thead><tbody><!--[-->`);
			const each_array = ensure_array_like(rows);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let issue = each_array[$$index];
				IssueRow($$renderer, {
					issue,
					users,
					appColor: appColor().get(issue.appId)});
			}
			$$renderer.push(`<!--]--></tbody></table>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="empty">`);
			Icon($$renderer, { name: "search-lg" });
			$$renderer.push(`<!----> <h3>No issues match these filters</h3> <p>Try clearing a filter, or file a new issue.</p></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		let quick = page.url.searchParams.get("q") ?? "";
		$$renderer.push(`<section class="screen">`);
		FilterRail($$renderer, {
			applications: data.applications,
			counts: data.counts,
			filter: data.filter});
		$$renderer.push(`<!----> <div class="table-area"><div class="toolbar"><h1>Issues</h1> <span class="count">${escape_html(data.total)} ${escape_html(data.total === 1 ? "issue" : "issues")}</span> <div class="toolbar-spacer"></div> <div class="tb-search">`);
		Icon($$renderer, { name: "search" });
		$$renderer.push(`<!----> <input placeholder="Quick filter…"${attr("value", quick)}/></div> <button class="btn btn-ghost">`);
		Icon($$renderer, { name: "export" });
		$$renderer.push(`<!----> Export</button> <button class="btn btn-primary">`);
		Icon($$renderer, { name: "plus" });
		$$renderer.push(`<!----> New issue</button></div> `);
		FilterChips($$renderer, {
			filter: data.filter,
			applications: data.applications});
		$$renderer.push(`<!----> `);
		IssueTable($$renderer, {
			rows: data.rows,
			users: data.users,
			applications: data.applications,
			filter: data.filter});
		$$renderer.push(`<!----></div></section>`);
	});
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-C4n5fLKx.js.map
