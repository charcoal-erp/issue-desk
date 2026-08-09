import { json } from '@sveltejs/kit';
import type { Issue, IssueFilter, Priority, SessionUser, Source, Status } from '$lib/types';
import { ISSUE_TYPES, PRIORITIES, SOURCES, STATUSES } from '$lib/types';
import { ACTIVE_STATUSES } from '$lib/status';
import { singleIssueMarkdown } from '$lib/export/copyIssue';
import { priorityRank } from '$lib/priority';
import { publicBaseUrl } from '../fs/paths';
import * as store from '../store';

/**
 * Shapes and query parsing shared by the /api/agent/* routes.
 *
 * The agent surface is deliberately separate from the UI's own endpoints: it
 * returns flattened, self-describing objects (names alongside ids, a
 * ready-to-paste Markdown brief) so a Claude Code session can act on one
 * response without a second round-trip to resolve references.
 */

export interface AgentIssueSummary {
	id: string;
	type: string;
	title: string;
	status: Status;
	priority: Priority;
	source: Source;
	app: { id: string; code: string; name: string };
	/** Null when the issue has not been attributed to a module. */
	module: { id: string; code: string; name: string } | null;
	category: { id: string; name: string } | null;
	tags: string[];
	assignee: { id: string; name: string } | null;
	reporter: { id: string; name: string } | null;
	createdAt: string;
	updatedAt: string;
	url: string;
}

export interface AgentIssueDetail extends AgentIssueSummary {
	description: string;
	page?: string;
	form?: string;
	attachments: Array<{ filename: string; mime: string; kind: string; url: string }>;
	comments: Array<{ at: string; by: string; byName: string; message: string }>;
	history: Array<{ at: string; by: string; byName: string; kind: string; from?: string; to?: string }>;
	testCaseId?: string;
	runId?: string;
	/** The same brief the UI's "Copy for Claude Code" button produces. */
	markdown: string;
}

const userName = (id: string | undefined): string =>
	(id && store.users().find((u) => u.id === id)?.name) || id || '';

const ref = (id: string | undefined) => (id ? { id, name: userName(id) } : null);

function issueUrl(issue: Issue): string {
	return `${publicBaseUrl()}/issues/${issue.id}`;
}

export function toSummary(issue: Issue): AgentIssueSummary {
	const category = issue.categoryId
		? store.categories().find((c) => c.id === issue.categoryId)
		: undefined;
	return {
		id: issue.id,
		type: issue.type,
		title: issue.title,
		status: issue.status,
		priority: issue.priority,
		source: issue.source,
		app: { id: issue.appId, code: issue.appCode, name: issue.appName },
		module: issue.moduleId
			? { id: issue.moduleId, code: issue.moduleCode ?? '', name: issue.moduleName ?? issue.moduleId }
			: null,
		// A category removed from config leaves the id behind on the issue; report
		// what it says rather than dropping the field entirely.
		category: issue.categoryId
			? { id: issue.categoryId, name: category?.name ?? issue.categoryId }
			: null,
		tags: issue.tags,
		assignee: ref(issue.assigneeId),
		reporter: ref(issue.reporterId),
		createdAt: issue.createdAt,
		updatedAt: issue.updatedAt,
		url: issueUrl(issue)
	};
}

export function toDetail(issue: Issue): AgentIssueDetail {
	const baseUrl = publicBaseUrl();
	return {
		...toSummary(issue),
		description: issue.description,
		page: issue.pagePath || issue.pageName || undefined,
		form: issue.formName,
		attachments: issue.attachments.map((a) => ({
			filename: a.originalName,
			mime: a.mime,
			kind: a.kind,
			url: a.url.startsWith('/') ? baseUrl + a.url : a.url
		})),
		comments: issue.activity
			.filter((a) => a.kind === 'comment' && a.message)
			.map((a) => ({ at: a.at, by: a.by, byName: userName(a.by), message: a.message! })),
		history: issue.activity
			.filter((a) => a.kind !== 'comment')
			.map((a) => ({ at: a.at, by: a.by, byName: userName(a.by), kind: a.kind, from: a.from, to: a.to })),
		testCaseId: issue.testCaseId,
		runId: issue.runId,
		markdown: singleIssueMarkdown(issue, store.users(), baseUrl)
	};
}

const MAX_PAGE_SIZE = 200;

