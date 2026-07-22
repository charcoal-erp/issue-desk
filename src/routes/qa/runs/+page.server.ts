import type { PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import * as store from '$lib/server/store';
import { runCounts, runPassRate } from '$lib/server/checkpoint/metrics';
import { timeAgo } from '$lib/checkpoint/meta';
import type { TestKind } from '$lib/types';

export const load: PageServerLoad = async () => {
	await cp.ensureLoaded();
	const now = new Date();
	const userName = (id: string) => store.users().find((u) => u.id === id)?.name ?? id;

	const runs = cp.runs().map((run) => {
		const kinds = [
			...new Set(run.results.map((r) => cp.getCase(r.testCaseId)?.kind).filter(Boolean))
		] as TestKind[];
		return {
			id: run.id,
			suiteName: run.suiteName ?? 'Ad-hoc run',
			kinds,
			environment: run.environment,
			by: userName(run.startedBy),
			when: timeAgo(run.startedAt, now),
			counts: runCounts(run),
			passRate: runPassRate(run)
		};
	});

	return { runs };
};
