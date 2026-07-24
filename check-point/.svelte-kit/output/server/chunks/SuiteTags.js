import { C as attr, T as escape_html, c as stringify, i as ensure_array_like, r as derived, t as attr_class } from "./server.js";
//#region src/lib/components/checkpoint/SuiteTags.svelte
function SuiteTags($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/**
		* Suite tags, rendered by severity rather than as flat text.
		*
		* Tags are the only place a suite can say "this wipes a database" or "this
		* binds a port", and that warning is worthless if it is only visible while
		* editing the suite. Prefixes carry the severity — `destructive:` reads as a
		* warning, `cleanup:` / `binds:` / `requires:` as something to be aware of,
		* everything else as neutral metadata — so the vocabulary stays the content
		* repo's business and this component needs no list of known tags.
		*
		* `max` keeps a card readable: the most severe tags are shown and the rest
		* collapse into a +N chip that names them on hover. Severity ordering is
		* derived from the prefix, so this stays generic too.
		*/
		let { tags, compact = false, max = 0 } = $$props;
		const RANK = {
			danger: 0,
			warn: 1,
			ok: 2,
			info: 3,
			flat: 4
		};
		function severity(tag) {
			if (tag.startsWith("destructive:")) return "danger";
			if (tag.startsWith("cleanup:") || tag.startsWith("binds:") || tag.startsWith("requires:")) return "warn";
			if (tag === "db:none") return "ok";
			if (tag.startsWith("db:")) return "info";
			return "flat";
		}
		const ordered = derived(() => tags.map((tag, i) => ({
			tag,
			i,
			rank: RANK[severity(tag)]
		})).sort((a, b) => a.rank - b.rank || a.i - b.i).map((x) => x.tag));
		const shown = derived(() => max > 0 ? ordered().slice(0, max) : ordered());
		const hidden = derived(() => max > 0 ? ordered().slice(max) : []);
		if (tags.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div${attr_class("cp-tags svelte-1do50ks", void 0, { "compact": compact })}><!--[-->`);
			const each_array = ensure_array_like(shown());
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let tag = each_array[$$index];
				$$renderer.push(`<span${attr_class(`cp-tag ${stringify(severity(tag))}`, "svelte-1do50ks")}>${escape_html(tag)}</span>`);
			}
			$$renderer.push(`<!--]--> `);
			if (hidden().length) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="cp-tag flat more svelte-1do50ks"${attr("title", hidden().join("\n"))}>+${escape_html(hidden().length)}</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { SuiteTags as t };
