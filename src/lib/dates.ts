import type { IssueFilter } from './types';

/**
 * Date-range presets for the filter rail.
 *
 * They resolve to plain `updatedFrom`/`updatedTo` values rather than living as
 * a separate URL parameter, so a shared link keeps meaning the same window a
 * week later — "this month" would silently follow the calendar, which is not
 * what someone sharing a link intends. The rail highlights a preset when the
 * current range happens to match what it would produce today.
 */

export const DATE_PRESETS = [
	{ id: 'today', label: 'Today' },
	{ id: 'yesterday', label: 'Yesterday' },
	{ id: 'week', label: 'This week' },
	{ id: 'month', label: 'This month' },
	{ id: 'days30', label: 'Last 30 days' }
] as const;

export type DatePresetId = (typeof DATE_PRESETS)[number]['id'];

/** Local-calendar YYYY-MM-DD — the form the filter and `<input type="date">` share. */
export function isoDay(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
	const out = new Date(d);
	out.setDate(out.getDate() + days);
	return out;
}

export interface DateRange {
	updatedFrom?: string;
	updatedTo?: string;
}

/** Resolve a preset against `now` (injectable so this stays testable). */
export function presetRange(id: DatePresetId, now = new Date()): DateRange {
	const today = isoDay(now);
	switch (id) {
		case 'today':
			return { updatedFrom: today, updatedTo: today };
		case 'yesterday': {
			const y = isoDay(addDays(now, -1));
			return { updatedFrom: y, updatedTo: y };
		}
		case 'week': {
			// Weeks start Monday — getDay() is Sunday-based, so Sunday (0) is day 7.
			const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
			return { updatedFrom: isoDay(addDays(now, -(dayOfWeek - 1))), updatedTo: today };
		}
		case 'month':
			return { updatedFrom: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), updatedTo: today };
		case 'days30':
			return { updatedFrom: isoDay(addDays(now, -29)), updatedTo: today };
	}
}

/** Which preset the current filter matches, if any — drives the active chip. */
export function activePreset(filter: IssueFilter, now = new Date()): DatePresetId | null {
	if (!filter.updatedFrom && !filter.updatedTo) return null;
	for (const preset of DATE_PRESETS) {
		const range = presetRange(preset.id, now);
		if (range.updatedFrom === filter.updatedFrom && range.updatedTo === filter.updatedTo) {
			return preset.id;
		}
	}
	return null;
}
