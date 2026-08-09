import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import * as store from '$lib/server/store';

export const load: LayoutServerLoad = async ({ locals }) => {
	await store.ensureLoaded();
	// /login renders before anyone is signed in; every other route is gated by
	// the auth hook, so `locals.user` is present by the time it loads.
	const currentUser = locals.user;
	// Optional link back to a Checkpoint instance; unset = no cross-link.
	const checkpointUrl = env.CHECKPOINT_URL?.trim().replace(/\/$/, '') || null;
	return {
		users: store.users(),
		applications: store.applications(),
		categories: store.categories(),
		settings: store.settings(),
		currentUser,
		currentUserId: currentUser?.id ?? 'system',
		nextIds: store.nextIds(),
		checkpointUrl
	};
};
