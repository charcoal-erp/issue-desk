import { describe, expect, it } from 'vitest';
import { DATE_PRESETS, activePreset, isoDay, presetRange } from '$lib/dates';

// A fixed Wednesday, so "this week" has something to reach back to.
const WEDNESDAY = new Date(2026, 7, 12, 14, 30); // 2026-08-12
const SUNDAY = new Date(2026, 7, 16, 9, 0); // 2026-08-16

describe('isoDay', () => {
	it('formats the local calendar day, not UTC', () => {
		// Late-evening local time can already be "tomorrow" in UTC — the filter
		// works in calendar days, so this must follow the user's clock.
		expect(isoDay(new Date(2026, 0, 5, 23, 45))).toBe('2026-01-05');
		expect(isoDay(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31');
	});
});

describe('presetRange', () => {
	it('today and yesterday are single days', () => {
		expect(presetRange('today', WEDNESDAY)).toEqual({
			updatedFrom: '2026-08-12',
			updatedTo: '2026-08-12'
		});
		expect(presetRange('yesterday', WEDNESDAY)).toEqual({
			updatedFrom: '2026-08-11',
			updatedTo: '2026-08-11'
		});
	});

	it('weeks start on Monday', () => {
		expect(presetRange('week', WEDNESDAY)).toEqual({
			updatedFrom: '2026-08-10', // the Monday
			updatedTo: '2026-08-12'
		});
	});

	it('treats Sunday as the end of the week, not the start', () => {
		// getDay() calls Sunday 0; naively that would reach forward a week.
		expect(presetRange('week', SUNDAY)).toEqual({
			updatedFrom: '2026-08-10',
			updatedTo: '2026-08-16'
		});
	});

	it('months run from the 1st, and 30 days is inclusive of today', () => {
		expect(presetRange('month', WEDNESDAY)).toEqual({
			updatedFrom: '2026-08-01',
			updatedTo: '2026-08-12'
		});
		expect(presetRange('days30', WEDNESDAY)).toEqual({
			updatedFrom: '2026-07-14', // 29 days back + today = 30 days
			updatedTo: '2026-08-12'
		});
	});

	it('crosses month and year boundaries', () => {
		expect(presetRange('yesterday', new Date(2027, 0, 1, 10, 0))).toEqual({
			updatedFrom: '2026-12-31',
			updatedTo: '2026-12-31'
		});
	});
});

describe('activePreset', () => {
	it('recognises a range it would have produced', () => {
		for (const preset of DATE_PRESETS) {
			const range = presetRange(preset.id, WEDNESDAY);
			expect(activePreset(range, WEDNESDAY)).toBe(preset.id);
		}
	});

	it('is null for no range and for a hand-picked one', () => {
		expect(activePreset({}, WEDNESDAY)).toBeNull();
		expect(
			activePreset({ updatedFrom: '2026-03-02', updatedTo: '2026-04-09' }, WEDNESDAY)
		).toBeNull();
	});

	it('stops matching once the day moves on', () => {
		const today = presetRange('today', WEDNESDAY);
		const nextDay = new Date(2026, 7, 13, 9, 0);
		expect(activePreset(today, nextDay)).toBe('yesterday');
	});
});
