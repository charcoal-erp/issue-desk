import { t as private_env } from "../../chunks/shared-server.js";
import { h as users, i as ensureLoaded, s as nextIds, t as applications, u as settings } from "../../chunks/store.js";
//#region src/routes/+layout.server.ts
var load = async ({ cookies }) => {
	await ensureLoaded();
	const users$1 = users();
	const cookieUser = cookies.get("issuedesk_user");
	const currentUserId = users$1.find((u) => u.id === cookieUser)?.id ?? users$1[0]?.id ?? "system";
	const checkpointUrl = private_env.CHECKPOINT_URL?.trim().replace(/\/$/, "") || null;
	return {
		users: users$1,
		applications: applications(),
		settings: settings(),
		currentUserId,
		nextIds: nextIds(),
		checkpointUrl
	};
};
//#endregion
export { load };
