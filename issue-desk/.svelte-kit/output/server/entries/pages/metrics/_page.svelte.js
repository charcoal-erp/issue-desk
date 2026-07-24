import { a as ensure_array_like, c as stringify, i as derived, n as attr_style, w as escape_html } from "../../../chunks/server.js";
import { i as STATUS_META, n as PRIORITIES, o as PRIORITY_META } from "../../../chunks/types.js";
import { o as relDate } from "../../../chunks/format.js";
import "../../../chunks/ui.svelte.js";
import { t as PriorityMeter } from "../../../chunks/PriorityMeter.js";
//#region src/routes/metrics/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const issues = derived(() => data.issues);
		const open = derived(() => issues().filter((i) => i.status === "open").length);
		const impl = derived(() => issues().filter((i) => i.status === "implemented").length);
		const rejected = derived(() => issues().filter((i) => i.status === "rejected").length);
		const crit = derived(() => issues().filter((i) => i.priority === "critical" && i.status === "open").length);
		const bugs = derived(() => issues().filter((i) => i.type === "bug").length);
		const features = derived(() => issues().filter((i) => i.type === "feature").length);
		const appList = derived(() => data.applications.filter((a) => issues().some((i) => i.appId === a.id)));
		const openByApp = derived(() => new Map(appList().map((a) => [a.id, issues().filter((i) => i.appId === a.id && i.status === "open").length])));
		const maxApp = derived(() => Math.max(...[...openByApp().values()], 1));
		const byPriority = derived(() => new Map(PRIORITIES.map((p) => [p, issues().filter((i) => i.priority === p).length])));
		const maxPriority = derived(() => Math.max(...[...byPriority().values()], 1));
		const recent = derived(() => issues().slice(0, 6));
		function userName(id) {
			return data.users.find((u) => u.id === id)?.name ?? id;
		}
		const stats = derived(() => [
			{
				k: "Total issues",
				v: issues().length,
				c: "var(--accent)",
				d: `${bugs()} bugs · ${features()} features`
			},
			{
				k: "Open",
				v: open(),
				c: "var(--open)",
				d: "awaiting work"
			},
			{
				k: "Implemented",
				v: impl(),
				c: "var(--impl)",
				d: "in verification"
			},
			{
				k: "Rejected",
				v: rejected(),
				c: "var(--rejected)",
				d: "won’t implement"
			},
			{
				k: "Critical & open",
				v: crit(),
				c: "#B0343A",
				d: "need attention now"
			}
		]);
		$$renderer.push(`<section class="screen screen-dashboard"><div class="dash"><h1>Metrics</h1> <p class="sub">Portfolio-wide snapshot across all applications.</p> <div class="stat-grid"><!--[-->`);
		const each_array = ensure_array_like(stats());
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let stat = each_array[$$index];
			$$renderer.push(`<div class="stat"><span class="accent-bar"${attr_style(`background:${stringify(stat.c)}`)}></span> <div class="k">${escape_html(stat.k)}</div> <div class="v"${attr_style(`color:${stringify(stat.c)}`)}>${escape_html(stat.v)}</div> <div class="d">${escape_html(stat.d)}</div></div>`);
		}
		$$renderer.push(`<!--]--></div> <div class="panel-grid"><div class="panel"><div class="panel-head"><h3>Open issues by application</h3></div> <div class="panel-body"><!--[-->`);
		const each_array_1 = ensure_array_like(appList());
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let app = each_array_1[$$index_1];
			const n = openByApp().get(app.id) ?? 0;
			$$renderer.push(`<div class="bar-row"><div class="bl"><span class="app-dot"${attr_style(`background:${stringify(app.color)}`)}></span>${escape_html(app.name)}</div> <div class="track"><div class="fill"${attr_style(`width:${stringify(Math.max(n / maxApp() * 100, 4))}%;background:${stringify(app.color)}`)}></div></div> <div class="bn">${escape_html(n)}</div></div>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="panel"><div class="panel-head"><h3>By priority</h3></div> <div class="panel-body"><!--[-->`);
		const each_array_2 = ensure_array_like(PRIORITIES);
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let p = each_array_2[$$index_2];
			const n = byPriority().get(p) ?? 0;
			$$renderer.push(`<div class="bar-row"><div class="bl">`);
			PriorityMeter($$renderer, { priority: p });
			$$renderer.push(`<!----> ${escape_html(PRIORITY_META[p].label)}</div> <div class="track"><div class="fill"${attr_style(`width:${stringify(Math.max(n / maxPriority() * 100, 4))}%;background:${stringify(PRIORITY_META[p].color)}`)}></div></div> <div class="bn">${escape_html(n)}</div></div>`);
		}
		$$renderer.push(`<!--]--></div></div></div> <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Recent activity</h3></div> <div class="panel-body"><!--[-->`);
		const each_array_3 = ensure_array_like(recent());
		for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
			let issue = each_array_3[$$index_3];
			$$renderer.push(`<div class="act-item"><span class="act-dot"${attr_style(`background:${stringify(STATUS_META[issue.status].color)}`)}></span> <div class="ai-body"><b>${escape_html(userName(issue.reporterId))}</b> reported <button class="mid svelte-1ocdze">${escape_html(issue.id)}</button> — ${escape_html(issue.title)} <span style="color:var(--faint)">in ${escape_html(issue.appName)} / ${escape_html(issue.moduleName)}</span></div> <div class="ai-time">${escape_html(relDate(issue.updatedAt))}</div></div>`);
		}
		$$renderer.push(`<!--]--></div></div></div></section>`);
	});
}
//#endregion
export { _page as default };
