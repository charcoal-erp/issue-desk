/**
 * Unsaved issue drafts, kept in localStorage.
 *
 * The issue form is the one place in the app where a stray click can destroy
 * several minutes of typing. Closing a dirty form asks first, and "Save draft"
 * parks the fields here so reopening the form restores them. Drafts are
 * per-issue (`new` for the create form), local to the browser, and never leave
 * it — they are unsaved work, not data.
 */

const PREFIX = 'issuedesk_draft:';

/** Whatever the form snapshot holds — the modal owns the shape. */
export type DraftFields = Record<string, unknown>;

export interface StoredDraft {
	fields: DraftFields;
	savedAt: string;
}

/** `new` for the create form, the issue id when editing. */
export function draftKey(issueId?: string): string {
	return PREFIX + (issueId ?? 'new');
}

// Private browsing and disabled storage both throw on access rather than
// returning null, and a draft is a convenience — never let it break the form.
function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function saveDraft(key: string, fields: DraftFields): void {
	try {
		storage()?.setItem(key, JSON.stringify({ fields, savedAt: new Date().toISOString() }));
	} catch {
		// Quota exceeded, or storage blocked — the form still works.
	}
}

export function loadDraft(key: string): StoredDraft | null {
	try {
		const raw = storage()?.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredDraft;
		return parsed && typeof parsed === 'object' && parsed.fields ? parsed : null;
	} catch {
		return null;
	}
}

export function clearDraft(key: string): void {
	try {
		storage()?.removeItem(key);
	} catch {
		// Nothing to do — a stale draft is harmless.
	}
}

/** "2 minutes ago" — how stale the restored draft is. */
export function draftAge(savedAt: string): string {
	const seconds = Math.max(0, Math.round((Date.now() - new Date(savedAt).getTime()) / 1000));
	if (seconds < 60) return 'just now';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	const days = Math.round(hours / 24);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}
