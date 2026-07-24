import path from 'node:path';
import { dataDir } from '$lib/server/fs/paths';

// The suite wipes and reseeds DATA_DIR wholesale. A .env with DATA_DIR=./data
// once outranked the test override and pointed that at the real data dir, so
// every `npm test` quietly wrote seed issues into it. Fail loudly instead.
const resolved = dataDir();
const repo = process.cwd();
if (resolved === repo || resolved.startsWith(repo + path.sep)) {
	throw new Error(
		`Refusing to run: DATA_DIR resolves to ${resolved}, inside the repo — the suite ` +
			`deletes this directory. Check .env.test (it must outrank .env in test mode).`
	);
}
