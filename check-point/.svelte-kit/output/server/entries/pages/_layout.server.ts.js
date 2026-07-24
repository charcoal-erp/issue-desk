import { F as ensureLoaded, I as users, P as applications, T as runners, k as suites, m as getCase, p as ensureLoaded$1 } from "../../chunks/checkpoint.js";
import { t as configuredUrl } from "../../chunks/issuedesk.js";
import { n as planLaunch, r as unrunnableKinds } from "../../chunks/launch.js";
import { t as activeRunId } from "../../chunks/runtime.js";
//#region src/routes/+layout.server.ts
/** Shared Checkpoint data for the header + the global Launch modal. */
var load = async ({ cookies }) => {
	await ensureLoaded();
	await ensureLoaded$1();
	const runners$1 = runners();
	const users$1 = users();
	const cookieUser = cookies.get("checkpoint_user");
	const currentUserId = users$1.find((u) => u.id === cookieUser)?.id ?? users$1[0]?.id ?? "system";
	const launchSuites = suites().map((s) => {
		const cases = s.caseIds.map((id) => getCase(id)).filter(Boolean);
		const kinds = [...new Set(cases.map((c) => c.kind))];
		const plan = planLaunch(cases, kinds, runners$1);
		return {
			id: s.id,
			appName: s.appName,
			name: s.name,
			description: s.description,
			defaultEnv: s.defaultEnv,
			tags: s.tags,
			caseCount: cases.length,
			kinds,
			kindCounts: Object.fromEntries(kinds.map((k) => [k, cases.filter((c) => c.kind === k).length])),
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
	const issuedeskUrl = configuredUrl();
	return {
		launchSuites,
		activeRunId: activeRunId() ?? null,
		users: users$1,
		applications: applications(),
		currentUserId,
		issuedeskUrl,
		issuedeskConfigured: issuedeskUrl !== null
	};
};
//#endregion
export { load };
