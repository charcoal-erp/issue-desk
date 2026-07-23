import { describe, expect, it } from 'vitest';
import { dominantKind, kindCounts, runnerTone, suiteTone } from '$lib/checkpoint/tone';

describe('a suite’s tone', () => {
	it('is the kind most of its cases are', () => {
		expect(suiteTone([], kindCounts(['api', 'api', 'api', 'unit']))).toBe('api');
		expect(suiteTone([], kindCounts(['manual', 'manual']))).toBe('manual');
	});

	it('is seed when the suite rebuilds data, whatever its cases are', () => {
		const counts = kindCounts(['shell']);
		expect(suiteTone(['seeding'], counts)).toBe('seed');
		expect(suiteTone(['destructive:all-databases'], counts)).toBe('seed');
		// Resetting a *test* database is routine — 14 suites do it, so it must not
		// claim the warning colour reserved for dropping every platform database.
		expect(suiteTone(['destructive:test-db-reset'], counts)).toBe('shell');
	});

	it('falls back to shell for a suite with no cases', () => {
		expect(suiteTone([], {})).toBe('shell');
	});

	it('does not depend on the order cases were added in', () => {
		const a = suiteTone([], kindCounts(['unit', 'visual', 'unit', 'visual']));
		const b = suiteTone([], kindCounts(['visual', 'unit', 'visual', 'unit']));
		expect(a).toBe(b);
	});
});

describe('dominantKind', () => {
	it('picks the highest count', () => {
		expect(dominantKind({ unit: 2, e2e: 9, api: 4 })).toBe('e2e');
	});

	it('breaks a tie by the fixed tone order, not by insertion', () => {
		expect(dominantKind({ visual: 3, unit: 3 })).toBe('unit');
		expect(dominantKind({ unit: 3, visual: 3 })).toBe('unit');
	});

	it('is null when there is nothing to count', () => {
		expect(dominantKind({})).toBeNull();
		expect(dominantKind({ api: 0 })).toBeNull();
	});
});

describe('a runner’s tone', () => {
	it('is its kind — a runner only ever has one', () => {
		expect(runnerTone('visual')).toBe('visual');
		expect(runnerTone('shell')).toBe('shell');
	});
});
