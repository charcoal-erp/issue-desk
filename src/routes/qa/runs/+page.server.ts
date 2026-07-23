import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import { runCounts, runPassRate } from '$lib/server/checkpoint/metrics';
import { isRunActive } from '$lib/server/checkpoint/runtime';
import { timeAgo } from '$lib/checkpoint/meta';
import { AGE_WINDOWS, cutoffIso, inWindow } from '$lib/checkpoint/runFilters';
import type { TestKind, TestRun } from '$lib/types';

export const load: PageServerLoad = async ({ url }) => {
	await cp.ensureLoaded();
	const now = new Date();
	const userName = (id: string) => store.users().find((u) => u.id === id)?.name ?? id;

	const age = url.searchParams.get('age') ?? 'all';
	const suiteId = url.searchParams.get('suite') ?? '';
	const outcome = url.searchParams.get('outcome') ?? '';

	const all = cp.runs();
	const filtered = all.filter((run) => {
		if (!inWindow(run, age, now)) return false;
		if (suiteId && run.suiteId !== suiteId) return false;
		if (outcome) {
			const counts = runCounts(run);
			if (outcome === 'failing' && counts.fail === 0) return false;
			if (outcome === 'passing' && counts.fail > 0) return false;
		}
		return true;
	});

	const project = (run: TestRun) => {
		const kinds = [
			...new Set(run.results.map((r) => cp.getCase(r.testCaseId)?.kind).filter(Boolean))
		] as TestKind[];
		return {
			id: run.id,
			suiteId: run.suiteId ?? null,
			suiteName: run.suiteName ?? 'Ad-hoc run',
			kinds,
			environment: run.environment,
			by: userName(run.startedBy),
			when: timeAgo(run.startedAt, now),
			startedAt: run.startedAt,
			counts: runCounts(run),
			passRate: runPassRate(run),
			archived: !!run.archived,
			running: isRunActive(run.id),
			completed: !!run.completedAt
		};
	};

	// Counts per tab, computed over the other active filters so the numbers
	// match what clicking the tab will show.
	const scoped = all.filter(
		(r) => (!suiteId || r.suiteId === suiteId) && (!outcome || true)
	);
	const tabs = [
		{ key: 'all', label: 'All', count: scoped.length },
		...AGE_WINDOWS.map((w) => ({
			key: w.key,
			label: w.label,
			count: scoped.filter((r) => inWindow(r, w.key, now)).length
		})),
		{ key: 'archived', label: 'Archived', count: scoped.filter((r) => r.archived).length }
	];

	const suites = cp
		.suites()
		.map((s) => ({ id: s.id, name: s.name, runs: all.filter((r) => r.suiteId === s.id).length }))
		.filter((s) => s.runs > 0)
		.sort((a, b) => b.runs - a.runs);

	return {
		runs: filtered.map(project),
		tabs,
		suites,
		filter: { age, suiteId, outcome },
		archivedTotal: all.filter((r) => r.archived).length
	};
};

export const actions: Actions = {
	archiveRun: async ({ request }) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const archived = form.get('archived') === 'true';
		try {
			await cp.setRunArchived(id, archived);
			return { ok: true, archived };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	deleteRun: async ({ request }) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		try {
			await cp.deleteRun(String(form.get('id') || ''));
			return { ok: true };
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	},

	/**
	 * Prune by age, honouring the suite filter so one noisy suite can be cleaned
	 * without touching the rest. Archived and still-running runs are never
	 * deleted — that guarantee lives in the store, not here.
	 */
	cleanup: async ({ request }) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const hours = Number(form.get('hours') || 0);
		const date = String(form.get('date') || '');
		const suiteId = String(form.get('suite') || '') || undefined;

		let before: string;
		if (date) {
			const parsed = new Date(date);
			if (Number.isNaN(parsed.getTime())) return fail(400, { error: 'Unusable date' });
			before = parsed.toISOString();
		} else if (hours > 0) {
			before = cutoffIso(hours);
		} else {
			return fail(400, { error: 'Choose an age or a date to clean up before' });
		}

		const removed = await cp.pruneRuns({ before, suiteId });
		return { ok: true, removed: removed.length };
	}
};
