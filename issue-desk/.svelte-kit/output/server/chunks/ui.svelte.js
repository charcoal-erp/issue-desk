import "./server.js";
//#region src/lib/stores/ui.svelte.ts
var ui = {
	issueModal: null,
	drawerIssue: null,
	exportOpen: false,
	exportTotal: 0,
	lightbox: null
};
function openEditIssue(issue) {
	ui.drawerIssue = null;
	ui.issueModal = {
		mode: "edit",
		issue
	};
}
function openDrawer(issue) {
	ui.drawerIssue = issue;
}
//#endregion
export { openEditIssue as n, ui as r, openDrawer as t };
