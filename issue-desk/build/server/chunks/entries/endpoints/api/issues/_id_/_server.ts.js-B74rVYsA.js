import { e as ensureLoaded, q as get } from '../../../../../chunks/store.js-B62sRqIC.js';
import { j as json } from '../../../../../chunks/utils.js-C3Eckavg.js';
import '../../../../../chunks/types.js-CwJArkfF.js';
import '../../../../../chunks/paths.js-Erst5pJ8.js';
import '../../../../../chunks/shared-server.js-9-2j12mp.js';
import 'node:path';
import 'node:fs/promises';
import 'uuid';
import 'zod';
import '../../../../../chunks/shared.js-By7i_rqW.js';
import '../../../../../chunks/server.js-BMijsOvr.js';

//#region src/routes/api/issues/[id]/+server.ts
/**
* GET /api/issues/<id> — resolve one issue's title and status. Used by a
* Checkpoint instance to turn a parent-issue id or a filed-bug id into a real
* title and link. 404 when the id is unknown.
*/
var GET = async ({ params }) => {
	await ensureLoaded();
	const issue = get(params.id);
	if (!issue) return json({ message: `Issue ${params.id} not found.` }, { status: 404 });
	return json({ issue: {
		id: issue.id,
		title: issue.title,
		status: issue.status,
		appId: issue.appId
	} });
};

export { GET };
//# sourceMappingURL=_server.ts.js-B74rVYsA.js.map
