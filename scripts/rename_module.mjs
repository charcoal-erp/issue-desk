#!/usr/bin/env node
/**
 * Rename a module's display name, everywhere it is stored.
 *
 * A module's name lives in two places: config/applications.json, and a
 * denormalised `moduleName` copy on every issue filed under it. Renaming in
 * Config only updates the first — issues refresh lazily on their next edit —
 * and editing each issue to force it would stamp an activity entry and a new
 * `updatedAt` on every one. This rewrites just those fields and nothing else:
 * ids, codes, file names, history, timestamps and all free text (titles,
 * descriptions, comments) are left exactly as they are.
 *
 * Usage:  node scripts/rename_module.mjs <appId> <moduleId> "<New name>" [--apply] [DATA_DIR]
 *   Dry run by default — reports what would change and writes nothing.
 *   DATA_DIR defaults to $DATA_DIR or ./data. Backups (.backups) are never touched.
 *
 * Stop the IssueDesk service first: it holds the data in memory, and a running
 * instance would write its old copy back over the rename on its next save.
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile, readlink, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const [appId, moduleId, newName, dirArg] = args.filter((a) => a !== '--apply');
if (!appId || !moduleId || !newName?.trim()) {
	console.error('Usage: node scripts/rename_module.mjs <appId> <moduleId> "<New name>" [--apply] [DATA_DIR]');
	process.exit(2);
}
const NEW = newName.trim();
const dataDir = path.resolve(dirArg || process.env.DATA_DIR || './data');
const appsFile = path.join(dataDir, 'config', 'applications.json');
const issuesRoot = path.join(dataDir, 'issues');

const fail = (msg) => {
	console.error(`✗ ${msg}`);
	process.exit(1);
};

/** Same bytes the store writes (writeJsonAtomic): 2-space indent + trailing newline. */
const serialise = (value) => JSON.stringify(value, null, 2) + '\n';

/**
 * Refuse while an IssueDesk server is running from this data dir. Checked by
 * process working directory (the service runs `node build` from the repo) —
 * best effort, so the warning above still stands.
 */
async function runningServers() {
	const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
	if (dataDir !== path.join(repo, 'data')) return [];
	let pids = [];
	try {
		pids = execFileSync('pgrep', ['node'], { encoding: 'utf8' }).split('\n').filter(Boolean);
	} catch {
		return []; // pgrep exits 1 when nothing matches
	}
	const hits = [];
	for (const pid of pids) {
		if (Number(pid) === process.pid) continue;
		try {
			const cmd = (await readFile(`/proc/${pid}/cmdline`, 'utf8')).split('\0');
			const serving = cmd.includes('build') || cmd.some((a) => /vite/.test(a));
			if (serving && (await readlink(`/proc/${pid}/cwd`)) === repo) hits.push(pid);
		} catch {
			// gone, or not ours to inspect
		}
	}
	return hits;
}

async function writeAtomic(file, body) {
	const tmp = `${file}.tmp`;
	await writeFile(tmp, body, 'utf8');
	await rename(tmp, file);
}

/** Every issue file under issues/<appId>/ (skip _sequence.json). */
async function issueFiles() {
	const dir = path.join(issuesRoot, appId);
	const entries = await readdir(dir, { withFileTypes: true });
	return entries
		.filter((e) => e.isFile() && e.name.endsWith('.json') && !e.name.startsWith('_'))
		.map((e) => path.join(dir, e.name));
}

// ---- Plan ------------------------------------------------------------------

const servers = await runningServers();
if (servers.length) {
	fail(`IssueDesk is running from this data dir (pid ${servers.join(', ')}). Stop it first:\n  sudo systemctl stop issue-desk`);
}

