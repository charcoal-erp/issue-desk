import type { PageServerLoad } from './$types';
import { parseFilter } from '$lib/filter';
import * as store from '$lib/server/store';

export const load: PageServerLoad = async ({ url }) => {
	await store.ensureLoaded();
	const filter = parseFilter(url.searchParams);
	delete filter.page;
	delete filter.pageSize;
	const { rows, total } = store.list(filter);
	return { rows, total, filter };
};
