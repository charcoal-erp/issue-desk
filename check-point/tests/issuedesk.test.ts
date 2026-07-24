import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as issuedesk from '$lib/server/issuedesk';

const payload = {
	type: 'bug' as const,
	title: 'Tax wrong',
	description: 'd',
	appId: 'charcoal',
	moduleId: 'accounting',
	priority: 'high',
	status: 'open',
	tags: ['from-test'],
	attachments: [] as never[]
};

describe('IssueDesk client — standalone (ISSUEDESK_URL unset)', () => {
	beforeEach(() => {
		delete process.env.ISSUEDESK_URL;
		delete process.env.ISSUEDESK_TOKEN;
	});

	it('reports not configured and yields no links', () => {
		expect(issuedesk.isConfigured()).toBe(false);
		expect(issuedesk.configuredUrl()).toBeNull();
		expect(issuedesk.issueUrl('CHR-1')).toBeNull();
	});

	it('never calls the network when unconfigured', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		expect(await issuedesk.getIssue('CHR-1')).toBeNull();
		expect(await issuedesk.listIssues()).toEqual([]);
		await expect(issuedesk.createIssue(payload, 'kiran')).rejects.toThrow(/No IssueDesk/);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});

describe('IssueDesk client — configured', () => {
	beforeEach(() => {
		process.env.ISSUEDESK_URL = 'http://issuedesk.test/';
		process.env.ISSUEDESK_TOKEN = 'secret';
	});
	afterEach(() => {
		delete process.env.ISSUEDESK_URL;
		delete process.env.ISSUEDESK_TOKEN;
		vi.restoreAllMocks();
	});

	it('builds issue links from the configured base', () => {
		expect(issuedesk.isConfigured()).toBe(true);
		expect(issuedesk.issueUrl('CHR-1')).toBe('http://issuedesk.test/issues/CHR-1');
	});

	it('POSTs the payload plus reporterId with the bearer token', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ issue: { id: 'CHR-9' } }), { status: 201 })
		);
		const res = await issuedesk.createIssue(payload, 'kiran');
		expect(res).toEqual({ id: 'CHR-9' });

		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('http://issuedesk.test/api/issues');
		expect((init!.headers as Record<string, string>).authorization).toBe('Bearer secret');
		const body = JSON.parse(init!.body as string);
		expect(body).toMatchObject({ title: 'Tax wrong', appId: 'charcoal', reporterId: 'kiran' });
	});

	it('surfaces an IssueDesk rejection as a readable error', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('Unknown reporter', { status: 400 })
		);
		await expect(issuedesk.createIssue(payload, 'ghost')).rejects.toThrow(/rejected the issue \(400\)/);
	});

	it('resolves an issue title, and returns null on 404', async () => {
		const spy = vi.spyOn(globalThis, 'fetch');
		spy.mockResolvedValueOnce(
			new Response(JSON.stringify({ issue: { id: 'CHR-1', title: 'Tax bug', status: 'open' } }), { status: 200 })
		);
		expect(await issuedesk.getIssue('CHR-1')).toMatchObject({ id: 'CHR-1', title: 'Tax bug' });

		spy.mockResolvedValueOnce(new Response('nope', { status: 404 }));
		expect(await issuedesk.getIssue('CHR-999')).toBeNull();
	});

	it('treats an unreachable IssueDesk as simply absent, not an error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
		expect(await issuedesk.getIssue('CHR-1')).toBeNull();
		expect(await issuedesk.listIssues()).toEqual([]);
	});
});
