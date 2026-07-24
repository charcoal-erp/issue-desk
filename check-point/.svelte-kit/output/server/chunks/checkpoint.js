import { t as private_env } from "./shared-server.js";
import { a as SUITE_ENVIRONMENTS, i as RUNNER_LANGUAGES, n as REPORT_FORMATS, o as TEST_CASE_STATUSES, r as RESULT_STATUSES, s as TEST_KINDS, t as PRIORITIES } from "./types.js";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { v7 } from "uuid";
import path from "node:path";
import { z } from "zod";
//#region src/lib/server/fs/paths.ts
var env = new Proxy({}, { get: (_, key) => private_env[key] ?? process.env[key] });
/**
* Root of this Checkpoint's content: tests / suites / runs / runners.json /
* reports / config. Overridable via DATA_DIR — point it at a checked-out
* content repo (e.g. charcoal's platform-testing), or let the app seed an
* empty catalogue here.
*/
function dataDir() {
	return path.resolve(env.DATA_DIR || "./checkpoint-data");
}
/** This Checkpoint's own applications + users taxonomy. */
function configDir() {
	return path.join(dataDir(), "config");
}
function testsDir(appId) {
	return appId ? path.join(dataDir(), "tests", appId) : path.join(dataDir(), "tests");
}
function testModuleFile(appId, moduleId) {
	return path.join(testsDir(appId), `${moduleId}.json`);
}
/** Per-app Checkpoint counters (testCase / suite / run), kept beside the cases. */
function checkpointSequenceFile(appId) {
	return path.join(testsDir(appId), "_sequence.json");
}
function suitesDir() {
	return path.join(dataDir(), "suites");
}
function suitesFile(appId) {
	return path.join(suitesDir(), `${appId}.json`);
}
function runsDir(appId) {
	return appId ? path.join(dataDir(), "runs", appId) : path.join(dataDir(), "runs");
}
function runFile(appId, runId) {
	return path.join(runsDir(appId), `${runId}.json`);
}
function runnersFile() {
	return path.join(dataDir(), "runners.json");
}
/** Captured raw reports & artifacts, copied in at ingest for stable paths. */
function reportsDir(runId) {
	return runId ? path.join(dataDir(), "reports", runId) : path.join(dataDir(), "reports");
}
//#endregion
//#region src/lib/schemas.ts
var slug = z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes only");
var userSchema = z.object({
	id: slug,
	name: z.string().min(1),
	role: z.string().optional(),
	avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	active: z.boolean().optional(),
	assignable: z.boolean().optional()
});
var formRefSchema = z.object({
	id: slug,
	name: z.string().min(1)
});
var pageRefSchema = z.object({
	id: slug,
	name: z.string().min(1),
	path: z.string().optional(),
	forms: z.array(formRefSchema).default([])
});
var moduleRefSchema = z.object({
	id: slug,
	code: z.string().min(1),
	name: z.string().min(1),
	pages: z.array(pageRefSchema).optional().default([])
});
var applicationSchema = z.object({
	id: slug,
	code: z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/, "2–6 uppercase letters/digits"),
	name: z.string().min(1),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	modules: z.array(moduleRefSchema).default([])
});
var issueTargetSchema = z.object({
	moduleId: slug,
	moduleCode: z.string().min(1),
	moduleName: z.string().min(1),
	pageName: z.string().optional(),
	formName: z.string().optional()
});
var testStepSchema = z.object({
	action: z.string().default(""),
	expected: z.string().default("")
});
var matchStrategySchema = z.discriminatedUnion("by", [
	z.object({ by: z.literal("nodeid") }),
	z.object({
		by: z.literal("annotation"),
		tag: z.string().min(1)
	}),
	z.object({ by: z.literal("testName") }),
	z.object({ by: z.literal("snapshotName") }),
	z.object({ by: z.literal("tapName") }),
	z.object({ by: z.literal("explicitMap") })
]);
var testCaseSchema = z.object({
	id: z.string().min(1),
	uuid: z.string().min(1),
	seq: z.number().int().positive(),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	target: issueTargetSchema,
	title: z.string().min(1),
	preconditions: z.string().optional(),
	steps: z.array(testStepSchema).default([]),
	priority: z.enum(PRIORITIES),
	status: z.enum(TEST_CASE_STATUSES),
	tags: z.array(z.string()).default([]),
	kind: z.enum(TEST_KINDS),
	runnerId: z.string().nullable().default(null),
	specPath: z.string().nullable().default(null),
	externalTestId: z.string().nullable().default(null),
	parentIssueId: z.string().nullable().default(null),
	suiteIds: z.array(z.string()).default([]),
	issueIds: z.array(z.string()).default([]),
	createdBy: z.string().min(1),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1)
});
var testRunnerSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	kind: z.enum(TEST_KINDS),
	language: z.enum(RUNNER_LANGUAGES),
	command: z.string().default(""),
	workingDir: z.string().default(""),
	env: z.record(z.string(), z.string()).optional(),
	reportFormat: z.enum(REPORT_FORMATS),
	reportPath: z.string().default(""),
	matchStrategy: matchStrategySchema,
	timeoutSec: z.number().int().positive().optional(),
	enabled: z.boolean().default(true)
});
var testSuiteSchema = z.object({
	id: z.string().min(1),
	seq: z.number().int().positive(),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	caseIds: z.array(z.string()).default([]),
	defaultEnv: z.enum(SUITE_ENVIRONMENTS),
	tags: z.array(z.string()).default([]),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1)
});
var caseResultSchema = z.object({
	testCaseId: z.string().min(1),
	runnerId: z.string().nullable().default(null),
	status: z.enum(RESULT_STATUSES),
	durationMs: z.number().nullable().default(null),
	message: z.string().nullable().default(null),
	stack: z.string().nullable().default(null),
	artifacts: z.array(z.string()).default([]),
	notes: z.string().optional(),
	issueId: z.string().optional(),
	flaky: z.boolean().optional()
});
var runnerInvocationSchema = z.object({
	runnerId: z.string().min(1),
	command: z.string().default(""),
	workingDir: z.string().default(""),
	exitCode: z.number().nullable().default(null),
	startedAt: z.string().min(1),
	finishedAt: z.string().optional(),
	reportPath: z.string().default(""),
	parsedCount: z.number().int().nonnegative().default(0),
	orphanCount: z.number().int().nonnegative().default(0),
	log: z.string().optional()
});
var testRunSchema = z.object({
	id: z.string().min(1),
	seq: z.number().int().positive(),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	suiteId: z.string().optional(),
	suiteName: z.string().optional(),
	environment: z.enum(SUITE_ENVIRONMENTS),
	startedBy: z.string().min(1),
	startedAt: z.string().min(1),
	completedAt: z.string().optional(),
	invocations: z.array(runnerInvocationSchema).default([]),
	results: z.array(caseResultSchema).default([]),
	archived: z.boolean().optional(),
	archivedAt: z.string().optional()
});
/** Per-app Checkpoint counters — the next id to allocate for each entity. */
var checkpointSequenceSchema = z.object({
	testCase: z.number().int().positive().default(1),
	suite: z.number().int().positive().default(1),
	run: z.number().int().positive().default(1)
});
var createTestCaseInputSchema = z.object({
	appId: z.string().min(1, "Application is required"),
	moduleId: z.string().min(1, "Module is required"),
	page: z.string().trim().max(200).optional(),
	form: z.string().trim().max(200).optional(),
	title: z.string().trim().min(1, "Title is required").max(200, "Keep the title under 200 characters"),
	preconditions: z.string().optional(),
	steps: z.array(testStepSchema).default([]),
	priority: z.enum(PRIORITIES),
	status: z.enum(TEST_CASE_STATUSES),
	tags: z.array(z.string()).default([]),
	kind: z.enum(TEST_KINDS),
	runnerId: z.string().nullable().default(null),
	specPath: z.string().nullable().default(null),
	externalTestId: z.string().nullable().default(null),
	parentIssueId: z.string().nullable().default(null),
	suiteIds: z.array(z.string()).default([])
});
var createSuiteInputSchema = z.object({
	appId: z.string().min(1, "Application is required"),
	name: z.string().trim().min(1, "Name is required").max(120),
	description: z.string().optional(),
	caseIds: z.array(z.string()).default([]),
	defaultEnv: z.enum(SUITE_ENVIRONMENTS),
	tags: z.array(z.string()).default([])
});
var createRunnerInputSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(120),
	kind: z.enum(TEST_KINDS),
	language: z.enum(RUNNER_LANGUAGES),
	command: z.string().default(""),
	workingDir: z.string().default(""),
	env: z.record(z.string(), z.string()).optional(),
	reportFormat: z.enum(REPORT_FORMATS),
	reportPath: z.string().default(""),
	matchStrategy: matchStrategySchema,
	timeoutSec: z.number().int().positive().optional(),
	enabled: z.boolean().default(true)
});
//#endregion
//#region src/lib/server/fs/read.ts
async function readJson(filePath) {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch (e) {
		if (e.code !== "ENOENT") console.error(`[checkpoint] Skipping unreadable file ${filePath}:`, e);
		return;
	}
}
/** Parse with a schema; log + return undefined instead of crashing boot. */
function safeParse(schema, value, source) {
	const result = schema.safeParse(value);
	if (!result.success) {
		console.error(`[checkpoint] Skipping invalid ${source}:`, result.error.message);
		return;
	}
	return result.data;
}
/**
* This Checkpoint's own taxonomy — a copy of the same shape IssueDesk uses,
* kept so app ids/codes line up when filing a bug over HTTP, but loaded from
* Checkpoint's own config dir with no dependency on the tracker.
*/
async function loadUsers() {
	const raw = await readJson(path.join(configDir(), "users.json"));
	return safeParse(z.array(userSchema), raw ?? [], "config/users.json") ?? [];
}
async function loadApplications() {
	const raw = await readJson(path.join(configDir(), "applications.json"));
	return safeParse(z.array(applicationSchema), raw ?? [], "config/applications.json") ?? [];
}
//#endregion
//#region src/lib/server/fs/checkpointRead.ts
/** Directory names under a base dir, or [] if the base does not exist yet. */
async function subdirs(base) {
	try {
		return (await readdir(base, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
	} catch {
		return [];
	}
}
/** `*.json` files (skipping `_`-prefixed bookkeeping files) in a dir. */
async function jsonFiles(dir) {
	try {
		return (await readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
	} catch {
		return [];
	}
}
async function loadRunners() {
	const raw = await readJson(runnersFile());
	return safeParse(z.array(testRunnerSchema), raw ?? [], "runners.json") ?? [];
}
async function loadAllTestCases() {
	const out = [];
	for (const appId of await subdirs(testsDir())) for (const file of await jsonFiles(testsDir(appId))) {
		const raw = await readJson(path.join(testsDir(appId), file));
		const cases = safeParse(z.array(testCaseSchema), raw, `tests/${appId}/${file}`);
		if (cases) out.push({
			appId,
			moduleId: file.replace(/\.json$/, ""),
			cases
		});
	}
	return out;
}
async function loadAllSuites() {
	const out = [];
	for (const file of await jsonFiles(suitesDir())) {
		const raw = await readJson(path.join(suitesDir(), file));
		const suites = safeParse(z.array(testSuiteSchema), raw, `suites/${file}`);
		if (suites) out.push(...suites);
	}
	return out;
}
async function loadAllRuns() {
	const out = [];
	for (const appId of await subdirs(runsDir())) for (const file of await jsonFiles(runsDir(appId))) {
		const run = safeParse(testRunSchema, await readJson(path.join(runsDir(appId), file)), `runs/${appId}/${file}`);
		if (run) out.push(run);
	}
	return out;
}
async function loadCheckpointSequence(appId) {
	const raw = await readJson(path.join(testsDir(appId), "_sequence.json"));
	if (raw === void 0) return void 0;
	return safeParse(checkpointSequenceSchema, raw, `tests/${appId}/_sequence.json`);
}
//#endregion
//#region src/lib/server/store/mutex.ts
/**
* Keyed async mutex: writes to the same key (file path or app id) serialise,
* writes to different keys proceed in parallel (§17 of the design doc).
*/
var chains = /* @__PURE__ */ new Map();
async function withLock(key, fn) {
	const run = (chains.get(key) ?? Promise.resolve()).then(fn, fn);
	chains.set(key, run.catch(() => void 0).finally(() => {
		if (chains.get(key) === run) chains.delete(key);
	}));
	return run;
}
//#endregion
//#region src/lib/server/fs/write.ts
/**
* Atomic JSON write: serialise → write to <file>.tmp → rename over <file>.
* Rename is atomic on the same filesystem, so a crash mid-write never leaves
* a half-written file. Serialised per file via the keyed mutex.
*/
async function writeJsonAtomic(filePath, value) {
	await withLock(`file:${filePath}`, async () => {
		await mkdir(path.dirname(filePath), { recursive: true });
		const tmp = `${filePath}.tmp`;
		await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
		await rename(tmp, filePath);
	});
}
//#endregion
//#region src/lib/server/store/seed.ts
/**
* Checkpoint's reference data: the testers on this box and the applications
* under test. Duplicated in shape from IssueDesk on purpose — the two apps
* share no code, and matching app ids/codes is what lets a bug filed from a
* failure land in the right IssueDesk project over HTTP.
*
* Edit `config/applications.json` / `config/users.json` in this Checkpoint's
* DATA_DIR to fit the environment it runs in; the seed only writes them when
* they are absent.
*/
var SEED_USERS = [
	{
		id: "kiran",
		name: "Kiran Kharade",
		role: "Architect",
		avatarColor: "#5B4BFF",
		assignable: true
	},
	{
		id: "anant",
		name: "Anant Kharade",
		role: "QA",
		avatarColor: "#2FA36B",
		assignable: false
	},
	{
		id: "aadinath",
		name: "Aadinath Kharade",
		role: "Tester",
		avatarColor: "#F5A623",
		assignable: false
	},
	{
		id: "tushar",
		name: "Tushar Kulange",
		role: "Developer",
		avatarColor: "#0891B2",
		assignable: true
	}
];
var CHARCOAL_MODULES = [
	[
		"org-hub",
		"ORGH",
		"Organization Hub"
	],
	[
		"company-hub",
		"COH",
		"Company Hub"
	],
	[
		"my-desk",
		"DESK",
		"My Desk"
	],
	[
		"platform-console",
		"PLAT",
		"Platform Console"
	],
	[
		"accounting",
		"ACCT",
		"Accounting"
	],
	[
		"procurement",
		"PROC",
		"Procurement"
	],
	[
		"inventory",
		"INV",
		"Inventory"
	],
	[
		"sales",
		"SALE",
		"Sales"
	],
	[
		"crm",
		"CRM",
		"CRM"
	],
	[
		"marketing",
		"MKT",
		"Marketing"
	],
	[
		"assets",
		"ASST",
		"Assets"
	],
	[
		"expense",
		"EXP",
		"Expense"
	],
	[
		"hr",
		"HR",
		"HR"
	],
	[
		"payroll",
		"PAY",
		"Payroll"
	]
];
var DRISHTI_MODULES = [
	[
		"admin-system",
		"ADMS",
		"Admin Portal – System Admin login"
	],
	[
		"admin-ward",
		"ADMW",
		"Admin Portal – Ward Admin login"
	],
	[
		"agency-portal",
		"AGY",
		"Agency Portal"
	],
	[
		"public-portal",
		"PUB",
		"Public Portal"
	],
	[
		"field-officer-web",
		"FOW",
		"Field Officer Web App"
	],
	[
		"field-officer-mobile",
		"FOM",
		"Field Officer Mobile App"
	]
];
function modules(defs) {
	return defs.map(([id, code, name]) => ({
		id,
		code,
		name,
		pages: []
	}));
}
var SEED_APPS = [
	{
		id: "charcoal",
		code: "CHR",
		name: "Charcoal",
		color: "#5B4BFF",
		modules: modules(CHARCOAL_MODULES)
	},
	{
		id: "chattr",
		code: "CHT",
		name: "Chattr",
		color: "#DB2777",
		modules: modules([[
			"general",
			"GEN",
			"General"
		]])
	},
	{
		id: "coffee-ops",
		code: "COF",
		name: "Coffee-ops",
		color: "#D97706",
		modules: modules([[
			"general",
			"GEN",
			"General"
		]])
	},
	{
		id: "relay",
		code: "RLY",
		name: "Relay",
		color: "#EA580C",
		modules: modules([[
			"consent",
			"CNS",
			"Consent"
		]])
	},
	{
		id: "drishti",
		code: "DRS",
		name: "Drishti",
		color: "#0891B2",
		modules: modules(DRISHTI_MODULES)
	}
];
async function fileExists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}
/** Write reference data only if it is missing — never clobber a curated config. */
async function seedConfigIfEmpty() {
	await mkdir(configDir(), { recursive: true });
	const usersFile = path.join(configDir(), "users.json");
	const appsFile = path.join(configDir(), "applications.json");
	if (!await fileExists(usersFile)) await writeJsonAtomic(usersFile, SEED_USERS);
	if (!await fileExists(appsFile)) await writeJsonAtomic(appsFile, SEED_APPS);
}
//#endregion
//#region src/lib/server/store/index.ts
/**
* Checkpoint's reference-data store: its own applications taxonomy and its own
* users (the testers on this box). A small module-level singleton, mirroring
* the checkpoint content store.
*
* In the combined app this data was borrowed from the issue tracker. Checkpoint
* is now its own app and owns this outright — the same shapes as IssueDesk so
* app ids/codes line up when filing a bug over HTTP, but no shared code.
*/
var usersList = [];
var appsList = [];
var loaded$1 = false;
async function ensureLoaded$1() {
	if (loaded$1) return;
	await reload$1();
	loaded$1 = true;
}
async function reload$1() {
	await seedConfigIfEmpty();
	usersList = await loadUsers();
	appsList = await loadApplications();
}
function users() {
	return usersList;
}
function applications() {
	return appsList;
}
//#endregion
//#region src/lib/server/store/checkpoint.ts
var loaded = false;
var loadPromise;
var runnersList = [];
var casesById = /* @__PURE__ */ new Map();
var suitesById = /* @__PURE__ */ new Map();
var runsById = /* @__PURE__ */ new Map();
var seqByApp = /* @__PURE__ */ new Map();
var nextRunnerSeq = 1;
/** caseId → its results across runs, oldest run first. Derived from runsById. */
var resultsByCase = /* @__PURE__ */ new Map();
function seqNumOf(id) {
	const m = id.match(/(\d+)$/);
	return m ? Number(m[1]) : 0;
}
function rebuildResultsIndex() {
	resultsByCase.clear();
	const runs = [...runsById.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
	for (const run of runs) for (const result of run.results) {
		let list = resultsByCase.get(result.testCaseId);
		if (!list) resultsByCase.set(result.testCaseId, list = []);
		list.push({
			run,
			result
		});
	}
}
async function load() {
	await ensureLoaded$1();
	runnersList = await loadRunners();
	nextRunnerSeq = runnersList.reduce((max, r) => Math.max(max, seqNumOf(r.id)), 0) + 1;
	casesById.clear();
	for (const f of await loadAllTestCases()) for (const c of f.cases) casesById.set(c.id, c);
	suitesById.clear();
	for (const s of await loadAllSuites()) suitesById.set(s.id, s);
	runsById.clear();
	for (const r of await loadAllRuns()) runsById.set(r.id, r);
	seqByApp.clear();
	for (const app of applications()) {
		const seq = await loadCheckpointSequence(app.id);
		seqByApp.set(app.id, seq ?? {
			testCase: 1,
			suite: 1,
			run: 1
		});
	}
	rebuildResultsIndex();
	loaded = true;
}
async function ensureLoaded() {
	if (loaded) return;
	loadPromise ??= load();
	await loadPromise;
}
async function reload() {
	loadPromise = load();
	await loadPromise;
}
function appOf(appId) {
	const app = applications().find((a) => a.id === appId);
	if (!app) throw new Error(`Unknown application "${appId}"`);
	return app;
}
function targetOf(appId, moduleId, page, form) {
	const app = appOf(appId);
	const mod = app.modules.find((m) => m.id === moduleId);
	if (!mod) throw new Error(`Unknown module "${moduleId}" in ${app.name}`);
	return {
		appCode: app.code,
		appName: app.name,
		target: {
			moduleId: mod.id,
			moduleCode: mod.code,
			moduleName: mod.name,
			pageName: page?.trim() || void 0,
			formName: form?.trim() || void 0
		}
	};
}
async function allocate(appId, kind) {
	const seq = seqByApp.get(appId) ?? {
		testCase: 1,
		suite: 1,
		run: 1
	};
	const n = seq[kind];
	seq[kind] = n + 1;
	seqByApp.set(appId, seq);
	await writeJsonAtomic(checkpointSequenceFile(appId), seq);
	return n;
}
function nextCaseId(appId) {
	const seq = seqByApp.get(appId) ?? {
		testCase: 1,
		suite: 1,
		run: 1
	};
	return `TC-${appOf(appId).code}-${seq.testCase}`;
}
function nextSuiteId(appId) {
	const seq = seqByApp.get(appId) ?? {
		testCase: 1,
		suite: 1,
		run: 1
	};
	return `SUITE-${appOf(appId).code}-${seq.suite}`;
}
async function persistCaseModule(appId, moduleId) {
	const group = [...casesById.values()].filter((c) => c.appId === appId && c.target.moduleId === moduleId).sort((a, b) => a.seq - b.seq);
	await writeJsonAtomic(testModuleFile(appId, moduleId), group);
}
async function persistSuitesForApp(appId) {
	const group = [...suitesById.values()].filter((s) => s.appId === appId).sort((a, b) => a.seq - b.seq);
	await writeJsonAtomic(suitesFile(appId), group);
}
async function syncCaseIntoSuites(caseId, oldSuiteIds, newSuiteIds) {
	const added = newSuiteIds.filter((id) => !oldSuiteIds.includes(id));
	const removed = oldSuiteIds.filter((id) => !newSuiteIds.includes(id));
	const dirtyApps = /* @__PURE__ */ new Set();
	for (const sid of added) {
		const s = suitesById.get(sid);
		if (s && !s.caseIds.includes(caseId)) {
			s.caseIds.push(caseId);
			dirtyApps.add(s.appId);
		}
	}
	for (const sid of removed) {
		const s = suitesById.get(sid);
		if (s && s.caseIds.includes(caseId)) {
			s.caseIds = s.caseIds.filter((id) => id !== caseId);
			dirtyApps.add(s.appId);
		}
	}
	for (const appId of dirtyApps) await persistSuitesForApp(appId);
}
async function syncSuiteIntoCases(suiteId, oldCaseIds, newCaseIds) {
	const added = newCaseIds.filter((id) => !oldCaseIds.includes(id));
	const removed = oldCaseIds.filter((id) => !newCaseIds.includes(id));
	const dirty = /* @__PURE__ */ new Set();
	for (const cid of added) {
		const c = casesById.get(cid);
		if (c && !c.suiteIds.includes(suiteId)) {
			c.suiteIds.push(suiteId);
			dirty.add(`${c.appId}/${c.target.moduleId}`);
		}
	}
	for (const cid of removed) {
		const c = casesById.get(cid);
		if (c && c.suiteIds.includes(suiteId)) {
			c.suiteIds = c.suiteIds.filter((id) => id !== suiteId);
			dirty.add(`${c.appId}/${c.target.moduleId}`);
		}
	}
	for (const key of dirty) {
		const [appId, moduleId] = key.split("/");
		await persistCaseModule(appId, moduleId);
	}
}
function runners() {
	return runnersList;
}
function runner(id) {
	return runnersList.find((r) => r.id === id);
}
function getCase(id) {
	return casesById.get(id);
}
function cases() {
	return [...casesById.values()];
}
function suites(appId) {
	const all = [...suitesById.values()];
	return (appId ? all.filter((s) => s.appId === appId) : all).sort((a, b) => a.appCode === b.appCode ? a.seq - b.seq : a.appCode.localeCompare(b.appCode));
}
function getSuite(id) {
	return suitesById.get(id);
}
function runs(appId) {
	const all = [...runsById.values()];
	return (appId ? all.filter((r) => r.appId === appId) : all).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
function getRun(id) {
	return runsById.get(id);
}
function lastResultForCase(caseId) {
	const list = resultsByCase.get(caseId);
	return list && list.length ? list[list.length - 1] : void 0;
}
/** Filter + sort the case list for the Cases table (design §10.2). */
function listCases(filter = {}) {
	let rows = [...casesById.values()];
	if (filter.appId) rows = rows.filter((c) => c.appId === filter.appId);
	if (filter.moduleId) rows = rows.filter((c) => c.target.moduleId === filter.moduleId);
	if (filter.kind?.length) rows = rows.filter((c) => filter.kind.includes(c.kind));
	if (filter.status?.length) rows = rows.filter((c) => filter.status.includes(c.status));
	if (filter.tag) rows = rows.filter((c) => c.tags.includes(filter.tag));
	if (filter.lastResult?.length) rows = rows.filter((c) => {
		const last = lastResultForCase(c.id);
		const key = last ? last.result.status : "none";
		return filter.lastResult.includes(key);
	});
	if (filter.q) {
		const q = filter.q.toLowerCase();
		rows = rows.filter((c) => `${c.id} ${c.title} ${c.specPath ?? ""} ${c.target.moduleName} ${c.tags.join(" ")}`.toLowerCase().includes(q));
	}
	return rows.sort((a, b) => a.appCode === b.appCode ? b.seq - a.seq : a.appCode.localeCompare(b.appCode));
}
async function createCase(input, actor) {
	await ensureLoaded();
	return withLock(`cp:app:${input.appId}`, async () => {
		const { appCode, appName, target } = targetOf(input.appId, input.moduleId, input.page, input.form);
		const n = await allocate(input.appId, "testCase");
		const id = `TC-${appCode}-${n}`;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const manual = input.kind === "manual";
		const testCase = {
			id,
			uuid: v7(),
			seq: n,
			appId: input.appId,
			appCode,
			appName,
			target,
			title: input.title,
			preconditions: input.preconditions || void 0,
			steps: input.steps,
			priority: input.priority,
			status: input.status,
			tags: input.tags,
			kind: input.kind,
			runnerId: manual ? null : input.runnerId,
			specPath: manual ? null : input.specPath,
			externalTestId: manual ? null : input.externalTestId,
			parentIssueId: input.parentIssueId,
			suiteIds: [...input.suiteIds],
			issueIds: [],
			createdBy: actor,
			createdAt: now,
			updatedAt: now
		};
		casesById.set(id, testCase);
		await persistCaseModule(input.appId, target.moduleId);
		await syncCaseIntoSuites(id, [], testCase.suiteIds);
		return testCase;
	});
}
async function updateCase(id, patch, _actor) {
	await ensureLoaded();
	const before = casesById.get(id);
	if (!before) throw new Error(`Test case ${id} not found`);
	return withLock(`cp:app:${before.appId}`, async () => {
		const moduleId = patch.moduleId ?? before.target.moduleId;
		const { appCode, appName, target } = targetOf(before.appId, moduleId, patch.page !== void 0 ? patch.page : before.target.pageName, patch.form !== void 0 ? patch.form : before.target.formName);
		const manual = (patch.kind ?? before.kind) === "manual";
		const after = {
			...before,
			appCode,
			appName,
			target,
			title: patch.title ?? before.title,
			preconditions: patch.preconditions !== void 0 ? patch.preconditions || void 0 : before.preconditions,
			steps: patch.steps ?? before.steps,
			priority: patch.priority ?? before.priority,
			status: patch.status ?? before.status,
			tags: patch.tags ?? before.tags,
			kind: patch.kind ?? before.kind,
			runnerId: manual ? null : patch.runnerId !== void 0 ? patch.runnerId : before.runnerId,
			specPath: manual ? null : patch.specPath !== void 0 ? patch.specPath : before.specPath,
			externalTestId: manual ? null : patch.externalTestId !== void 0 ? patch.externalTestId : before.externalTestId,
			parentIssueId: patch.parentIssueId !== void 0 ? patch.parentIssueId : before.parentIssueId,
			suiteIds: patch.suiteIds ?? before.suiteIds,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		casesById.set(id, after);
		await persistCaseModule(before.appId, before.target.moduleId);
		if (moduleId !== before.target.moduleId) await persistCaseModule(before.appId, moduleId);
		if (patch.suiteIds) await syncCaseIntoSuites(id, before.suiteIds, after.suiteIds);
		return after;
	});
}
async function deleteCase(id) {
	await ensureLoaded();
	const c = casesById.get(id);
	if (!c) throw new Error(`Test case ${id} not found`);
	await withLock(`cp:app:${c.appId}`, async () => {
		casesById.delete(id);
		await persistCaseModule(c.appId, c.target.moduleId);
		await syncCaseIntoSuites(id, c.suiteIds, []);
	});
}
/** Record a bug filed from a case (bidirectional link, §13). */
async function addFiledIssueToCase(caseId, issueId) {
	await ensureLoaded();
	const c = casesById.get(caseId);
	if (!c) return;
	await withLock(`cp:app:${c.appId}`, async () => {
		if (!c.issueIds.includes(issueId)) {
			c.issueIds.push(issueId);
			c.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
			await persistCaseModule(c.appId, c.target.moduleId);
		}
	});
}
async function createSuite(input, _actor) {
	await ensureLoaded();
	return withLock(`cp:app:${input.appId}`, async () => {
		const app = appOf(input.appId);
		const n = await allocate(input.appId, "suite");
		const id = `SUITE-${app.code}-${n}`;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const suite = {
			id,
			seq: n,
			appId: input.appId,
			appCode: app.code,
			appName: app.name,
			name: input.name,
			description: input.description || void 0,
			caseIds: [...input.caseIds],
			defaultEnv: input.defaultEnv,
			tags: input.tags,
			createdAt: now,
			updatedAt: now
		};
		suitesById.set(id, suite);
		await persistSuitesForApp(input.appId);
		await syncSuiteIntoCases(id, [], suite.caseIds);
		return suite;
	});
}
async function updateSuite(id, patch, _actor) {
	await ensureLoaded();
	const before = suitesById.get(id);
	if (!before) throw new Error(`Suite ${id} not found`);
	return withLock(`cp:app:${before.appId}`, async () => {
		const after = {
			...before,
			name: patch.name ?? before.name,
			description: patch.description !== void 0 ? patch.description || void 0 : before.description,
			caseIds: patch.caseIds ?? before.caseIds,
			defaultEnv: patch.defaultEnv ?? before.defaultEnv,
			tags: patch.tags ?? before.tags,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		suitesById.set(id, after);
		await persistSuitesForApp(before.appId);
		if (patch.caseIds) await syncSuiteIntoCases(id, before.caseIds, after.caseIds);
		return after;
	});
}
async function duplicateSuite(id, actor) {
	await ensureLoaded();
	const src = suitesById.get(id);
	if (!src) throw new Error(`Suite ${id} not found`);
	return createSuite({
		appId: src.appId,
		name: `${src.name} (copy)`,
		description: src.description,
		caseIds: [...src.caseIds],
		defaultEnv: src.defaultEnv,
		tags: [...src.tags]
	}, actor);
}
async function deleteSuite(id) {
	await ensureLoaded();
	const s = suitesById.get(id);
	if (!s) throw new Error(`Suite ${id} not found`);
	await withLock(`cp:app:${s.appId}`, async () => {
		suitesById.delete(id);
		await persistSuitesForApp(s.appId);
		await syncSuiteIntoCases(id, s.caseIds, []);
	});
}
async function createRunner(input) {
	await ensureLoaded();
	return withLock("cp:runners", async () => {
		const id = `RNR-${nextRunnerSeq}`;
		nextRunnerSeq += 1;
		const runnerRec = {
			id,
			...input
		};
		runnersList.push(runnerRec);
		await writeJsonAtomic(runnersFile(), runnersList);
		return runnerRec;
	});
}
async function updateRunner(id, patch) {
	await ensureLoaded();
	return withLock("cp:runners", async () => {
		const i = runnersList.findIndex((r) => r.id === id);
		if (i < 0) throw new Error(`Runner ${id} not found`);
		runnersList[i] = {
			...runnersList[i],
			...patch,
			id
		};
		await writeJsonAtomic(runnersFile(), runnersList);
		return runnersList[i];
	});
}
async function toggleRunner(id, enabled) {
	return updateRunner(id, { enabled });
}
async function deleteRunner(id) {
	await ensureLoaded();
	await withLock("cp:runners", async () => {
		runnersList = runnersList.filter((r) => r.id !== id);
		await writeJsonAtomic(runnersFile(), runnersList);
	});
}
/** Allocate the next run id for an app (locked + persisted). */
async function allocateRunId(appId) {
	await ensureLoaded();
	return withLock(`cp:app:${appId}`, async () => {
		const n = await allocate(appId, "run");
		return `RUN-${appOf(appId).code}-${n}`;
	});
}
/** Persist a run (created or updated) and refresh the derived results index. */
async function saveRun(run) {
	await ensureLoaded();
	return withLock(`cp:run:${run.id}`, async () => {
		runsById.set(run.id, run);
		await writeJsonAtomic(runFile(run.appId, run.id), run);
		rebuildResultsIndex();
		return run;
	});
}
/**
* Archive or un-archive a run. Archived runs survive `pruneRuns` — they are the
* ones worth keeping: a release sign-off, the run that caught a regression.
*/
async function setRunArchived(runId, archived) {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	const next = {
		...run,
		archived
	};
	if (archived) next.archivedAt = (/* @__PURE__ */ new Date()).toISOString();
	else delete next.archivedAt;
	return saveRun(next);
}
/** Delete one run and its stored file. Run history is append-only until asked. */
async function deleteRun(runId) {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) return;
	await withLock(`cp:run:${runId}`, async () => {
		runsById.delete(runId);
		await rm(runFile(run.appId, runId), { force: true });
		rebuildResultsIndex();
	});
}
/** Which runs a prune would remove — archived and in-flight runs are never included. */
function prunableRuns(filter) {
	return runs(filter.appId).filter((r) => !r.archived && r.completedAt && r.startedAt < filter.before && (!filter.suiteId || r.suiteId === filter.suiteId));
}
/** Delete every run matching the filter; returns the ids removed. */
async function pruneRuns(filter) {
	const doomed = prunableRuns(filter);
	for (const run of doomed) await deleteRun(run.id);
	return doomed.map((r) => r.id);
}
/** Record or replace one case's result in a run (manual marking / bug link). */
async function recordResult(runId, result) {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	const results = run.results.filter((r) => !(r.testCaseId === result.testCaseId && r.runnerId === result.runnerId));
	results.push(result);
	return saveRun({
		...run,
		results
	});
}
/** Mark a run complete (immutable history from here on). */
async function completeRun(runId) {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	return saveRun({
		...run,
		completedAt: run.completedAt ?? (/* @__PURE__ */ new Date()).toISOString()
	});
}
//#endregion
export { toggleRunner as A, dataDir as B, reload as C, saveRun as D, runs as E, ensureLoaded$1 as F, users as I, createRunnerInputSchema as L, updateRunner as M, updateSuite as N, setRunArchived as O, applications as P, createSuiteInputSchema as R, recordResult as S, runners as T, reportsDir as V, lastResultForCase as _, createCase as a, nextSuiteId as b, deleteCase as c, deleteSuite as d, duplicateSuite as f, getSuite as g, getRun as h, completeRun as i, updateCase as j, suites as k, deleteRun as l, getCase as m, allocateRunId as n, createRunner as o, ensureLoaded as p, cases as r, createSuite as s, addFiledIssueToCase as t, deleteRunner as u, listCases as v, runner as w, pruneRuns as x, nextCaseId as y, createTestCaseInputSchema as z };
