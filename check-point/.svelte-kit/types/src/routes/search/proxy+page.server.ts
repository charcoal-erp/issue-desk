// @ts-nocheck
import type { PageServerLoad } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import { searchCheckpoint } from '$lib/server/checkpoint/search';

export const load = async ({ url }: Parameters<PageServerLoad>[0]) => {
	await cp.ensureLoaded();
	const q = url.searchParams.get('q') ?? '';
	const groups = searchCheckpoint(q);
	return { q, groups, total: groups.reduce((n, g) => n + g.total, 0) };
};
