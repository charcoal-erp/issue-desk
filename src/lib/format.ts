/** "16 Jul" — table / drawer date format. */
export function fmtDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** "today" / "yesterday" / "3d ago" — activity feed. */
export function relDate(iso: string, now: Date = new Date()): string {
	const d = new Date(iso);
	const days = Math.round(
		(startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000
	);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	return `${days}d ago`;
}

function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "KK" from "Kiran Kharade". */
export function initials(name: string): string {
	return name
		.split(' ')
		.map((w) => w[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();
}

/** "184 KB" / "1.2 MB" for attachment rows. */
export function fmtSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
