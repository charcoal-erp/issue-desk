import type { LayoutServerLoad } from './$types';
import * as store from '$lib/server/store';

export const load: LayoutServerLoad = async ({ cookies }) => {
	await store.ensureLoaded();
	const users = store.users();
	const cookieUser = cookies.get('issuedesk_user');
	const currentUserId =
		users.find((u) => u.id === cookieUser)?.id ?? users[0]?.id ?? 'system';
	return {
		users,
		applications: store.applications(),
		settings: store.settings(),
		currentUserId,
		nextIds: store.nextIds()
	};
};
