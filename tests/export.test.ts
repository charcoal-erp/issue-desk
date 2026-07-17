import { describe, expect, it } from 'vitest';
import { toMarkdown } from '$lib/export/toMarkdown';
import { toJson } from '$lib/export/toJson';
import { humanFilter, type ExportContext } from '$lib/export/context';
import type { Issue } from '$lib/types';
import { SEED_APPS, SEED_USERS } from '$lib/server/store/seed';

const issue: Issue = {
	id: 'CHR-14',
	uuid: '018f-test',
	seq: 14,
	type: 'bug',
	title: 'Login fails with a valid OTP',
	description: 'Entering the correct 6-digit OTP returns "Invalid code".',
	appId: 'charcoal-erp',
	appCode: 'CHR',
	appName: 'Charcoal ERP',
	moduleId: 'auth',
	moduleCode: 'AUTH',
	moduleName: 'Auth',
	pageId: 'login',
	pageName: 'Login',
	pagePath: '/login',
	formId: 'otp',
	formName: 'OTP Verification',
	priority: 'critical',
	status: 'open',
	reporterId: 'priya',
	assigneeId: 'kiran',
	tags: ['auth'],
	attachments: [
		{
			id: 'a1',
			filename: '01-login-screen.png',
			originalName: 'Screenshot.png',
			mime: 'image/png',
			kind: 'image',
			size: 184320,
			url: '/api/files/charcoal-erp/CHR-14/01-login-screen.png',
			uploadedBy: 'priya',
			uploadedAt: '2026-07-16T14:03:00+05:30'
		}
	],
	activity: [],
	createdAt: '2026-07-16T14:03:00+05:30',
	updatedAt: '2026-07-16T14:03:00+05:30'
};

const ctx: ExportContext = {
	baseUrl: 'https://issuedesk.internal',
	generatedAt: new Date('2026-07-17T09:20:00+05:30'),
	filter: { appId: 'charcoal-erp', status: ['open'], priority: ['critical', 'high'] },
	apps: SEED_APPS,
	users: SEED_USERS
};

describe('toMarkdown', () => {
	const md = toMarkdown([issue], ctx);

	it('frames the batch for Claude Code', () => {
		expect(md).toContain('# Fix batch — Charcoal ERP (1 issue)');
		expect(md).toContain('You are fixing reported issues in **Charcoal ERP**.');
		expect(md).toContain('reference the issue ID in your commit message');
	});

	it('renders the human-readable filter line', () => {
		expect(md).toContain('Filter: App = Charcoal ERP · Status = Open · Priority = Critical/High.');
	});

	it('renders a self-contained issue section with context table', () => {
		expect(md).toContain('## CHR-14 · [CRITICAL] Login fails with a valid OTP');
		expect(md).toContain('| **App / Module** | Charcoal ERP / Auth |');
		expect(md).toContain('| **Page / Form**  | /login · OTP Verification |');
		expect(md).toContain('| **Reporter**     | Priya Nair |');
	});

	it('absolutises attachment URLs against the public base', () => {
		expect(md).toContain(
			'- https://issuedesk.internal/api/files/charcoal-erp/CHR-14/01-login-screen.png'
		);
	});
});

describe('toJson', () => {
	const parsed = JSON.parse(toJson([issue], ctx));

	it('carries filter, count and trimmed issues', () => {
		expect(parsed.count).toBe(1);
		expect(parsed.filter).toEqual({
			appId: 'charcoal-erp',
			status: ['open'],
			priority: ['critical', 'high']
		});
		expect(parsed.issues[0]).toMatchObject({
			id: 'CHR-14',
			app: 'Charcoal ERP',
			module: 'Auth',
			page: '/login',
			form: 'OTP Verification',
			reporter: 'Priya Nair',
			assignee: 'Kiran Kharade'
		});
		expect(parsed.issues[0].activity).toBeUndefined(); // trimmed for brevity
	});

	it('absolutises attachment URLs', () => {
		expect(parsed.issues[0].attachments[0]).toBe(
			'https://issuedesk.internal/api/files/charcoal-erp/CHR-14/01-login-screen.png'
		);
	});
});

describe('humanFilter', () => {
	it('falls back to "All issues"', () => {
		expect(humanFilter({ ...ctx, filter: {} })).toBe('All issues');
	});
});
