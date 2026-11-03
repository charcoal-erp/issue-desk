import { describe, expect, it } from 'vitest';
import { buildTrend } from '$lib/trend';
import type { Activity, Issue } from '$lib/types';

const NOW = new Date(2026, 10, 3, 12); // Tue 3 Nov 2026

function issue(fields: Omit<Partial<Issue>, 'activity'> & { activity?: Partial<Activity>[] }): Issue {
	return {
		status: 'open',
		createdAt: new Date(2026, 6, 20, 10).toISOString(),
		updatedAt: new Date(2026, 6, 20, 10).toISOString(),
		activity: [],
		...fields
	} as unknown as Issue;
}

/** Index of the bucket holding a date — weeks count from Mon 29 June. */
const weekOf = (month: number, day: number) =>
	Math.round((new Date(2026, month, day).getTime() - new Date(2026, 5, 29).getTime()) / (7 * 864e5));

describe('buildTrend', () => {
	it('always opens at July 2026 and runs through the current week', () => {
		const trend = buildTrend([], NOW);
		expect(trend[0].label).toBe(new Date(2026, 6, 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
		expect(trend).toHaveLength(weekOf(10, 2) + 1);
		// A later "now" only adds weeks; what is already there stays put.
		const later = buildTrend([], new Date(2027, 0, 15));
		expect(later.slice(0, trend.length)).toEqual(trend);
		expect(later.length).toBeGreaterThan(trend.length);
	});

	it('buckets created and resolved by week', () => {
		const trend = buildTrend(
			[
				issue({
					status: 'complete',
					createdAt: new Date(2026, 6, 20, 10).toISOString(),
					updatedAt: new Date(2026, 7, 5, 10).toISOString()
				})
			],
			NOW
		);
		expect(trend[weekOf(6, 20)].created).toBe(1);
		expect(trend[weekOf(7, 3)].resolved).toBe(1);
	});

	it('keeps a verified issue in the week it moved to To be verified', () => {
		const trend = buildTrend(
			[
				issue({
					status: 'complete',
					updatedAt: new Date(2026, 8, 10, 10).toISOString(),
					activity: [{ kind: 'status', to: 'to-be-verified', at: new Date(2026, 7, 12, 10).toISOString() }]
				})
			],
			NOW
		);
		expect(trend[weekOf(7, 10)].verify).toBe(1);
		expect(trend.reduce((n, b) => n + b.verify, 0)).toBe(1);
	});

	it('counts every move, ignores other statuses, and falls back for issues filed as To be verified', () => {
		const trend = buildTrend(
			[
				issue({
					activity: [
						{ kind: 'status', to: 'in-progress', at: new Date(2026, 7, 3, 10).toISOString() },
						{ kind: 'status', to: 'to-be-verified', at: new Date(2026, 7, 4, 10).toISOString() },
						{ kind: 'status', to: 'to-be-verified', at: new Date(2026, 7, 18, 10).toISOString() }
					]
				}),
				issue({ status: 'to-be-verified', createdAt: new Date(2026, 8, 1, 10).toISOString() })
			],
			NOW
		);
		expect(trend[weekOf(7, 3)].verify).toBe(1);
		expect(trend[weekOf(7, 17)].verify).toBe(1);
		expect(trend[weekOf(7, 31)].verify).toBe(1);
		expect(trend.reduce((n, b) => n + b.verify, 0)).toBe(3);
	});
});
