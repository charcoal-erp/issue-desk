import { describe, expect, it } from 'vitest';
import {
	isActive,
	matchesQuery,
	matchesRunner,
	matchesSuite,
	type RunnerRow,
	type SuiteRow
} from '$lib/checkpoint/catalogFilters';

const NONE = { q: '', kind: '', env: '', state: '' };

function suite(over: Partial<SuiteRow> = {}): SuiteRow {
	return {
		id: 'SUITE-AUTO-VISUAL',
		name: 'Automated — visual walkthrough',
		description: 'Screenshot audit of every app',
		tags: ['generated:automated', 'requires:simulator-seed'],
		kinds: ['visual'],
		tone: 'visual',
		defaultEnv: 'local',
		lastRun: null,
		...over
	};
}

function runner(over: Partial<RunnerRow> = {}): RunnerRow {
	return {
		id: 'RNR-12',
		name: 'accounting · unit tier',
		kind: 'unit',
		language: 'node',
		command: 'bash ../platform-testing/tools/runners/unit-tier.sh unit-accounting',
		workingDir: 'charcoal/backends',
		reportFormat: 'checkpoint-json',
		enabled: true,
		health: 'healthy',
		...over
	};
}

describe('text matching', () => {
	it('is case-insensitive substring matching for one word', () => {
		expect(matchesQuery('Automated — visual walkthrough', 'VISUAL')).toBe(true);
		expect(matchesQuery('Automated — visual walkthrough', 'manual')).toBe(false);
	});

	it('requires every word, so extra words narrow rather than widen', () => {
		expect(matchesQuery('Automated — visual walkthrough', 'visual walk')).toBe(true);
		expect(matchesQuery('Automated — visual walkthrough', 'visual payroll')).toBe(false);
	});

	it('matches everything when the query is blank', () => {
		expect(matchesQuery('anything', '')).toBe(true);
		expect(matchesQuery('anything', '   ')).toBe(true);
	});
});

describe('suite filter', () => {
	it('searches id, name, description and tags', () => {
		expect(matchesSuite(suite(), { ...NONE, q: 'SUITE-AUTO-VISUAL' })).toBe(true);
		expect(matchesSuite(suite(), { ...NONE, q: 'screenshot' })).toBe(true);
		expect(matchesSuite(suite(), { ...NONE, q: 'simulator-seed' })).toBe(true);
		expect(matchesSuite(suite(), { ...NONE, q: 'payroll' })).toBe(false);
	});

	it('matches a kind the suite contains', () => {
		const mixed = suite({ kinds: ['api', 'e2e'] });
		expect(matchesSuite(mixed, { ...NONE, kind: 'e2e' })).toBe(true);
		expect(matchesSuite(mixed, { ...NONE, kind: 'unit' })).toBe(false);
	});

	it('treats seed as a tone, not a kind', () => {
		// Seeding suites are shell underneath, so filtering by kind would drag in
		// every lint and build suite alongside them.
		const seed = suite({ tone: 'seed', kinds: ['shell'] });
		const lint = suite({ tone: 'shell', kinds: ['shell'] });
		expect(matchesSuite(seed, { ...NONE, kind: 'seed' })).toBe(true);
		expect(matchesSuite(lint, { ...NONE, kind: 'seed' })).toBe(false);
		expect(matchesSuite(seed, { ...NONE, kind: 'shell' })).toBe(true);
	});

	it('filters on the last run’s outcome', () => {
		const failing = suite({ lastRun: { fail: 3, blocked: 0 } });
		const clean = suite({ lastRun: { fail: 0, blocked: 0 } });
		const never = suite({ lastRun: null });
		// Blocked is what the export collects and what the Fix button offers, so
		// it must not fall through the "clean" side of this filter.
		const blocked = suite({ lastRun: { fail: 0, blocked: 2 } });
		expect(matchesSuite(blocked, { ...NONE, state: 'failing' })).toBe(true);
		expect(matchesSuite(blocked, { ...NONE, state: 'passing' })).toBe(false);

		expect(matchesSuite(failing, { ...NONE, state: 'failing' })).toBe(true);
		expect(matchesSuite(clean, { ...NONE, state: 'failing' })).toBe(false);
		expect(matchesSuite(never, { ...NONE, state: 'failing' })).toBe(false);

		expect(matchesSuite(clean, { ...NONE, state: 'passing' })).toBe(true);
		expect(matchesSuite(never, { ...NONE, state: 'passing' })).toBe(false);

		expect(matchesSuite(never, { ...NONE, state: 'never' })).toBe(true);
		expect(matchesSuite(clean, { ...NONE, state: 'never' })).toBe(false);
	});

	it('combines filters with AND', () => {
		const row = suite({ kinds: ['visual'], defaultEnv: 'local', lastRun: { fail: 1, blocked: 0 } });
		expect(matchesSuite(row, { q: 'visual', kind: 'visual', env: 'local', state: 'failing' })).toBe(true);
		expect(matchesSuite(row, { q: 'visual', kind: 'visual', env: 'ci', state: 'failing' })).toBe(false);
	});
});

describe('runner filter', () => {
	it('searches the command, not just the name', () => {
		expect(matchesRunner(runner(), { q: 'unit-tier.sh', kind: '', lang: '', enabled: '', health: '' })).toBe(true);
		expect(matchesRunner(runner(), { q: 'playwright', kind: '', lang: '', enabled: '', health: '' })).toBe(false);
	});

	it('filters by kind, language and health', () => {
		const base = { q: '', kind: '', lang: '', enabled: '', health: '' };
		expect(matchesRunner(runner(), { ...base, kind: 'unit' })).toBe(true);
		expect(matchesRunner(runner(), { ...base, kind: 'visual' })).toBe(false);
		expect(matchesRunner(runner(), { ...base, lang: 'node' })).toBe(true);
		expect(matchesRunner(runner(), { ...base, lang: 'python' })).toBe(false);
		expect(matchesRunner(runner({ health: 'flaky' }), { ...base, health: 'flaky' })).toBe(true);
		expect(matchesRunner(runner(), { ...base, health: 'flaky' })).toBe(false);
	});

	it('separates enabled from disabled', () => {
		const base = { q: '', kind: '', lang: '', health: '' };
		expect(matchesRunner(runner({ enabled: true }), { ...base, enabled: 'on' })).toBe(true);
		expect(matchesRunner(runner({ enabled: true }), { ...base, enabled: 'off' })).toBe(false);
		expect(matchesRunner(runner({ enabled: false }), { ...base, enabled: 'off' })).toBe(true);
		// Blank means both, so a disabled runner is never hidden by default.
		expect(matchesRunner(runner({ enabled: false }), { ...base, enabled: '' })).toBe(true);
	});
});

describe('isActive', () => {
	it('is false only when nothing is set', () => {
		expect(isActive(NONE)).toBe(false);
		expect(isActive({ ...NONE, q: 'x' })).toBe(true);
		expect(isActive({ ...NONE, state: 'failing' })).toBe(true);
	});
});
