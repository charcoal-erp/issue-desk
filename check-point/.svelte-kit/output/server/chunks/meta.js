//#region src/lib/checkpoint/meta.ts
/**
* Shared Checkpoint presentation metadata (design §16). Framework-agnostic so
* both the server-side exporters and the Svelte UI import the same labels and
* colours. Colours mirror the mockup's CSS custom properties.
*/
var TEST_KIND_META = {
	unit: {
		label: "Unit",
		color: "#7C3AED",
		soft: "#F1EAFE",
		cls: "k-unit"
	},
	api: {
		label: "API",
		color: "#0891B2",
		soft: "#E0F5FA",
		cls: "k-api"
	},
	e2e: {
		label: "E2E",
		color: "#5B4BFF",
		soft: "#EEEBFF",
		cls: "k-e2e"
	},
	visual: {
		label: "Visual",
		color: "#DB2777",
		soft: "#FDECF4",
		cls: "k-visual"
	},
	shell: {
		label: "Shell",
		color: "#475569",
		soft: "#EEF1F5",
		cls: "k-shell"
	},
	manual: {
		label: "Manual",
		color: "#0D9488",
		soft: "#E0F5F3",
		cls: "k-manual"
	}
};
var RESULT_META = {
	pass: {
		label: "Pass",
		color: "#2FA36B",
		soft: "#E7F5EE",
		cls: "rd-pass"
	},
	fail: {
		label: "Fail",
		color: "#E5484D",
		soft: "#FDECEC",
		cls: "rd-fail"
	},
	blocked: {
		label: "Blocked",
		color: "#F5A623",
		soft: "#FEF4E1",
		cls: "rd-blocked"
	},
	skipped: {
		label: "Skipped",
		color: "#94A3B8",
		soft: "#F1F4F8",
		cls: "rd-skipped"
	}
};
var CASE_STATUS_META = {
	active: {
		label: "Active",
		cls: "cs-active"
	},
	draft: {
		label: "Draft",
		cls: "cs-draft"
	},
	deprecated: {
		label: "Deprecated",
		cls: "cs-deprecated"
	}
};
var ENV_LABEL = {
	local: "Local",
	ci: "CI",
	staging: "Staging",
	prod: "Prod"
};
var REPORT_FORMAT_LABEL = {
	"junit-xml": "junit-xml",
	"playwright-json": "playwright-json",
	"vitest-json": "vitest-json",
	"pytest-json": "pytest-json",
	tap: "TAP",
	"checkpoint-json": "checkpoint-json",
	"exit-code": "exit-code + TAP stdout",
	"visual-diff": "playwright-json + diff manifest",
	custom: "custom"
};
function matchStrategyLabel(m) {
	switch (m.by) {
		case "nodeid": return "nodeid";
		case "annotation": return `annotation ${m.tag}`;
		case "testName": return "test name";
		case "snapshotName": return "snapshot name";
		case "tapName": return "TAP test name";
		case "explicitMap": return "explicit map";
	}
}
/** Traffic-light colour for a pass-rate percentage (mockup `rateColor`). */
function rateColor(pct) {
	if (pct === null) return "var(--muted)";
	if (pct >= 80) return "var(--pass)";
	if (pct >= 50) return "var(--blocked)";
	return "var(--fail)";
}
/** "820ms" · "42s" · "3m 12s" · "1h 4m". */
function formatDuration(ms) {
	if (ms == null) return "—";
	if (ms < 1e3) return `${Math.round(ms)}ms`;
	const s = Math.round(ms / 1e3);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}
/** Compact "just now · 25m · 2h · 3d" relative time. */
function timeAgo(iso, now) {
	if (!iso) return "—";
	const diff = now.getTime() - new Date(iso).getTime();
	if (diff < 6e4) return "just now";
	const m = Math.floor(diff / 6e4);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}
//#endregion
export { TEST_KIND_META as a, rateColor as c, RESULT_META as i, timeAgo as l, ENV_LABEL as n, formatDuration as o, REPORT_FORMAT_LABEL as r, matchStrategyLabel as s, CASE_STATUS_META as t };
