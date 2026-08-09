import { rm } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { seedDataDir } from '$lib/server/store/seed';
import { __wipeForTests } from '$lib/server/auth/credentials';
import { __resetSecretForTests } from '$lib/server/auth/jwt';
import type { CreateIssueInput, SessionUser } from '$lib/types';
import { GET as getMeta } from '../src/routes/api/agent/meta/+server';
import { GET as listIssues } from '../src/routes/api/agent/issues/+server';
import { GET as getIssue } from '../src/routes/api/agent/issues/[id]/+server';
import { POST as claimIssue } from '../src/routes/api/agent/issues/[id]/claim/+server';
import { POST as setStatus } from '../src/routes/api/agent/issues/[id]/status/+server';
import { POST as addComment } from '../src/routes/api/agent/issues/[id]/comment/+server';
import { GET as peekNext, POST as takeNext } from '../src/routes/api/agent/next/+server';

const dir = process.env.DATA_DIR!;

const AGENT: SessionUser = {
	id: 'claude-agent',
	name: 'Claude Agent',
	username: 'claude-agent',
	kind: 'agent',
	admin: false
};
const HUMAN: SessionUser = {
	id: 'kiran',
	name: 'Kiran Kharade',
	username: 'kiran',
	kind: 'human',
	admin: true
};

const base: CreateIssueInput = {
	type: 'bug',
	title: 'Tax computed on discounted subtotal',
	description: 'Steps to reproduce…',
	appId: 'charcoal',
	moduleId: 'accounting',
	priority: 'high',
	status: 'open',
	tags: [],
	attachments: []
};

// Minimal stand-ins for the bits of RequestEvent each handler reads.
const listEvent = (search = '', user = AGENT) =>
	({ url: new URL(`http://x/api/agent/issues${search}`), locals: { user, ingest: false } }) as never;

