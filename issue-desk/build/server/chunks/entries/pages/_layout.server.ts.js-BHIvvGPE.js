import { b as private_env } from '../../chunks/shared-server.js-9-2j12mp.js';
import { e as ensureLoaded, n as nextIds, a as settings, b as applications, u as users } from '../../chunks/store.js-B62sRqIC.js';

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

var _layout_server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null,
	load: load
});

export { _layout_server_ts as _ };
//# sourceMappingURL=_layout.server.ts.js-BHIvvGPE.js.map
