import { C as attr, T as escape_html, i as ensure_array_like } from "../../../chunks/server.js";
import { n as Icon, t as KindBadge } from "../../../chunks/KindBadge.js";
//#region src/routes/search/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		$$renderer.push(`<div class="table-area"><div class="toolbar"><h1>Search</h1> `);
		if (data.q) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="count">${escape_html(data.total)} result${escape_html(data.total === 1 ? "" : "s")} for “${escape_html(data.q)}”</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="scroll">`);
		if (!data.q) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="empty"><div class="empty-in"><div class="ei">`);
			Icon($$renderer, { name: "search" });
			$$renderer.push(`<!----></div> <h3>Search Checkpoint</h3> <p>Find a case, suite, run or runner by name, id, spec path, tag or command. Every word has to match, so extra words narrow the result.</p></div></div>`);
		} else if (!data.groups.length) {
			$$renderer.push("<!--[1-->");
			$$renderer.push(`<div class="empty"><div class="empty-in"><div class="ei">`);
			Icon($$renderer, { name: "search" });
			$$renderer.push(`<!----></div> <h3>Nothing matches “${escape_html(data.q)}”</h3> <p>Try one word, or part of an id — <code>SUITE-SEED</code>, <code>visual</code>, <code>RNR-12</code>.</p></div></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(data.groups);
			for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
				let g = each_array[$$index_1];
				$$renderer.push(`<div class="sec-title">${escape_html(g.label)} <span class="sr-n">${escape_html(g.total)}</span> `);
				if (g.total > g.hits.length) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="sr-more">showing first ${escape_html(g.hits.length)}</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div> <div class="sr-list"><!--[-->`);
				const each_array_1 = ensure_array_like(g.hits);
				for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
					let h = each_array_1[$$index];
					$$renderer.push(`<a class="sr-row"${attr("href", h.href)}>`);
					if (h.kind) {
						$$renderer.push("<!--[0-->");
						KindBadge($$renderer, {
							kind: h.kind,
							small: true
						});
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <span class="sr-id">${escape_html(h.id)}</span> <span class="sr-title">${escape_html(h.title)}</span> <span class="sr-sub">${escape_html(h.sub)}</span> `);
					if (h.badge) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<span class="sr-badge">${escape_html(h.badge)}</span>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></a>`);
				}
				$$renderer.push(`<!--]--></div>`);
			}
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
export { _page as default };
