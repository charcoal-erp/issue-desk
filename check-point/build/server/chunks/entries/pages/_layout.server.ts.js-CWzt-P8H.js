import { b as ensureLoaded$1, e as ensureLoaded, c as suites, g as getCase, f as applications, u as users, h as runners } from '../../chunks/checkpoint.js-B-fQV2Ix.js';
import { c as configuredUrl } from '../../chunks/issuedesk.js-BR4NRlVK.js';
import { p as planLaunch, u as unrunnableKinds } from '../../chunks/launch.js-CepkRNc9.js';
import { a as activeRunId } from '../../chunks/runtime.js-BLT4IyOS.js';

//#region src/routes/+layout.server.ts
/** Shared Checkpoint data for the header + the global Launch modal. */
var load = async ({ cookies }) => {
	await ensureLoaded$1();
	await ensureLoaded();
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

var _layout_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	load: load
});

export { _layout_server_ts as _ };
//# sourceMappingURL=_layout.server.ts.js-CWzt-P8H.js.map
