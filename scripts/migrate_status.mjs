#!/usr/bin/env node
/**
 * One-time status migration: "implemented" → "in-progress".
 *
 * Rewrites every issue's `status` field and any activity `from`/`to` values
 * across data/issues/<app>/<module>.json. Logs each file and issue it changes,
 * and reports (without failing) anything it cannot migrate, so the system is
 * never left with a mix of old and new labels for equivalent issues.
 *
 * Usage:  node scripts/migrate_status.mjs [DATA_DIR]
 *   DATA_DIR defaults to $DATA_DIR or ./data. Backups (.backups) are skipped.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const OLD = 'implemented';
const NEW = 'in-progress';

const dataDir = path.resolve(process.argv[2] || process.env.DATA_DIR || './data');
const issuesRoot = path.join(dataDir, 'issues');

/** Recursively collect *.json issue files (skip _sequence.json and .backups). */
async function collect(dir, out) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const e of entries) {
		if (e.name === '.backups') continue;
		const abs = path.join(dir, e.name);
		if (e.isDirectory()) await collect(abs, out);
		else if (e.isFile() && e.name.endsWith('.json') && !e.name.startsWith('_')) out.push(abs);
	}
}

let totalFiles = 0;
let totalIssues = 0;
let changedFiles = 0;
let changedIssues = 0;
const problems = [];

const files = [];
await collect(issuesRoot, files);

for (const file of files) {
	totalFiles += 1;
	let parsed;
	try {
		parsed = JSON.parse(await readFile(file, 'utf8'));
	} catch (e) {
		problems.push(`${file}: unreadable/invalid JSON — ${e.message}`);
		continue;
	}
	if (!Array.isArray(parsed)) {
		problems.push(`${file}: expected a JSON array of issues, skipping.`);
		continue;
	}

	let fileChanged = false;
	for (const issue of parsed) {
		totalIssues += 1;
		if (!issue || typeof issue !== 'object') {
			problems.push(`${file}: contains a non-object entry, skipping it.`);
			continue;
		}
		let issueChanged = false;
		if (issue.status === OLD) {
			issue.status = NEW;
			issueChanged = true;
		}
		if (Array.isArray(issue.activity)) {
			for (const a of issue.activity) {
				if (a && typeof a === 'object') {
					if (a.from === OLD) { a.from = NEW; issueChanged = true; }
					if (a.to === OLD) { a.to = NEW; issueChanged = true; }
				}
			}
		}
		if (issueChanged) {
			changedIssues += 1;
			fileChanged = true;
			console.log(`  ${issue.id ?? '(no id)'} → ${NEW}`);
		}
	}

	if (fileChanged) {
		// Match the store's writeJsonAtomic formatting: 2-space indent + trailing newline.
		await writeFile(file, JSON.stringify(parsed, null, 2) + '\n');
		changedFiles += 1;
		console.log(`Updated ${path.relative(dataDir, file)}`);
	}
}

// Guard against any straggler still holding the old label anywhere in data/.
async function grepOld(dir) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const hits = [];
	for (const e of entries) {
		if (e.name === '.backups') continue;
		const abs = path.join(dir, e.name);
		if (e.isDirectory()) hits.push(...(await grepOld(abs)));
		else if (e.isFile() && e.name.endsWith('.json')) {
			const txt = await readFile(abs, 'utf8');
			if (txt.includes(`"${OLD}"`)) hits.push(abs);
		}
	}
	return hits;
}

const stragglers = await grepOld(issuesRoot);

console.log('\n── Status migration summary ──');
console.log(`Data dir:       ${dataDir}`);
console.log(`Files scanned:  ${totalFiles}`);
console.log(`Issues scanned: ${totalIssues}`);
console.log(`Files changed:  ${changedFiles}`);
console.log(`Issues moved:   ${changedIssues} ("${OLD}" → "${NEW}")`);

if (problems.length) {
	console.warn(`\n⚠ ${problems.length} item(s) could NOT be migrated:`);
	for (const p of problems) console.warn(`  - ${p}`);
}

if (stragglers.length) {
	console.error(`\n✗ Still found "${OLD}" in ${stragglers.length} file(s) after migration:`);
	for (const s of stragglers) console.error(`  - ${path.relative(dataDir, s)}`);
	process.exit(1);
}

console.log(`\n✓ No "${OLD}" labels remain under data/issues.`);
