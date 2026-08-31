import { describe, expect, it } from 'vitest';
import { toMarkdown } from '$lib/export/toMarkdown';
import { singleIssueMarkdown } from '$lib/export/copyIssue';
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
	source: 'manual-testing',
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
	activity: [
		{ id: 'e1', at: '2026-07-18T14:03:00+05:30', by: 'anant', kind: 'created' },
		{
			id: 'e2',
			at: '2026-07-18T15:10:00+05:30',
			by: 'kiran',
			kind: 'comment',
			message: 'Root cause: rounding runs before the discount.'
		},
		{ id: 'e3', at: '2026-07-18T16:00:00+05:30', by: 'kiran', kind: 'status', to: 'in-progress' }
	],
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

describe('single-issue copy', () => {
	it('carries comments with their author under "Comments and progress"', () => {
		const md = singleIssueMarkdown(issue, SEED_USERS, 'https://desk.example.com');
		expect(md).toContain('**Comments and progress**');
		expect(md).toContain('Root cause: rounding runs before the discount.');
		// Attributed to a person, not left anonymous.
		const who = SEED_USERS.find((u) => u.id === 'kiran')?.name ?? 'kiran';
		expect(md).toContain(`**${who}**`);
	});

	it('carries the activity trace', () => {
		const md = singleIssueMarkdown(issue, SEED_USERS, 'https://desk.example.com');
		expect(md).toContain('**Activity trace**');
		expect(md).toContain('created this issue');
		expect(md).toContain('Status moved to **In-progress**');
	});

	it('keeps the comment body out of the trace, so nothing is said twice', () => {
		const md = singleIssueMarkdown(issue, SEED_USERS, 'https://desk.example.com');
		const trace = md.slice(md.indexOf('**Activity trace**'));
		expect(trace).not.toContain('Root cause');
	});
});

describe('batch export', () => {
	it('includes the discussion but not the field-change log', () => {
		const md = toMarkdown([issue], ctx);
		expect(md).toContain('**Comments and progress**');
		expect(md).not.toContain('**Activity trace**');
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