const appsRaw = await readFile(appsFile, 'utf8');
const apps = JSON.parse(appsRaw);
if (serialise(apps) !== appsRaw) fail(`${appsFile} is not in the store's format; refusing to rewrite it.`);
const app = apps.find((a) => a.id === appId);
if (!app) fail(`No application "${appId}" in ${appsFile}.`);
const mod = app.modules.find((m) => m.id === moduleId);
if (!mod) fail(`No module "${moduleId}" in ${app.name}. Modules: ${app.modules.map((m) => m.id).join(', ')}`);
const OLD = mod.name;
const clash = app.modules.find((m) => m.id !== moduleId && m.name.toLowerCase() === NEW.toLowerCase());
if (clash) fail(`${app.name} already has a module named "${clash.name}" (${clash.id}).`);

console.log(`${apply ? 'Renaming' : 'Dry run —'} ${app.name} / ${moduleId}: "${OLD}" → "${NEW}"`);
console.log(`Data dir: ${dataDir}\n`);

const plans = []; // { file, raw, before, after, ids }
let alreadyNew = 0;
for (const file of await issueFiles()) {
	const raw = await readFile(file, 'utf8');
	const issues = JSON.parse(raw);
	if (!Array.isArray(issues)) fail(`${file}: expected a JSON array of issues.`);
	const ids = [];
	const after = issues.map((issue) => {
		if (issue?.appId !== appId || issue.moduleId !== moduleId) return issue;
		if (issue.moduleName === NEW) {
			alreadyNew += 1;
			return issue;
		}
		ids.push(issue.id);
		// Spread keeps key order, so the file diff is the one line per issue.
		return { ...issue, moduleName: NEW };
	});
	if (!ids.length) continue;
	if (serialise(issues) !== raw) fail(`${file} is not in the store's format; refusing to rewrite it.`);
	plans.push({ file, raw, before: issues, after, ids });
}

const configChange = OLD !== NEW;
for (const p of plans) console.log(`  ${path.relative(dataDir, p.file)}: ${p.ids.length} issue(s) — ${p.ids.join(', ')}`);
const total = plans.reduce((n, p) => n + p.ids.length, 0);
console.log(`\nConfig:  ${configChange ? `module name "${OLD}" → "${NEW}"` : 'already up to date'}`);
console.log(`Issues:  ${total} to relabel${alreadyNew ? `, ${alreadyNew} already "${NEW}"` : ''}`);

if (!apply) {
	console.log('\nNothing written. Re-run with --apply to make these changes.');
	process.exit(0);
}

// ---- Apply -----------------------------------------------------------------

for (const p of plans) await writeAtomic(p.file, serialise(p.after));
if (configChange) {
	mod.name = NEW;
	await writeAtomic(appsFile, serialise(apps));
}

// ---- Verify: re-read and prove only moduleName / the config name moved ------

const strip = (issue) => ({ ...issue, moduleName: undefined });
for (const p of plans) {
	const now = JSON.parse(await readFile(p.file, 'utf8'));
	if (now.length !== p.before.length) fail(`${p.file}: issue count changed (${p.before.length} → ${now.length}).`);
	now.forEach((issue, i) => {
		if (JSON.stringify(strip(issue)) !== JSON.stringify(strip(p.before[i]))) {
			fail(`${p.file}: ${issue.id} changed beyond moduleName.`);
		}
	});
}
const appsNow = JSON.parse(await readFile(appsFile, 'utf8'));
const modNow = appsNow.find((a) => a.id === appId).modules.find((m) => m.id === moduleId);
if (modNow.name !== NEW) fail('Config module name did not take.');
const appsBefore = JSON.parse(appsRaw);
appsBefore.find((a) => a.id === appId).modules.find((m) => m.id === moduleId).name = NEW;
if (serialise(appsBefore) !== serialise(appsNow)) fail('applications.json changed beyond the module name.');

let stragglers = 0;
for (const file of await issueFiles()) {
	for (const issue of JSON.parse(await readFile(file, 'utf8'))) {
		if (issue.appId === appId && issue.moduleId === moduleId && issue.moduleName !== NEW) stragglers += 1;
	}
}
if (stragglers) fail(`${stragglers} issue(s) under ${moduleId} still carry the old name.`);

console.log(`\n✓ Renamed. ${total} issue(s) relabelled; nothing else changed. Start the service again:`);
console.log('  sudo systemctl start issue-desk');
