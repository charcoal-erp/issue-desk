import { describe, expect, it } from 'vitest';
import { keywordMatches, tokenize } from '$lib/server/similarity';
import { parseScores } from '$lib/server/ai/duplicates';
import type { Issue } from '$lib/types';

function issue(id: string, title: string, description = '', extra: Partial<Issue> = {}): Issue {
	return { id, title, description, tags: [], appId: 'charcoal', moduleId: 'sales', ...extra } as Issue;
}

const ISSUES = [
	issue('CHR-1', 'Unable to create vendor', 'Saving a new vendor fails with a 500 error.'),
	issue('CHR-2', 'Invoice PDF shows wrong totals', 'Tax is added twice on the printed invoice.'),
	issue('CHR-3', 'Vendor list does not paginate', 'Only the first 20 vendors are shown.'),
	issue('CHR-4', 'Login fails with a valid OTP', 'OTP from SMS is rejected.', { tags: ['authentication', 'otp'] })
];

describe('tokenize', () => {
	it('drops noise words and folds simple inflections', () => {
		expect(tokenize('Unable to create vendors on the page')).toEqual(['creat', 'vendor']);
		// Every form of a word lands on the same stem.
		expect(tokenize('create creating created creates')).toEqual(['creat', 'creat', 'creat', 'creat']);
		expect(tokenize('invoice invoices')).toEqual(['invoic', 'invoic']);
	});
});

describe('keywordMatches', () => {
	it('ranks the closest report first and leaves unrelated ones out', () => {
		const m = keywordMatches({ title: 'Cannot create a vendor', description: 'Save fails' }, ISSUES, 5);
		expect(m[0].issue.id).toBe('CHR-1');
		expect(m.map((x) => x.issue.id)).not.toContain('CHR-2');
		expect(m[0].score).toBeGreaterThan(m[1]?.score ?? 0);
	});

	it('scores an identical report near 100 and shared tags add evidence', () => {
		const same = keywordMatches({ title: 'Invoice PDF shows wrong totals', description: 'Tax is added twice on the printed invoice.' }, ISSUES, 1);
		expect(same[0].issue.id).toBe('CHR-2');
		expect(same[0].score).toBeGreaterThanOrEqual(80);
		const tagged = keywordMatches({ title: 'OTP rejected', tags: ['otp', 'authentication'] }, ISSUES, 1);
		const untagged = keywordMatches({ title: 'OTP rejected' }, ISSUES, 1);
		expect(tagged[0].score).toBeGreaterThan(untagged[0].score);
	});

	it('returns nothing when no words are shared', () => {
		expect(keywordMatches({ title: 'Dark mode colours' }, ISSUES, 5)).toEqual([]);
	});
});

describe('parseScores', () => {
	it('reads the array, tolerating prose or fences around it', () => {
		const s = parseScores('```json\n[{"id":"CHR-1","score":88.4,"reason":"Same failure."}]\n```');
		expect(s.get('CHR-1')).toEqual({ score: 88, reason: 'Same failure.' });
	});

	it('fails closed on anything malformed', () => {
		expect(parseScores('no json here').size).toBe(0);
		expect(parseScores('[{"id":"CHR-1","score":140}]').size).toBe(0);
		expect(parseScores('[{"id":"CHR-1"').size).toBe(0);
	});
});
