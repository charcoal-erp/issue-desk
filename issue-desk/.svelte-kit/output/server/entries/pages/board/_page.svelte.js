import { a as ensure_array_like, c as stringify, i as derived, n as attr_style, t as attr_class, w as escape_html } from "../../../chunks/server.js";
import { i as STATUS_META, r as STATUSES, s as priorityRank } from "../../../chunks/types.js";
import { i as Icon, t as Avatar } from "../../../chunks/Avatar.js";
import { t as openDrawer } from "../../../chunks/ui.svelte.js";
import { t as PriorityMeter } from "../../../chunks/PriorityMeter.js";
import "../../../chunks/actions.js";
import { t as AppChip } from "../../../chunks/AppChip.js";
//#region src/lib/components/BoardCard.svelte
function BoardCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { issue, users, appColor, onOpen } = $$props;
		const assignee = derived(() => users.find((u) => u.id === issue.assigneeId));
		$$renderer.push(`<div class="bcard"${attr_style(`border-left-color:${stringify(STATUS_META[issue.status].color)}`)} role="button" tabindex="0" draggable="true"><div class="bc-top"><span class="bc-id">${escape_html(issue.id)}</span> `);
		PriorityMeter($$renderer, { priority: issue.priority });
		$$renderer.push(`<!----></div> <div class="bc-title">${escape_html(issue.title)}</div> <div class="bc-foot">`);
		AppChip($$renderer, {
			name: issue.appName,
			color: appColor
		});
		$$renderer.push(`<!----> <span class="sp"></span> `);
		Avatar($$renderer, { user: assignee() });
		$$renderer.push(`<!----></div></div>`);
	});
}
//#endregion
//#region src/routes/board/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		let dragTarget = null;
		const appColor = derived(() => new Map(data.applications.map((a) => [a.id, a.color])));
		function column(status) {
			return data.rows.filter((i) => i.status === status).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
		}
		$$renderer.push(`<section class="screen screen-board"><div style="flex:1;display:flex;flex-direction:column;min-width:0"><div class="board-head"><h1>Board</h1> <span class="count">${escape_html(data.total)} ${escape_html(data.total === 1 ? "issue" : "issues")}</span> <div style="flex:1"></div> <a class="btn btn-ghost btn-sm" href="/">`);
		Icon($$renderer, { name: "rows" });
		$$renderer.push(`<!----> Table view</a></div> <div class="board"><!--[-->`);
		const each_array = ensure_array_like(STATUSES);
		for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
			let status = each_array[$$index_1];
			const items = column(status);
			$$renderer.push(`<div${attr_class("bcol svelte-89g097", void 0, { "drop-target": dragTarget === status })} role="list"><div class="bcol-head"><span class="dot"${attr_style(`background:${stringify(STATUS_META[status].color)}`)}></span> <span class="t">${escape_html(STATUS_META[status].label)}</span> <span class="c">${escape_html(items.length)}</span></div> <div class="bcol-body">`);
			const each_array_1 = ensure_array_like(items);
			if (each_array_1.length !== 0) {
				$$renderer.push("<!--[-->");
				for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
					let issue = each_array_1[$$index];
					BoardCard($$renderer, {
						issue,
						users: data.users,
						appColor: appColor().get(issue.appId),
						onOpen: (i) => openDrawer(i)
					});
				}
			} else {
				$$renderer.push("<!--[!-->");
				$$renderer.push(`<div class="bcol-empty">Nothing here</div>`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		}
		$$renderer.push(`<!--]--></div></div></section>`);
	});
}
//#endregion
export { _page as default };
