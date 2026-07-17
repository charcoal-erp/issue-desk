import type { PageServerLoad } from './$types';
import * as store from '$lib/server/store';

export const load: PageServerLoad = async () => {
	await store.ensureLoaded();
	const all = store.list({ sort: 'updated', dir: 'desc' }).rows;
	return { issues: all };
};