/**
 * Query → filter for the agent list endpoints.
 *
 * `status` defaults to open + in-progress: an agent asking for work wants
 * things that still need doing, and having to know to exclude `complete`
 * would be an easy and expensive mistake. Backlog is excluded by the same
 * default and deliberately so — parking an issue is how a human says "not
 * now", and an agent should not quietly undo that. Pass `status=` explicitly
 * (any number of times) to override, or `status=all` for everything.
 */
export function parseAgentFilter(url: URLSearchParams): IssueFilter {
	const filter: IssueFilter = {};

	const q = url.get('q')?.trim();
	if (q) filter.q = q;

	// `app`/`module`/`category`/`assignee` are the short spellings; the long
	// ones match the UI's URL params, so a filter copied from the browser works.
	const app = url.get('app') ?? url.get('appId');
	if (app) filter.appId = app;
	const mod = url.get('module') ?? url.get('moduleId');
	if (mod) filter.moduleId = mod;
	const category = url.get('category') ?? url.get('categoryId');
	if (category) filter.categoryId = category;
	const assignee = url.get('assignee') ?? url.get('assigneeId');
	if (assignee) filter.assigneeId = assignee;
	const reporter = url.get('reporter') ?? url.get('reporterId');
	if (reporter) filter.reporterId = reporter;
	const tag = url.get('tag');
	if (tag) filter.tag = tag;

	const sources = url
		.getAll('source')
		.flatMap((s) => s.split(','))
		.map((s) => s.trim())
		.filter((s): s is Source => (SOURCES as readonly string[]).includes(s));
	if (sources.length) filter.source = sources;

	const type = url.get('type');
	if (type && (ISSUE_TYPES as readonly string[]).includes(type)) {
		filter.type = type as IssueFilter['type'];
	}

	const statuses = url
		.getAll('status')
		.flatMap((s) => s.split(','))
		.map((s) => s.trim())
		.filter(Boolean);
	if (statuses.includes('all')) {
		// no status constraint
	} else if (statuses.length) {
		filter.status = statuses.filter((s): s is Status => (STATUSES as readonly string[]).includes(s));
	} else {
		filter.status = ['open', 'in-progress'];
	}

	const priorities = url
		.getAll('priority')
		.flatMap((p) => p.split(','))
		.map((p) => p.trim())
		.filter((p): p is Priority => (PRIORITIES as readonly string[]).includes(p));
	if (priorities.length) filter.priority = priorities;

	const sort = url.get('sort');
	if (sort && ['id', 'title', 'priority', 'status', 'updated', 'created'].includes(sort)) {
		filter.sort = sort as IssueFilter['sort'];
	} else {
		filter.sort = 'priority'; // most urgent first — the order work should be done in
	}
	const dir = url.get('dir');
	if (dir === 'asc' || dir === 'desc') filter.dir = dir;

	const page = Number(url.get('page'));
	filter.page = Number.isInteger(page) && page > 0 ? page : 1;
	const pageSize = Number(url.get('pageSize'));
	filter.pageSize =
		Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, MAX_PAGE_SIZE) : 50;

	return filter;
}

/**
 * Most urgent first, oldest first within a priority — the queue order.
 * `priorityRank` is an index into PRIORITY_ORDER (critical = 0), so ascending
 * rank *is* descending urgency.
 */
export function workOrder(rows: Issue[]): Issue[] {
	return [...rows].sort(
		(a, b) =>
			priorityRank(a.priority) - priorityRank(b.priority) ||
			a.createdAt.localeCompare(b.createdAt)
	);
}

/**
 * Agents may move work forward but not sign it off: `complete` and `rejected`
 * belong to whoever verifies the fix. Humans using the same endpoint keep the
 * full range.
 */
export function mayNotSetStatus(user: SessionUser, status: Status): boolean {
	return user.kind === 'agent' && (status === 'complete' || status === 'rejected');
}

export const notFound = (id: string) =>
	json({ message: `Issue ${id} not found.` }, { status: 404 });

export async function readJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
	// A body-less POST is a legitimate call for endpoints whose fields are all
	// optional (claim, for one), so treat "no body" as an empty object.
	const raw = await request.text();
	if (!raw.trim()) return { ok: true, body: {} };
	try {
		return { ok: true, body: JSON.parse(raw) };
	} catch {
		return { ok: false, response: json({ message: 'Body must be JSON.' }, { status: 400 }) };
	}
}
