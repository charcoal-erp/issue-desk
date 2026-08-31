import type { IssueFilter } from '$lib/types';

/**
 * Which columns the issue table shows.
 *
 * A view preference rather than a filter: it says how *you* like to read the
 * table, not which issues are being looked at, so it lives in localStorage
 * instead of the URL and is never part of a shared link or an export.
 */

export type ColumnKey =
	| 'app'
	| 'priority'
	| 'status'
	| 'assignee'
	| 'reporter'
	| 'files'
	| 'created'
	| 'updated';

export interface ColumnDef {
	key: ColumnKey;
	label: string;
	/** Set when the header sorts the table. */
	sort?: NonNullable<IssueFilter['sort']>;
}

/**
 * Table order. The id and the title are not listed: they are how a row is
 * recognised at all, and a table of neither would be unusable.
 */
export const COLUMNS: ColumnDef[] = [
	{ key: 'app', label: 'App / Module' },
	{ key: 'priority', label: 'Priority', sort: 'priority' },
	{ key: 'status', label: 'Status', sort: 'status' },
	{ key: 'assignee', label: 'Assignee' },
	{ key: 'reporter', label: 'Reported by' },
	{ key: 'files', label: 'Files' },
	{ key: 'created', label: 'Reported', sort: 'created' },
	{ key: 'updated', label: 'Updated', sort: 'updated' }
];

const STORAGE_KEY = 'issuedesk_columns';

function allVisible(): Record<ColumnKey, boolean> {
	return Object.fromEntries(COLUMNS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>;
}

export const columns = $state({ visible: allVisible() });

let restored = false;

/**
 * Applied after hydration rather than at import time: the server cannot know
 * this preference, so a client that hid a column during its first render would
 * not match the HTML it is hydrating.
 */
export function restoreColumns(): void {
	if (restored) return;
	restored = true;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const stored = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>;
		for (const c of COLUMNS) {
			if (typeof stored[c.key] === 'boolean') columns.visible[c.key] = stored[c.key]!;
		}
	} catch {
		// Blocked storage or a corrupt value just means the default columns.
	}
}

function persist(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(columns.visible));
	} catch {
		// A preference only — losing it costs nothing.
	}
}

export function toggleColumn(key: ColumnKey): void {
	columns.visible[key] = !columns.visible[key];
	persist();
}

export function showAllColumns(): void {
	columns.visible = allVisible();
	persist();
}
