import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { tallyCounts } from '$lib/counts';
import { parseFilter } from '$lib/filter';
import type { Status } from '$lib/types';
import * as store from '$lib/server/store';

const BACKLOG: Status[] = ['backlog'];

/**
 * The backlog is a view of one status rather than a filter the visitor can
 * widen. Status is pinned before the query reaches the store — and the URL is
 * normalised to carry it, because Export mirrors the address bar to
 * /api/export and would otherwise hand back the whole tracker.
 */
export const load: PageServerLoad = async ({ url }) => {
	await store.ensureLoaded();

	const params = new URLSearchParams(url.searchParams);
	if (params.getAll('status').join() !== 'backlog') {
		params.delete('status');
		params.append('status', 'backlog');
		redirect(307, `/backlog?${params}`);
	}

	const filter = { ...parseFilter(params), status: BACKLOG };
	const { rows, total } = store.list(filter);
	return { rows, total, filter, counts: tallyCounts(store.list({ status: BACKLOG }).rows) };
};
