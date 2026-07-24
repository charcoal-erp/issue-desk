// @ts-nocheck
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import { createRunnerInputSchema } from '$lib/schemas';
import { runnerHealth } from '$lib/server/checkpoint/metrics';
import { formatDuration, matchStrategyLabel, timeAgo } from '$lib/checkpoint/meta';
import { matchesRunner, type RunnerFilter } from '$lib/checkpoint/catalogFilters';
import type { MatchStrategy } from '$lib/types';

export const load = async ({ url }: Parameters<PageServerLoad>[0]) => {
	await cp.ensureLoaded();
	const runs = cp.runs();
	const now = new Date();

	const allRunners = cp.runners().map((r) => {
		const h = runnerHealth(r, runs);
		return {
			...r,
			matchLabel: matchStrategyLabel(r.matchStrategy),
			health: h.health,
			avgLabel: formatDuration(h.avgDurationMs),
			flakeRatePct: h.flakeRatePct,
			lastLabel:
				h.lastOutcome && h.lastInvocationAt ? `${timeAgo(h.lastInvocationAt, now)} · ${h.lastOutcome}` : 'no runs'
		};
	});

	const filter: RunnerFilter = {
		q: url.searchParams.get('q') ?? '',
		kind: url.searchParams.get('kind') ?? '',
		lang: url.searchParams.get('lang') ?? '',
		enabled: url.searchParams.get('enabled') ?? '',
		health: url.searchParams.get('health') ?? ''
	};
	const runners = allRunners.filter((r) => matchesRunner(r, filter));

	// Counted over everything, so a dropdown never hides a choice merely because
	// the current filter excludes it.
	const tally = (pick: (r: (typeof allRunners)[number]) => string) => {
		const out: Record<string, number> = {};
		for (const r of allRunners) out[pick(r)] = (out[pick(r)] ?? 0) + 1;
		return out;
	};

	return {
		runners,
		filter,
		total: allRunners.length,
		kindCounts: tally((r) => r.kind),
		langCounts: tally((r) => r.language),
		disabledTotal: allRunners.filter((r) => !r.enabled).length
	};
};

function parseEnv(raw: string): Record<string, string> | undefined {
	const out: Record<string, string> = {};
	for (const line of raw.split(/\r?\n/)) {
		const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (m) out[m[1]] = m[2];
	}
	return Object.keys(out).length ? out : undefined;
}

function parseRunnerForm(form: FormData) {
	const by = String(form.get('matchBy') || 'nodeid');
	const matchStrategy: MatchStrategy =
		by === 'annotation' ? { by: 'annotation', tag: String(form.get('matchTag') || '@checkpoint') } : ({ by } as MatchStrategy);
	const timeoutRaw = Number(form.get('timeoutSec'));
	return {
		name: String(form.get('name') || ''),
		kind: String(form.get('kind') || 'api'),
		language: String(form.get('language') || 'other'),
		command: String(form.get('command') || ''),
		workingDir: String(form.get('workingDir') || ''),
		env: parseEnv(String(form.get('env') || '')),
		reportFormat: String(form.get('reportFormat') || 'junit-xml'),
		reportPath: String(form.get('reportPath') || ''),
		matchStrategy,
		timeoutSec: Number.isInteger(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : undefined,
		enabled: form.get('enabled') === 'on' || form.get('enabled') === 'true'
	};
}

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
	const out: Record<string, string> = {};
	for (const issue of error.issues) out[String(issue.path[0] ?? 'form')] ??= issue.message;
	return out;
}

export const actions = {
	upsertRunner: async ({ request }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '') || undefined;
		const parsed = createRunnerInputSchema.safeParse(parseRunnerForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			const runner = id ? await cp.updateRunner(id, parsed.data) : await cp.createRunner(parsed.data);
			return { runner };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	toggleRunner: async ({ request }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		try {
			await cp.toggleRunner(String(form.get('id') || ''), form.get('enabled') === 'true');
			return { ok: true };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	deleteRunner: async ({ request }: import('./$types').RequestEvent) => {
		await cp.ensureLoaded();
		const form = await request.formData();
		try {
			await cp.deleteRunner(String(form.get('id') || ''));
			return { ok: true };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	}
};
;null as any as Actions;