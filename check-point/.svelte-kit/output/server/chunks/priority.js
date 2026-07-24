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
//#endregion
export { PRIORITY_ORDER as n, PRIORITY_META as t };
