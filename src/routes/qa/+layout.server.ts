import type { LayoutServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import type { TestKind } from '$lib/types';

/** Shared Checkpoint data for the global Launch modal (reachable from any screen). */
export const load: LayoutServerLoad = async () => {
	await cp.ensureLoaded();

	const launchRunners = cp.runners().map((r) => ({
		id: r.id,
		name: r.name,
		kind: r.kind,
		command: r.command,
		workingDir: r.workingDir,
		reportFormat: r.reportFormat,
		reportPath: r.reportPath,
		enabled: r.enabled
	}));

	const launchSuites = cp.suites().map((s) => {
		const cases = s.caseIds.map((id) => cp.getCase(id)).filter(Boolean);
		const kinds = [...new Set(cases.map((c) => c!.kind))] as TestKind[];
		return {
			id: s.id,
			appName: s.appName,
			name: s.name,
			defaultEnv: s.defaultEnv,
			caseCount: cases.length,
			kinds,
			kindCounts: Object.fromEntries(kinds.map((k) => [k, cases.filter((c) => c!.kind === k).length])) as Record<TestKind, number>
		};
	});

	return { launchSuites, launchRunners };
};
