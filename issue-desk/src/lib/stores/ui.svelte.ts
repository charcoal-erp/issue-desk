import type { Attachment, Issue } from '$lib/types';

/**
 * Cross-cutting UI state (§15.3): open modal / drawer / export panel.
 * A couple of tiny runes-based modules instead of a store library.
 */
export const ui = $state({
	issueModal: null as null | { mode: 'new' } | { mode: 'edit'; issue: Issue },
	drawerIssue: null as Issue | null,
	exportOpen: false,
	exportTotal: 0,
	lightbox: null as null | { items: Attachment[]; index: number }
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

/** Preview the images among `attachments`, opened at `start`. PDFs are skipped. */
export function openLightbox(attachments: Attachment[], start: Attachment): void {
	const items = attachments.filter((a) => a.kind === 'image');
	const index = items.findIndex((a) => a.id === start.id);
	if (index >= 0) ui.lightbox = { items, index };
}

export function closeLightbox(): void {
	ui.lightbox = null;
}

/** Page through the preview, wrapping at both ends. */
export function stepLightbox(delta: number): void {
	const lb = ui.lightbox;
	if (!lb || lb.items.length < 2) return;
	lb.index = (lb.index + delta + lb.items.length) % lb.items.length;
}

export function openExport(total: number): void {
	ui.exportTotal = total;
	ui.exportOpen = true;
}

export function closeExport(): void {
	ui.exportOpen = false;
}
