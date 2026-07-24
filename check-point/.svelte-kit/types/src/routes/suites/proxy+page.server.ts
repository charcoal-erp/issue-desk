// @ts-nocheck
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import { createSuiteInputSchema } from '$lib/schemas';
import { runCounts, runPassRate } from '$lib/server/checkpoint/metrics';
import { kindCounts, suiteTone } from '$lib/checkpoint/tone';
import { matchesSuite, type SuiteFilter } from '$lib/checkpoint/catalogFilters';
import { timeAgo } from '$lib/checkpoint/meta';
import type { TestKind } from '$lib/types';

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('checkpoint_user');
	return store.users().some((u) => u.id === id) ? id! : (store.users()[0]?.id ?? 'system');
}

export const load = async ({ url }: Parameters<PageServerLoad>[0]) => {
	await cp.ensureLoaded();
	const runs = cp.runs();
	const now = new Date();

	// Suite cards with derived stats.
	const allCards = cp.suites().map((s) => {
		const cases = s.caseIds.map((id) => cp.getCase(id)).filter(Boolean);
		const allKinds = cases.map((c) => c!.kind);
		const kinds = [...new Set(allKinds)] as TestKind[];
		const manual = cases.filter((c) => c!.kind === 'manual').length;
		const suiteRun = runs.find((r) => r.suiteId === s.id); // runs() is newest-first
		const suiteRuns = runs.filter((r) => r.suiteId === s.id);
		const counts = suiteRun ? runCounts(suiteRun) : null;
		return {
			id: s.id,
			appCode: s.appCode,
			appName: s.appName,
			name: s.name,
			description: s.description,
			defaultEnv: s.defaultEnv,
			tags: s.tags,
			kinds,
			tone: suiteTone(s.tags, kindCounts(allKinds)),
			total: cases.length,
			manual,
			automated: cases.length - manual,
			lastPassRate: suiteRun ? runPassRate(suiteRun) : null,
			// The last run's actual numbers, not just its percentage — "3 failed"
			// is what you act on; "94%" is what you report.
			lastRun: suiteRun && counts ? { runId: suiteRun.id, when: timeAgo(suiteRun.startedAt, now), ...counts } : null,
			runCount: suiteRuns.length,
			archivedRuns: suiteRuns.filter((r) => r.archived).length
		};
	});

	const filter: SuiteFilter = {
		q: url.searchParams.get('q') ?? '',
		kind: url.searchParams.get('kind') ?? '',
		env: url.searchParams.get('env') ?? '',
		state: url.searchParams.get('state') ?? ''
	};
	const cards = allCards.filter((c) => matchesSuite(c, filter));

	// Option counts are computed over everything, so a dropdown never hides a
	// choice just because the current filter excludes it.
	const kindCountsAll: Record<string, number> = {};
	for (const c of allCards) {
		for (const k of c.tone === 'seed' ? ['seed', ...c.kinds] : c.kinds) {
			kindCountsAll[k] = (kindCountsAll[k] ?? 0) + 1;
		}
	}
	const envs = [...new Set(allCards.map((c) => c.defaultEnv))].sort();

	// Editor mode data.
	const editId = url.searchParams.get('edit');
	const isNew = url.searchParams.has('new');
	let editor = null;
	if (isNew || editId) {
		const suite = editId ? cp.getSuite(editId) : null;
		editor = {
			suite: suite
				? {
						id: suite.id,
						name: suite.name,
						description: suite.description ?? '',
						appId: suite.appId,
						defaultEnv: suite.defaultEnv,
						tags: suite.tags,
						caseIds: suite.caseIds
					}
				: null,
			allCases: cp.cases().map((c) => ({
				id: c.id,
				appId: c.appId,
				appCode: c.appCode,
				title: c.title,
				kind: c.kind,
				runnerId: c.runnerId
			})),
			runners: cp
				.runners()
				.map((r) => ({ id: r.id, name: r.name, kind: r.kind, command: r.command, enabled: r.enabled })),
			nextId: suite ? null : cp.nextSuiteId(store.applications()[0]?.id ?? 'charcoal')
		};
	}

	return {
		cards,
		editor,
		filter,
		total: allCards.length,
		kindCounts: kindCountsAll,
		envs,
		failingTotal: allCards.filter((c) => c.lastRun && c.lastRun.fail + c.lastRun.blocked > 0).length
	};
};

function parseJsonArray(raw: FormDataEntryValue | null): string[] {
	try {
		const arr = JSON.parse(String(raw ?? '[]'));
		return Array.isArray(arr) ? arr.map(String) : [];
	} catch {
		return [];
	}
}

function parseSuiteForm(form: FormData) {
	return {
		appId: String(form.get('appId') || ''),
		name: String(form.get('name') || ''),
		description: String(form.get('description') || '') || undefined,
		caseIds: parseJsonArray(form.get('caseIds')),
		defaultEnv: String(form.get('defaultEnv') || 'local'),
		tags: String(form.get('tags') || '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean)
	};
}

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
	const out: Record<string, string> = {};
	for (const issue of error.issues) out[String(issue.path[0] ?? 'form')] ??= issue.message;
	return out;
}

export const actions = {
	upsertSuite: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '') || undefined;
		const parsed = createSuiteInputSchema.safeParse(parseSuiteForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			const suite = id
				? await cp.updateSuite(id, parsed.data, actor(cookies))
				: await cp.createSuite(parsed.data, actor(cookies));
			return { suite };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	duplicateSuite: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		try {
			const suite = await cp.duplicateSuite(String(form.get('id') || ''), actor(cookies));
			return { suite };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	deleteSuite: async ({ request }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		try {
			await cp.deleteSuite(String(form.get('id') || ''));
			return { deleted: true };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	}
};
;null as any as Actions;