import * as cp from '$lib/server/store/checkpoint';
import { runCounts } from './metrics';
import type { TestKind } from '$lib/types';

/**
 * Global search across the four Checkpoint entities.
 *
 * The topbar box is the only way into a catalogue of six hundred cases, and
 * "which suite runs the visual walkthrough?" is not a question any single
 * screen's filters answer. Every term must match somewhere in the row, so
 * `visual charcoal` narrows rather than widens — with one-word queries that is
 * plain substring matching, which is what people expect from a search box.
 */
export interface SearchHit {
	id: string;
	title: string;
	sub: string;
	href: string;
	kind?: TestKind;
	badge?: string;
}

export interface SearchGroup {
	key: 'suites' | 'cases' | 'runs' | 'runners';
	label: string;
	hits: SearchHit[];
	total: number;
}

const PER_GROUP = 25;

function matcher(q: string): (haystack: string) => boolean {
	const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
	return (haystack) => {
		const h = haystack.toLowerCase();
		return terms.every((t) => h.includes(t));
	};
}

function group(key: SearchGroup['key'], label: string, hits: SearchHit[]): SearchGroup {
	return { key, label, hits: hits.slice(0, PER_GROUP), total: hits.length };
}

export function searchCheckpoint(query: string): SearchGroup[] {
	const q = query.trim();
	if (!q) return [];
	const hit = matcher(q);

	// Suites first: the coarsest thing you can act on, and usually what someone
	// typing a module name is actually looking for.
	const suites = cp
		.suites()
		.filter((s) => hit(`${s.id} ${s.name} ${s.description ?? ''} ${s.tags.join(' ')} ${s.appName}`))
		.map((s) => ({
			id: s.id,
			title: s.name,
			sub: `${s.caseIds.length} case${s.caseIds.length === 1 ? '' : 's'} · ${s.appName}${s.tags.length ? ` · ${s.tags.slice(0, 3).join(' ')}` : ''}`,
			href: `/suites?edit=${s.id}`
		}));

	const cases = cp
		.cases()
		.filter((c) =>
			hit(
				`${c.id} ${c.title} ${c.specPath ?? ''} ${c.externalTestId ?? ''} ` +
					`${c.target.moduleName} ${c.target.pageName ?? ''} ${c.target.formName ?? ''} ${c.tags.join(' ')}`
			)
		)
		.map((c) => ({
			id: c.id,
			title: c.title,
			sub: [c.target.moduleName, c.target.pageName, c.target.formName].filter(Boolean).join(' › '),
			href: `/cases?case=${c.id}`,
			kind: c.kind
		}));

	const runs = cp
		.runs()
		.filter((r) => hit(`${r.id} ${r.suiteName ?? ''} ${r.environment} ${r.appName} ${r.startedBy}`))
		.map((r) => {
			const counts = runCounts(r);
			return {
				id: r.id,
				title: r.suiteName ?? 'Ad-hoc run',
				sub: `${counts.pass} pass · ${counts.fail} fail · ${r.environment}`,
				href: `/runs/${r.id}`,
				badge: r.archived ? 'archived' : undefined
			};
		});

	const runners = cp
		.runners()
		.filter((r) =>
			hit(`${r.id} ${r.name} ${r.command} ${r.language} ${r.reportFormat} ${r.workingDir}`)
		)
		.map((r) => ({
			id: r.id,
			title: r.name,
			sub: r.command || 'performed by a person',
			href: '/runners',
			kind: r.kind,
			badge: r.enabled ? undefined : 'disabled'
		}));

	return [
		group('suites', 'Suites', suites),
		group('cases', 'Cases', cases),
		group('runs', 'Runs', runs),
		group('runners', 'Runners', runners)
	].filter((g) => g.total > 0);
}
