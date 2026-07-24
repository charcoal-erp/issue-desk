import type { LayoutServerLoad } from './$types';
import * as config from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { configuredUrl } from '$lib/server/issuedesk';
import { planLaunch, unrunnableKinds } from '$lib/server/checkpoint/launch';
import { activeRunId } from '$lib/server/checkpoint/runtime';
import type { TestCase, TestKind } from '$lib/types';

/** Shared Checkpoint data for the header + the global Launch modal. */
export const load: LayoutServerLoad = async ({ cookies }) => {
	await config.ensureLoaded();
	await cp.ensureLoaded();
	const runners = cp.runners();

	const users = config.users();
	const cookieUser = cookies.get('checkpoint_user');
	const currentUserId = users.find((u) => u.id === cookieUser)?.id ?? users[0]?.id ?? 'system';

	const launchSuites = cp.suites().map((s) => {
		const cases = s.caseIds.map((id) => cp.getCase(id)).filter(Boolean) as TestCase[];
		const kinds = [...new Set(cases.map((c) => c.kind))] as TestKind[];
		// Planned with the same function the launch endpoint uses, so the
		// execution preview can never promise something else.
		const plan = planLaunch(cases, kinds, runners);
		return {
			id: s.id,
			appName: s.appName,
			name: s.name,
			description: s.description,
			defaultEnv: s.defaultEnv,
			tags: s.tags,
			caseCount: cases.length,
			kinds,
			kindCounts: Object.fromEntries(
				kinds.map((k) => [k, cases.filter((c) => c.kind === k).length])
			) as Record<TestKind, number>,
			groups: plan.groups.map((g) => ({
				runnerId: g.runner.id,
				name: g.runner.name,
				kind: g.runner.kind,
				command: g.runner.command,
				workingDir: g.runner.workingDir,
				reportFormat: g.runner.reportFormat,
				reportPath: g.runner.reportPath,
				count: g.cases.length
			})),
			unrunnable: unrunnableKinds(plan, cases),
			manualCount: plan.manualCases.length
		};
	});

	// Exposed app-wide so any page/component can resolve issue links and hide the
	// "file a bug" affordances when no central IssueDesk is configured.
	const issuedeskUrl = configuredUrl();

	return {
		launchSuites,
		activeRunId: activeRunId() ?? null,
		users,
		applications: config.applications(),
		currentUserId,
		issuedeskUrl,
		issuedeskConfigured: issuedeskUrl !== null
	};
};
