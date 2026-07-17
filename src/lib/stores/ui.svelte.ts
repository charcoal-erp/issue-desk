import type { Issue } from '$lib/types';

/**
 * Cross-cutting UI state (§15.3): open modal / drawer / export panel.
 * A couple of tiny runes-based modules instead of a store library.
 */
export const ui = $state({
	issueModal: null as null | { mode: 'new' } | { mode: 'edit'; issue: Issue },
	drawerIssue: null as Issue | null,
	exportOpen: false,
	exportTotal: 0
});

export function openNewIssue(): void {
	ui.issueModal = { mode: 'new' };
}

export function openEditIssue(issue: Issue): void {
	ui.drawerIssue = null;
	ui.issueModal = { mode: 'edit', issue };
}

export function closeIssueModal(): void {
	ui.issueModal = null;
}

export function openDrawer(issue: Issue): void {
	ui.drawerIssue = issue;
}

export function closeDrawer(): void {
	ui.drawerIssue = null;
}

export function openExport(total: number): void {
	ui.exportTotal = total;
	ui.exportOpen = true;
}

export function closeExport(): void {
	ui.exportOpen = false;
}
