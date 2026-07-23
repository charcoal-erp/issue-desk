import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import { createSuiteInputSchema } from '$lib/schemas';
import { runPassRate } from '$lib/server/checkpoint/metrics';
import { kindCounts, suiteTone } from '$lib/checkpoint/tone';
import type { TestKind } from '$lib/types';

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('issuedesk_user');
	return store.users().some((u) => u.id === id) ? id! : (store.users()[0]?.id ?? 'system');
}

export const load: PageServerLoad = async ({ url }) => {
	await cp.ensureLoaded();
	const runs = cp.runs();

	// Suite cards with derived stats.
	const cards = cp.suites().map((s) => {
		const cases = s.caseIds.map((id) => cp.getCase(id)).filter(Boolean);
		const allKinds = cases.map((c) => c!.kind);
		const kinds = [...new Set(allKinds)] as TestKind[];
		const manual = cases.filter((c) => c!.kind === 'manual').length;
		const suiteRun = runs.find((r) => r.suiteId === s.id); // runs() is newest-first
		const suiteRuns = runs.filter((r) => r.suiteId === s.id);
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
			runCount: suiteRuns.length,
			archivedRuns: suiteRuns.filter((r) => r.archived).length
		};
	});

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

	return { cards, editor };
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

export const actions: Actions = {
	upsertSuite: async ({ request, cookies }) => {
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

	duplicateSuite: async ({ request, cookies }) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		try {
			const suite = await cp.duplicateSuite(String(form.get('id') || ''), actor(cookies));
			return { suite };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	deleteSuite: async ({ request }) => {
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