const idEvent = (id: string, body?: unknown, user = AGENT) =>
	({
		params: { id },
		locals: { user, ingest: false },
		request: new Request('http://x', {
			method: 'POST',
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	}) as never;

const json = async (res: Response) => res.json();

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	await __wipeForTests();
	__resetSecretForTests();
	await seedDataDir();
	await store.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('GET /api/agent/meta', () => {
	it('publishes the filter vocabulary an agent needs', async () => {
		const body = await json(await getMeta(listEvent()));
		expect(body.categories.map((c: { id: string }) => c.id)).toContain('security');
		expect(body.applications[0].modules.length).toBeGreaterThan(0);
		expect(body.agentStatuses).toEqual(['open', 'in-progress', 'to-be-verified']);
		expect(body.statuses).toContain('complete'); // full enum still described
	});
});

describe('GET /api/agent/issues', () => {
	it('defaults to work that still needs doing', async () => {
		await store.create(base, 'kiran');
		const done = await store.create({ ...base, title: 'Already fixed' }, 'kiran');
		await store.update(done.id, { status: 'complete' }, 'kiran');

		const body = await json(await listIssues(listEvent()));
		expect(body.issues.map((i: { title: string }) => i.title)).toEqual([base.title]);
	});

	it('leaves backlog out of the queue — parking is a human decision', async () => {
		await store.create({ ...base, title: 'Parked', status: 'backlog' }, 'kiran');
		await store.create({ ...base, title: 'Live' }, 'kiran');

		const body = await json(await listIssues(listEvent()));
		expect(body.issues.map((i: { title: string }) => i.title)).toEqual(['Live']);

		// Still reachable when asked for by name.
		const parked = await json(await listIssues(listEvent('?status=backlog')));
		expect(parked.issues.map((i: { title: string }) => i.title)).toEqual(['Parked']);
	});

	it('never hands a parked issue to an agent asking for work', async () => {
		await store.create({ ...base, title: 'Parked', status: 'backlog', priority: 'critical' }, 'kiran');
		expect((await takeNext(listEvent())).status).toBe(204);
	});

	it('reports and filters by source', async () => {
		await store.create({ ...base, title: 'By hand' }, 'kiran');
		await store.create({ ...base, title: 'By agent' }, 'claude-agent');

		const all = await json(await listIssues(listEvent()));
		expect(all.issues.map((i: { source: string }) => i.source).sort()).toEqual([
			'agent-testing',
			'manual-testing'
		]);

		const agentOnly = await json(await listIssues(listEvent('?source=agent-testing')));
		expect(agentOnly.issues.map((i: { title: string }) => i.title)).toEqual(['By agent']);
	});

	it('reports a null module for an unattributed issue', async () => {
		await store.create({ ...base, moduleId: undefined }, 'kiran');
		const body = await json(await listIssues(listEvent()));
		expect(body.issues[0].module).toBeNull();
	});

	it('includes everything when asked for status=all', async () => {
		const done = await store.create(base, 'kiran');
		await store.update(done.id, { status: 'complete' }, 'kiran');
		const body = await json(await listIssues(listEvent('?status=all')));
		expect(body.total).toBe(1);
	});

	it('filters by category and by tag independently', async () => {
		await store.create({ ...base, categoryId: 'security', tags: ['login'] }, 'kiran');
		await store.create({ ...base, title: 'Slow report', categoryId: 'performance', tags: [] }, 'kiran');

		const secure = await json(await listIssues(listEvent('?category=security')));
		expect(secure.issues.map((i: { category: { id: string } }) => i.category.id)).toEqual(['security']);

		const tagged = await json(await listIssues(listEvent('?tag=login')));
		expect(tagged.total).toBe(1);

		// The two filters compose rather than override one another.
		const both = await json(await listIssues(listEvent('?category=performance&tag=login')));
		expect(both.total).toBe(0);
	});

	it('filters features apart from bugs', async () => {
		await store.create(base, 'kiran');
		await store.create({ ...base, type: 'feature', title: 'Bulk export' }, 'kiran');
		const body = await json(await listIssues(listEvent('?type=feature')));
		expect(body.issues.map((i: { title: string }) => i.title)).toEqual(['Bulk export']);
	});

	it('orders most urgent first by default', async () => {
		await store.create({ ...base, title: 'Low one', priority: 'low' }, 'kiran');
		await store.create({ ...base, title: 'Critical one', priority: 'critical' }, 'kiran');
		const body = await json(await listIssues(listEvent()));
		expect(body.issues[0].title).toBe('Critical one');
	});

	it('paginates and reports whether more remain', async () => {
		for (let i = 0; i < 3; i++) await store.create({ ...base, title: `Issue ${i}` }, 'kiran');
		const body = await json(await listIssues(listEvent('?pageSize=2')));
		expect(body.issues).toHaveLength(2);
		expect(body.total).toBe(3);
		expect(body.hasMore).toBe(true);
	});

	it('caps pageSize so one call cannot ask for everything', async () => {
		const body = await json(await listIssues(listEvent('?pageSize=99999')));
		expect(body.pageSize).toBe(200);
	});
});

describe('GET /api/agent/issues/[id]', () => {
	it('returns the detail plus a ready-to-use Markdown brief', async () => {
		const issue = await store.create({ ...base, categoryId: 'security' }, 'kiran');
		await store.comment(issue.id, 'Reproduced on staging.', 'anant');

		const body = await json(await getIssue(idEvent(issue.id)));
		expect(body.issue.id).toBe(issue.id);
		expect(body.issue.description).toBe(base.description);
		expect(body.issue.category).toEqual({ id: 'security', name: 'Security' });
		expect(body.issue.comments[0]).toMatchObject({ byName: 'Anant Kharade', message: 'Reproduced on staging.' });
		expect(body.issue.markdown).toContain(issue.id);
		expect(body.issue.markdown).toContain(base.title);
	});

	it('reports a category that has since been deleted from config', async () => {
		const issue = await store.create({ ...base, categoryId: 'security' }, 'kiran');
		await store.removeCategory('security');
		const body = await json(await getIssue(idEvent(issue.id)));
		expect(body.issue.category).toEqual({ id: 'security', name: 'security' });
	});

	it('404s an unknown id', async () => {
		expect((await getIssue(idEvent('CHR-999'))).status).toBe(404);
	});
});

describe('POST /api/agent/issues/[id]/claim', () => {
	it('assigns the issue and moves it to in-progress', async () => {
		const issue = await store.create(base, 'kiran');
		const res = await claimIssue(idEvent(issue.id));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.issue.status).toBe('in-progress');
		expect(body.issue.assignee.id).toBe('claude-agent');
	});

	it('is idempotent for the holder', async () => {
		const issue = await store.create(base, 'kiran');
		await claimIssue(idEvent(issue.id));
		expect((await claimIssue(idEvent(issue.id))).status).toBe(200);
	});

	it('409s when someone else already holds it', async () => {
		const issue = await store.create({ ...base, assigneeId: 'tushar' }, 'kiran');
		const res = await claimIssue(idEvent(issue.id));
		expect(res.status).toBe(409);
		expect((await json(res)).reason).toBe('taken');
	});

	it('409s on work that is already verified or closed', async () => {
		const issue = await store.create(base, 'kiran');
		await store.update(issue.id, { status: 'complete' }, 'kiran');
		const res = await claimIssue(idEvent(issue.id));
		expect(res.status).toBe(409);
		expect((await json(res)).reason).toBe('not-claimable');
	});

	it('gives one issue to exactly one of two simultaneous claimants', async () => {
		const issue = await store.create(base, 'kiran');
		const [a, b] = await Promise.all([
			claimIssue(idEvent(issue.id, undefined, AGENT)),
			claimIssue(idEvent(issue.id, undefined, { ...AGENT, id: 'tushar', username: 'tushar' }))
		]);
		const codes = [a.status, b.status].sort();
		expect(codes).toEqual([200, 409]);
	});

	it('records an optional note alongside the claim', async () => {
		const issue = await store.create(base, 'kiran');
		const body = await json(await claimIssue(idEvent(issue.id, { comment: 'Picking this up.' })));
		expect(body.issue.comments.at(-1)?.message).toBe('Picking this up.');
	});
});

describe('POST /api/agent/issues/[id]/status', () => {
	it('hands a finished fix to a tester', async () => {
		const issue = await store.create(base, 'kiran');
		const body = await json(
			await setStatus(idEvent(issue.id, { status: 'to-be-verified', comment: 'Fixed in a1b2c3d.' }))
		);
		expect(body.issue.status).toBe('to-be-verified');
		expect(body.issue.comments.at(-1)?.message).toBe('Fixed in a1b2c3d.');
		// The comment lands before the transition, so the timeline reads in order.
		expect(body.issue.history.at(-1)).toMatchObject({ kind: 'status', to: 'to-be-verified' });
	});

	it('refuses to let an agent sign off its own work', async () => {
		const issue = await store.create(base, 'kiran');
		for (const status of ['complete', 'rejected']) {
			const res = await setStatus(idEvent(issue.id, { status }));
			expect(res.status).toBe(403);
			expect((await json(res)).message).toMatch(/tester|cannot set/i);
		}
		expect(store.get(issue.id)!.status).toBe('open');
	});

	it('lets a human set the same status through the same endpoint', async () => {
		const issue = await store.create(base, 'kiran');
		const res = await setStatus(idEvent(issue.id, { status: 'to-be-verified' }, HUMAN));
		expect(res.status).toBe(200);
	});

	it('lets a human verify — the restriction is on agents, not on the route', async () => {
		const issue = await store.create(base, 'kiran');
		for (const status of ['complete', 'rejected']) {
			const res = await setStatus(idEvent(issue.id, { status }, HUMAN));
			expect(res.status).toBe(200);
			expect((await json(res)).issue.status).toBe(status);
		}
	});

	it('400s an unrecognised status', async () => {
		const issue = await store.create(base, 'kiran');
		expect((await setStatus(idEvent(issue.id, { status: 'banana' }))).status).toBe(400);
	});

	it('404s an unknown issue before reading the body', async () => {
		expect((await setStatus(idEvent('CHR-999', { status: 'in-progress' }))).status).toBe(404);
	});
});

describe('POST /api/agent/issues/[id]/comment', () => {
	it('attributes the note to the agent account', async () => {
		const issue = await store.create(base, 'kiran');
		const body = await json(await addComment(idEvent(issue.id, { message: 'Root cause: rounding.' })));
		expect(body.issue.comments.at(-1)).toMatchObject({ by: 'claude-agent', message: 'Root cause: rounding.' });
	});

	it('rejects an empty comment', async () => {
		const issue = await store.create(base, 'kiran');
		expect((await addComment(idEvent(issue.id, { message: '   ' }))).status).toBe(400);
	});
});

describe('/api/agent/next', () => {
	it('peeks without taking', async () => {
		await store.create(base, 'kiran');
		const body = await json(await peekNext(listEvent()));
		expect(body.issue.status).toBe('open');
		expect(body.remaining).toBe(1);
		expect(store.get(body.issue.id)!.assigneeId).toBeUndefined();
	});

	it('claims the most urgent issue in the category', async () => {
		await store.create({ ...base, title: 'Low security', categoryId: 'security', priority: 'low' }, 'kiran');
		await store.create({ ...base, title: 'Critical security', categoryId: 'security', priority: 'critical' }, 'kiran');
		await store.create({ ...base, title: 'Critical elsewhere', categoryId: 'performance', priority: 'critical' }, 'kiran');

		const body = await json(await takeNext(listEvent('?category=security')));
		expect(body.issue.title).toBe('Critical security');
		expect(body.issue.status).toBe('in-progress');
		expect(body.remaining).toBe(1);
	});

	it('skips work another agent holds', async () => {
		await store.create({ ...base, title: 'Taken', assigneeId: 'tushar', priority: 'critical' }, 'kiran');
		await store.create({ ...base, title: 'Free', priority: 'low' }, 'kiran');
		const body = await json(await takeNext(listEvent()));
		expect(body.issue.title).toBe('Free');
	});

	it('204s when the queue is empty — the loop\'s stop condition', async () => {
		expect((await takeNext(listEvent())).status).toBe(204);
	});

	it('never hands the same issue to two agents at once', async () => {
		await store.create(base, 'kiran');
		const other = { ...AGENT, id: 'tushar', username: 'tushar' };
		const [a, b] = await Promise.all([
			takeNext(listEvent('', AGENT)),
			takeNext(listEvent('', other))
		]);
		expect([a.status, b.status].sort()).toEqual([200, 204]);
	});

	it('works through a category one issue at a time until it is drained', async () => {
		for (let i = 0; i < 3; i++) {
			await store.create({ ...base, title: `Security ${i}`, categoryId: 'security' }, 'kiran');
		}
		const worked: string[] = [];
		for (;;) {
			const res = await takeNext(listEvent('?category=security'));
			if (res.status === 204) break;
			const { issue } = await json(res);
			await setStatus(idEvent(issue.id, { status: 'to-be-verified', comment: 'Done.' }));
			worked.push(issue.id);
			if (worked.length > 5) throw new Error('loop did not terminate');
		}
		expect(worked).toHaveLength(3);
		// Everything is now waiting on a human, and nothing was auto-completed.
		const left = store.list({ categoryId: 'security' }).rows;
		expect(left.every((i) => i.status === 'to-be-verified')).toBe(true);
	});
});
