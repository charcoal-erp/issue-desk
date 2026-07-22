import type { PageServerLoad } from './$types';
import * as store from '$lib/server/store';
import * as cp from '$lib/server/store/checkpoint';
import { dashboardKpis } from '$lib/server/checkpoint/metrics';

/** The launcher's live numbers for both workspaces. */
export const load: PageServerLoad = async () => {
	await store.ensureLoaded();
	await cp.ensureLoaded();

	const all = store.list({}).rows;
	const open = all.filter((i) => i.status === 'open').length;

	const cases = cp.cases();
	const kpis = dashboardKpis(cases, cp.runs(), cp.runners(), new Date());

	return {
		desk: { open, issues: all.length, apps: store.applications().length },
		qa: { cases: cases.length, suites: cp.suites().length, passRate: kpis.passRatePct }
	};
};
