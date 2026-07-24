import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import * as store from '$lib/server/store';

export const load: PageServerLoad = async ({ params }) => {
	await store.ensureLoaded();
	const issue = store.get(params.id);
	if (!issue) error(404, `Issue ${params.id} not found`);
	return { issue };
};
