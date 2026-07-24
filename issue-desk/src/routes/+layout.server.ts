import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import * as store from '$lib/server/store';

export const load: LayoutServerLoad = async ({ cookies }) => {
	await store.ensureLoaded();
	const users = store.users();
	const cookieUser = cookies.get('issuedesk_user');
	const currentUserId =
		users.find((u) => u.id === cookieUser)?.id ?? users[0]?.id ?? 'system';
	// Optional link back to a Checkpoint instance; unset = no cross-link.
	const checkpointUrl = env.CHECKPOINT_URL?.trim().replace(/\/$/, '') || null;
	return {
		users,
		applications: store.applications(),
		settings: store.settings(),
		currentUserId,
		nextIds: store.nextIds(),
		checkpointUrl
	};
};
