// @ts-nocheck
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as config from '$lib/server/store';
import * as issuedesk from '$lib/server/issuedesk';
import { createTestCaseInputSchema } from '$lib/schemas';
import {
	RESULT_STATUSES,
	TEST_CASE_STATUSES,
	TEST_KINDS,
	type ResultStatus,
	type TestCaseFilter,
	type TestKind,
	type TestStep
} from '$lib/types';

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('checkpoint_user');
	return config.users().some((u) => u.id === id) ? id! : (config.users()[0]?.id ?? 'system');
}

function parseFilter(params: URLSearchParams): TestCaseFilter {
	const f: TestCaseFilter = {};
	const q = params.get('q')?.trim();
	if (q) f.q = q;
	if (params.get('app')) f.appId = params.get('app')!;
	const kind = params.getAll('kind').filter((k): k is TestKind => (TEST_KINDS as readonly string[]).includes(k));
	if (kind.length) f.kind = kind;
	const status = params
		.getAll('status')
		.filter((s) => (TEST_CASE_STATUSES as readonly string[]).includes(s)) as TestCaseFilter['status'];
	if (status?.length) f.status = status;
	const result = params
		.getAll('result')
		.filter((r) => r === 'none' || (RESULT_STATUSES as readonly string[]).includes(r)) as (ResultStatus | 'none')[];
	if (result.length) f.lastResult = result;
	return f;
}

export const load = async ({ url }: Parameters<PageServerLoad>[0]) => {
	await cp.ensureLoaded();
	const filter = parseFilter(url.searchParams);

	const rows = cp.listCases(filter).map((c) => {
		const last = cp.lastResultForCase(c.id);
		return {
			id: c.id,
			title: c.title,
			appCode: c.appCode,
			moduleName: c.target.moduleName,
			pageName: c.target.pageName,
			specPath: c.specPath,
			kind: c.kind,
			priority: c.priority,
			status: c.status,
			parentIssueId: c.parentIssueId,
			lastResult: (last?.result.status ?? 'none') as ResultStatus | 'none'
		};
	});

	// Rail counts over the whole case set.
	const all = cp.cases();
	const counts = {
		byApp: {} as Record<string, number>,
		byKind: {} as Record<string, number>,
		byStatus: {} as Record<string, number>,
		byResult: {} as Record<string, number>
	};
	for (const c of all) {
		counts.byApp[c.appId] = (counts.byApp[c.appId] ?? 0) + 1;
		counts.byKind[c.kind] = (counts.byKind[c.kind] ?? 0) + 1;
		counts.byStatus[c.status] = (counts.byStatus[c.status] ?? 0) + 1;
		const key = cp.lastResultForCase(c.id)?.result.status ?? 'none';
		counts.byResult[key] = (counts.byResult[key] ?? 0) + 1;
	}

	// Form reference data.
	const runners = cp.runners().map((r) => ({
		id: r.id,
		name: r.name,
		kind: r.kind,
		command: r.command,
		workingDir: r.workingDir,
		reportFormat: r.reportFormat,
		reportPath: r.reportPath,
		matchStrategy: r.matchStrategy
	}));
	const suites = cp.suites().map((s) => ({ id: s.id, appId: s.appId, name: s.name }));
	// Parent-issue picker: pulled from the central IssueDesk when configured,
	// otherwise empty (a case can still carry a free-text parent id).
	const issues = await issuedesk.listIssues();
	const nextCaseIds = Object.fromEntries(config.applications().map((a) => [a.id, cp.nextCaseId(a.id)]));

	// Detail drawer (URL-driven, shareable).
	const drawerId = url.searchParams.get('case');
	let drawer = null;
	if (drawerId) {
		const c = cp.getCase(drawerId);
		if (c) {
			const last = cp.lastResultForCase(c.id);
			const runner = c.runnerId ? cp.runner(c.runnerId) : undefined;
			const parent = c.parentIssueId ? await issuedesk.getIssue(c.parentIssueId) : null;
			drawer = {
				case: c,
				last: last
					? {
							status: last.result.status,
							message: last.result.message,
							stack: last.result.stack,
							artifacts: last.result.artifacts,
							durationMs: last.result.durationMs,
							runId: last.run.id
						}
					: null,
				runner: runner
					? {
							name: runner.name,
							language: runner.language,
							command: runner.command,
							workingDir: runner.workingDir,
							reportFormat: runner.reportFormat,
							matchStrategy: runner.matchStrategy
						}
					: null,
				parentTitle: parent?.title ?? null,
				suites: c.suiteIds.map((id) => cp.getSuite(id)).filter(Boolean).map((s) => ({ id: s!.id, name: s!.name })),
				filedIssues: c.issueIds
			};
		}
	}

	return { rows, total: rows.length, filter, counts, runners, suites, issues, nextCaseIds, drawer };
};

function parseSteps(raw: string): TestStep[] {
	try {
		const arr = JSON.parse(raw || '[]');
		if (!Array.isArray(arr)) return [];
		return arr
			.map((s) => ({ action: String(s.action ?? ''), expected: String(s.expected ?? '') }))
			.filter((s) => s.action || s.expected);
	} catch {
		return [];
	}
}

function parseJsonArray(raw: FormDataEntryValue | null): string[] {
	try {
		const arr = JSON.parse(String(raw ?? '[]'));
		return Array.isArray(arr) ? arr.map(String) : [];
	} catch {
		return [];
	}
}

function parseCaseForm(form: FormData) {
	const manual = String(form.get('kind') || 'manual') === 'manual';
	return {
		appId: String(form.get('appId') || ''),
		moduleId: String(form.get('moduleId') || ''),
		page: String(form.get('page') || '') || undefined,
		form: String(form.get('form') || '') || undefined,
		title: String(form.get('title') || ''),
		preconditions: String(form.get('preconditions') || '') || undefined,
		steps: parseSteps(String(form.get('steps') || '[]')),
		priority: String(form.get('priority') || 'medium'),
		status: String(form.get('status') || 'active'),
		tags: String(form.get('tags') || '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean),
		kind: String(form.get('kind') || 'manual'),
		runnerId: manual ? null : String(form.get('runnerId') || '') || null,
		specPath: manual ? null : String(form.get('specPath') || '') || null,
		externalTestId: manual ? null : String(form.get('externalTestId') || '') || null,
		parentIssueId: String(form.get('parentIssueId') || '') || null,
		suiteIds: parseJsonArray(form.get('suiteIds'))
	};
}

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? 'form');
		out[key] ??= issue.message;
	}
	return out;
}

export const actions = {
	upsertCase: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '') || undefined;
		const parsed = createTestCaseInputSchema.safeParse(parseCaseForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			const c = id
				? await cp.updateCase(id, parsed.data, actor(cookies))
				: await cp.createCase(parsed.data, actor(cookies));
			return { case: c };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	deprecateCase: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		try {
			await cp.updateCase(id, { status: 'deprecated' }, actor(cookies));
			return { deprecated: id };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	deleteCase: async ({ request }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		try {
			await cp.deleteCase(id);
			return { deleted: id };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	}
};
;null as any as Actions;