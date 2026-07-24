//#region src/lib/priority.ts
var PRIORITY_META = {
	critical: {
		label: "Critical",
		pips: 5,
		color: "#E5484D"
	},
	very_high: {
		label: "Very High",
		pips: 4,
		color: "#F76808"
	},
	high: {
		label: "High",
		pips: 3,
		color: "#F5A623"
	},
	medium: {
		label: "Medium",
		pips: 2,
		color: "#8B93A7"
	},
	low: {
		label: "Low",
		pips: 1,
		color: "#B8BEC9"
	}
};
/** Intrinsic order Critical→Low, used for sorting and the board. */
var PRIORITY_ORDER = [
	"critical",
	"very_high",
	"high",
	"medium",
	"low"
];
function priorityRank(p) {
	return PRIORITY_ORDER.indexOf(p);
}
//#endregion
//#region src/lib/status.ts
var STATUS_META = {
	open: {
		label: "Open",
		shortLabel: "Open",
		color: "#E5484D",
		badgeClass: "st-open",
		pickerClass: "s-open"
	},
	implemented: {
		label: "Implemented",
		shortLabel: "Impl.",
		color: "#F5A623",
		badgeClass: "st-impl",
		pickerClass: "s-impl"
	},
	complete: {
		label: "Complete",
		shortLabel: "Done",
		color: "#2FA36B",
		badgeClass: "st-done",
		pickerClass: "s-done"
	},
	rejected: {
		label: "Rejected",
		shortLabel: "Reject",
		color: "#64748B",
		badgeClass: "st-rejected",
		pickerClass: "s-rejected"
	}
};
var STATUS_ORDER = [
	"open",
	"implemented",
	"complete",
	"rejected"
];
function statusRank(s) {
	return STATUS_ORDER.indexOf(s);
}
//#endregion
//#region src/lib/types.ts
var PRIORITIES = [
	"critical",
	"very_high",
	"high",
	"medium",
	"low"
];
var STATUSES = [
	"open",
	"implemented",
	"complete",
	"rejected"
];
var ISSUE_TYPES = ["bug", "feature"];
//#endregion
export { statusRank as a, STATUS_META as i, PRIORITIES as n, PRIORITY_META as o, STATUSES as r, priorityRank as s, ISSUE_TYPES as t };
