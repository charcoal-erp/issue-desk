export interface ToastItem {
	id: number;
	title: string;
	sub?: string;
	out: boolean;
}

let nextId = 1;
const items = $state<ToastItem[]>([]);

export function toasts(): ToastItem[] {
	return items;
}

export function toast(title: string, sub?: string): void {
	const item: ToastItem = { id: nextId++, title, sub, out: false };
	items.push(item);
	setTimeout(() => {
		item.out = true;
		setTimeout(() => {
			const i = items.indexOf(item);
			if (i >= 0) items.splice(i, 1);
		}, 300);
	}, 2600);
}
