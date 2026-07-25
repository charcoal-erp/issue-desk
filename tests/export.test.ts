import { describe, expect, it } from 'vitest';
import { toMarkdown } from '$lib/export/toMarkdown';
import { toJson } from '$lib/export/toJson';
import { humanFilter, type ExportContext } from '$lib/export/context';
import type { Issue } from '$lib/types';
import { SEED_APPS, SEED_USERS } from '$lib/server/store/seed';

const issue: Issue = {
	id: 'CHR-1',
	uuid: '018f-test',
	seq: 1,
	type: 'bug',
	title: 'Journal entry allows unbalanced debit/credit',
	description: 'Saving a journal where debits ≠ credits should be rejected but is accepted.',
	appId: 'charcoal',
	appCode: 'CHR',
	appName: 'Charcoal',
	moduleId: 'accounting',
	moduleCode: 'ACCT',
	moduleName: 'Accounting',
	pageName: '/accounting/journal',
	pagePath: '/accounting/journal',
	formName: 'Journal Entry',
	priority: 'critical',
	status: 'open',
	reporterId: 'anant',
	assigneeId: 'kiran',
	tags: ['accounting'],
	attachments: [
		{
			id: 'a1',
			filename: '01-journal.png',
			originalName: 'Screenshot.png',
			mime: 'image/png',
			kind: 'image',
			size: 184320,
			url: '/api/files/charcoal/CHR-1/01-journal.png',
			uploadedBy: 'anant',
			uploadedAt: '2026-07-18T14:03:00+05:30'
		}
	],
	activity: [],
	createdAt: '2026-07-18T14:03:00+05:30',
	updatedAt: '2026-07-18T14:03:00+05:30'
};

const ctx: ExportContext = {
	baseUrl: 'https://issuedesk.internal',
	generatedAt: new Date('2026-07-18T09:20:00+05:30'),
	filter: { appId: 'charcoal', status: ['open'], priority: ['critical', 'high'] },
	apps: SEED_APPS,
	users: SEED_USERS
};

describe('toMarkdown', () => {
	const md = toMarkdown([issue], ctx);

	it('frames the batch for Claude Code', () => {
		expect(md).toContain('# Fix batch — Charcoal (1 issue)');
		expect(md).toContain('You are fixing reported issues in **Charcoal**.');
		expect(md).toContain('reference the issue ID in your commit message');
	});

	it('renders the human-readable filter line', () => {
		expect(md).toContain('Filter: App = Charcoal · Status = Open · Priority = Critical/High.');
	});

	it('renders a self-contained issue section with context table', () => {
		expect(md).toContain('## CHR-1 · [CRITICAL] Journal entry allows unbalanced debit/credit');
		expect(md).toContain('| **App / Module** | Charcoal / Accounting |');
		expect(md).toContain('| **Page / Form**  | /accounting/journal · Journal Entry |');
		expect(md).toContain('| **Reporter**     | Anant Kharade |');
	});

	it('absolutises attachment URLs against the public base', () => {
		expect(md).toContain(
			'- https://issuedesk.internal/api/files/charcoal/CHR-1/01-journal.png'
		);
	});
});

describe('toJson', () => {
	const parsed = JSON.parse(toJson([issue], ctx));

	it('carries filter, count and trimmed issues', () => {
		expect(parsed.count).toBe(1);
		expect(parsed.filter).toEqual({
			appId: 'charcoal',
			status: ['open'],
			priority: ['critical', 'high']
		});
		expect(parsed.issues[0]).toMatchObject({
			id: 'CHR-1',
			app: 'Charcoal',
			module: 'Accounting',
			page: '/accounting/journal',
			form: 'Journal Entry',
			reporter: 'Anant Kharade',
			assignee: 'Kiran Kharade'
		});
		expect(parsed.issues[0].activity).toBeUndefined(); // trimmed for brevity
	});

	it('absolutises attachment URLs', () => {
		expect(parsed.issues[0].attachments[0]).toBe(
			'https://issuedesk.internal/api/files/charcoal/CHR-1/01-journal.png'
		);
	});
});

describe('humanFilter', () => {
	it('falls back to "All issues"', () => {
		expect(humanFilter({ ...ctx, filter: {} })).toBe('All issues');
	});
});
