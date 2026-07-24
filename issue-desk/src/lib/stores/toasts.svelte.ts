export interface ToastItem {
	id: number;
	title: string;
	sub?: string;
	out: boolean;
}

let nextId = 1;
const items = $state<ToastItem[]>([]);

const LINGER_MS = 2600;
const FADE_MS = 300;

export function toasts(): ToastItem[] {
	return items;
}

export function toast(title: string, sub?: string): void {
	const id = nextId++;
	items.push({ id, title, sub, out: false });
	setTimeout(() => dismiss(id), LINGER_MS);
}

/**
 * Fade the toast out, then drop it. Everything is looked up by id: `items` is a
 * deep $state proxy, so the object read back out of it is not the one that was
 * pushed in — mutating the pushed reference updates nothing on screen.
 */
export function dismiss(id: number): void {
	const item = items.find((t) => t.id === id);
	if (!item || item.out) return;
	item.out = true;
	setTimeout(() => {
		const i = items.findIndex((t) => t.id === id);
		if (i >= 0) items.splice(i, 1);
	}, FADE_MS);
}
