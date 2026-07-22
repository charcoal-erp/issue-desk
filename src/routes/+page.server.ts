import type { PageServerLoad } from './$types';
import * as store from '$lib/server/store';

/**
 * The launcher's live numbers. IssueDesk figures come from the issue store;
 * Checkpoint's are placeholders until its store lands (see the implementation
 * plan, Task 15 wires the real ones).
 */
export const load: PageServerLoad = async () => {
	await store.ensureLoaded();
	const all = store.list({}).rows;
	const open = all.filter((i) => i.status === 'open').length;
	return {
		desk: { open, issues: all.length, apps: store.applications().length },
		qa: { cases: 0, suites: 0, passRate: null as number | null }
	};
};
