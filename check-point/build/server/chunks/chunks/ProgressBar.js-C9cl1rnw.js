import { a3 as attr_style, $ as stringify, y as derived } from './server.js-CDtqtqwP.js';

//#region src/lib/components/checkpoint/ProgressBar.svelte
function ProgressBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { counts } = $$props;
		const total = derived(() => counts.total || 1);
		const pct = (n) => n / total() * 100;
		$$renderer.push(`<div class="prog"><div class="seg-p"${attr_style(`width:${stringify(pct(counts.pass))}%`)}></div> <div class="seg-f"${attr_style(`width:${stringify(pct(counts.fail))}%`)}></div> <div class="seg-b"${attr_style(`width:${stringify(pct(counts.blocked))}%`)}></div> <div class="seg-s"${attr_style(`width:${stringify(pct(counts.skipped))}%`)}></div></div>`);
	});
}

export { ProgressBar as P };
//# sourceMappingURL=ProgressBar.js-C9cl1rnw.js.map
