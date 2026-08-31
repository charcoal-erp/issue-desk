/**
 * Light / dark / follow-the-OS.
 *
 * The choice is a per-browser preference, so it lives in localStorage rather
 * than on the account: the same person on a laptop and a phone can reasonably
 * want different answers. `system` stores nothing and lets the OS decide, which
 * is also what a browser with no stored value does.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'issuedesk_theme';

export const theme = $state({ choice: 'system' as ThemeChoice });

/** Reads what the pre-paint script in app.html already applied. */
export function restoreTheme(): void {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		theme.choice = stored === 'dark' || stored === 'light' ? stored : 'system';
	} catch {
		// Blocked storage just means "system".
	}
}

export function setTheme(choice: ThemeChoice): void {
	theme.choice = choice;
	const root = document.documentElement;
	if (choice === 'system') root.removeAttribute('data-theme');
	else root.dataset.theme = choice;
	try {
		if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, choice);
	} catch {
		// The attribute is already set; only persistence is lost.
	}
}
