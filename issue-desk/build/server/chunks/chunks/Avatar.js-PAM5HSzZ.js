import { X as attr_class, Y as clsx$1, Z as attr, _ as html, y as derived, $ as attr_style, a0 as stringify, a1 as escape_html } from './server.js-BMijsOvr.js';
import './client.js-Bshttxu0.js';
import { i as initials } from './format.js-DMHwXcId.js';

//#region src/lib/components/Icon.svelte
function Icon($$renderer, $$props) {
	const ICONS = {
		logo: {
			paths: "<path d=\"M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4z\"/><circle cx=\"12\" cy=\"11\" r=\"2.5\" fill=\"currentColor\" stroke=\"none\"/>",
			sw: 2.4
		},
		search: {
			paths: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M21 21l-4.3-4.3\"/>",
			sw: 2
		},
		chevron: {
			paths: "<path d=\"M6 9l6 6 6-6\"/>",
			sw: 2.4
		},
		check: {
			paths: "<path d=\"M5 12l5 5L20 6\"/>",
			sw: 3
		},
		"check-bold": {
			paths: "<path d=\"M5 12l5 5L20 6\"/>",
			sw: 3.5
		},
		"check-sm": {
			paths: "<path d=\"M5 12l5 5L20 6\"/>",
			sw: 2.5
		},
		rows: {
			paths: "<path d=\"M3 6h18M3 12h18M3 18h18\"/>",
			sw: 2
		},
		board: {
			paths: "<rect x=\"3\" y=\"4\" width=\"5\" height=\"16\" rx=\"1.2\"/><rect x=\"10\" y=\"4\" width=\"5\" height=\"11\" rx=\"1.2\"/><rect x=\"17\" y=\"4\" width=\"4\" height=\"14\" rx=\"1.2\"/>",
			sw: 2
		},
		dashboard: {
			paths: "<rect x=\"3\" y=\"3\" width=\"8\" height=\"8\" rx=\"1.5\"/><rect x=\"13\" y=\"3\" width=\"8\" height=\"5\" rx=\"1.5\"/><rect x=\"13\" y=\"10\" width=\"8\" height=\"11\" rx=\"1.5\"/><rect x=\"3\" y=\"13\" width=\"8\" height=\"8\" rx=\"1.5\"/>",
			sw: 2
		},
		gear: {
			paths: "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z\"/>",
			sw: 2
		},
		plus: {
			paths: "<path d=\"M12 5v14M5 12h14\"/>",
			sw: 2.4
		},
		export: {
			paths: "<path d=\"M12 15V3\"/><path d=\"M7 8l5-5 5 5\"/><path d=\"M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4\"/>",
			sw: 2
		},
		x: {
			paths: "<path d=\"M18 6L6 18M6 6l12 12\"/>",
			sw: 2.2
		},
		"x-sm": {
			paths: "<path d=\"M18 6L6 18M6 6l12 12\"/>",
			sw: 2.4
		},
		edit: {
			paths: "<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/>",
			sw: 2
		},
		copy: {
			paths: "<rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/>",
			sw: 2
		},
		paperclip: {
			paths: "<path d=\"M21 12.5l-9 9a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8-8\"/>",
			sw: 2
		},
		user: {
			paths: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>",
			sw: 2
		},
		bug: {
			paths: "<path d=\"M8 2l1.5 2.5M16 2l-1.5 2.5\"/><rect x=\"7\" y=\"6\" width=\"10\" height=\"12\" rx=\"5\"/><path d=\"M12 6v12M4 10h3M17 10h3M4 14h3M17 14h3M5 18l2-1M19 18l-2-1M5 8l2 1M19 8l-2 1\"/>",
			sw: 2
		},
		feature: {
			paths: "<path d=\"M9.9 2.6l1.5 4.6h4.9l-4 2.9 1.5 4.6-4-2.9-4 2.9 1.5-4.6-4-2.9h4.9z\"/><path d=\"M12 15v6M9 21h6\"/>",
			sw: 2
		},
		upload: {
			paths: "<path d=\"M12 15V3\"/><path d=\"M8 7l4-4 4 4\"/><path d=\"M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4\"/>",
			sw: 1.8
		},
		image: {
			paths: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"1.5\"/><path d=\"M21 15l-5-5L5 21\"/>",
			sw: 2
		},
		"image-lt": {
			paths: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"1.5\"/><path d=\"M21 15l-5-5L5 21\"/>",
			sw: 1.8
		},
		file: {
			paths: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/>",
			sw: 2
		},
		"file-lt": {
			paths: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/>",
			sw: 1.8
		},
		download: {
			paths: "<path d=\"M12 3v12\"/><path d=\"M7 10l5 5 5-5\"/><path d=\"M5 21h14\"/>",
			sw: 2
		},
		refresh: {
			paths: "<path d=\"M21 12a9 9 0 1 1-3-6.7\"/><path d=\"M21 3v5h-5\"/>",
			sw: 2
		},
		warning: {
			paths: "<path d=\"M12 9v4M12 17h.01\"/><path d=\"M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"/>",
			sw: 2
		},
		markdown: {
			paths: "<path d=\"M3 5h18v14H3z\" fill=\"none\"/><path d=\"M6 15V9l3 3 3-3v6M18 9v4M16 13l2 2 2-2\"/>",
			sw: 2
		},
		json: {
			paths: "<path d=\"M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1\"/>",
			sw: 2
		},
		"toast-check": {
			paths: "<path d=\"M22 11.1V12a10 10 0 1 1-5.9-9.1\"/><path d=\"M22 4L12 14.01l-3-3\"/>",
			sw: 2.5
		},
		"search-lg": {
			paths: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M21 21l-4.3-4.3\"/>",
			sw: 1.6
		},
		task: {
			paths: "<path d=\"M9 11l3 3L22 4\"/><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>",
			sw: 2
		},
		"arrow-right": {
			paths: "<path d=\"M5 12h14\"/><path d=\"M13 6l6 6-6 6\"/>",
			sw: 2.2
		},
		"arrow-up": {
			paths: "<path d=\"M12 19V5M5 12l7-7 7 7\"/>",
			sw: 2.2
		},
		"arrow-down": {
			paths: "<path d=\"M12 5v14M5 12l7 7 7-7\"/>",
			sw: 2.2
		},
		layers: {
			paths: "<path d=\"M12 2l9 5-9 5-9-5 9-5z\"/><path d=\"M3 12l9 5 9-5\"/><path d=\"M3 17l9 5 9-5\"/>",
			sw: 1.8
		},
		play: {
			paths: "<path d=\"M5 3l14 9-14 9V3z\"/>",
			sw: 2
		},
		terminal: {
			paths: "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"M6 9l3 3-3 3\"/><path d=\"M13 15h5\"/>",
			sw: 2
		},
		flask: {
			paths: "<path d=\"M9 2h6\"/><path d=\"M10 2v6l-4.6 9A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.8-3L14 8V2\"/><path d=\"M7 14h10\"/>",
			sw: 1.8
		},
		code: {
			paths: "<path d=\"M16 18l6-6-6-6M8 6l-6 6 6 6\"/>",
			sw: 2
		},
		monitor: {
			paths: "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M8 21h8M12 17v4\"/>",
			sw: 2
		},
		eye: {
			paths: "<path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
			sw: 2
		},
		link: {
			paths: "<path d=\"M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5\"/><path d=\"M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5\"/>",
			sw: 2
		},
		trash: {
			paths: "<path d=\"M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6\"/>",
			sw: 2
		}
	};
	let { name, class: cls = "" } = $$props;
	const icon = derived(() => ICONS[name] ?? {
		paths: "",
		sw: 2
	});
	$$renderer.push(`<svg${attr_class(clsx$1(cls))} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"${attr("stroke-width", icon().sw)} stroke-linecap="round" stroke-linejoin="round">${html(icon().paths)}</svg>`);
}
var items = [];
function toasts() {
	return items;
}
//#endregion
//#region src/lib/components/Avatar.svelte
function Avatar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { user, size = 26 } = $$props;
		if (user) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="avatar"${attr_style(`background:${stringify(user.avatarColor ?? "#64748B")};width:${stringify(size)}px;height:${stringify(size)}px;font-size:${stringify(size <= 26 ? 10 : 11)}px`)}>${escape_html(initials(user.name))}</span>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<span class="unassigned">`);
			Icon($$renderer, { name: "user" });
			$$renderer.push(`<!----></span>`);
		}
		$$renderer.push(`<!--]-->`);
	});
}

export { Avatar as A, Icon as I, toasts as t };
//# sourceMappingURL=Avatar.js-PAM5HSzZ.js.map
