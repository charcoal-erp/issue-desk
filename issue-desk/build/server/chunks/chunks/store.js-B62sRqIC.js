import { S as STATUSES, P as PRIORITIES, I as ISSUE_TYPES, s as statusRank, p as priorityRank } from './types.js-CwJArkfF.js';
import { d as dataDir, c as configDir, i as issuesDir, s as sequenceFile, m as maxAttachments, p as pendingDir, u as uploadsDir, a as maxUploadBytes, b as moduleFile } from './paths.js-Erst5pJ8.js';
import { readdir, access, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { v7 } from 'uuid';
import { z } from 'zod';

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
var settingsSchema = z.object({
	productName: z.string().default("IssueDesk"),
	defaultPageSize: z.number().int().positive().default(50)
});
var attachmentSchema = z.object({
	id: z.string().min(1),
	filename: z.string().min(1),
	originalName: z.string().min(1),
	mime: z.string().min(1),
	kind: z.enum(["image", "pdf"]),
	size: z.number().int().nonnegative(),
	url: z.string().min(1),
	uploadedBy: z.string().min(1),
	uploadedAt: z.string().min(1)
});
var activitySchema = z.object({
	id: z.string().min(1),
	at: z.string().min(1),
	by: z.string().min(1),
	kind: z.enum([
		"created",
		"comment",
		"status",
		"priority",
		"assignee",
		"edit",
		"attachment"
	]),
	message: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional()
});
var issueSchema = z.object({
	id: z.string().min(1),
	uuid: z.string().min(1),
	seq: z.number().int().positive(),
	type: z.enum(ISSUE_TYPES),
	title: z.string().min(1),
	description: z.string().default(""),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	moduleId: slug,
	moduleCode: z.string().min(1),
	moduleName: z.string().min(1),
	pageName: z.string().optional(),
	pagePath: z.string().optional(),
	formName: z.string().optional(),
	priority: z.enum(PRIORITIES),
	status: z.enum(STATUSES),
	reporterId: z.string().min(1),
	assigneeId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	attachments: z.array(attachmentSchema).default([]),
	activity: z.array(activitySchema).default([]),
	testCaseId: z.string().optional(),
	runId: z.string().optional(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1)
});
var sequenceSchema = z.object({
	code: z.string().min(1),
	next: z.number().int().positive()
});
var createIssueSchema = z.object({
	type: z.enum(ISSUE_TYPES),
	title: z.string().trim().min(1, "Title is required").max(200, "Keep the title under 200 characters"),
	description: z.string().default(""),
	appId: z.string().min(1, "Application is required"),
	moduleId: z.string().min(1, "Module is required"),
	page: z.string().trim().max(200).optional(),
	form: z.string().trim().max(200).optional(),
	priority: z.enum(PRIORITIES),
	status: z.enum(STATUSES),
	assigneeId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	attachments: z.array(attachmentSchema).default([]),
	testCaseId: z.string().optional(),
	runId: z.string().optional()
});
var updateIssueSchema = createIssueSchema.partial();
//#endregion
//#region src/lib/server/fs/read.ts
async function readJson(filePath) {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch (e) {
		if (e.code !== "ENOENT") console.error(`[issuedesk] Skipping unreadable file ${filePath}:`, e);
		return;
	}
}
/** Parse with a schema; log + return undefined instead of crashing boot (NFR-6). */
function safeParse(schema, value, source) {
	const result = schema.safeParse(value);
	if (!result.success) {
		console.error(`[issuedesk] Skipping invalid ${source}:`, result.error.message);
		return;
	}
	return result.data;
}
async function loadUsers() {
	const raw = await readJson(path.join(configDir(), "users.json"));
	return safeParse(z.array(userSchema), raw ?? [], "config/users.json") ?? [];
}
async function loadApplications() {
	const raw = await readJson(path.join(configDir(), "applications.json"));
	return safeParse(z.array(applicationSchema), raw ?? [], "config/applications.json") ?? [];
}
async function loadSettings() {
	return safeParse(settingsSchema, await readJson(path.join(configDir(), "settings.json")) ?? {}, "config/settings.json") ?? {
		productName: "IssueDesk",
		defaultPageSize: 50
	};
}
/** Walk issues/<app>/<module>.json; a malformed file is logged and skipped. */
async function loadAllIssues() {
	const out = [];
	let appDirs = [];
	try {
		appDirs = (await readdir(issuesDir(), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
	} catch {
		return out;
	}
	for (const appId of appDirs) {
		let files = [];
		try {
			files = (await readdir(issuesDir(appId))).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
		} catch {
			continue;
		}
		for (const file of files) {
			const raw = await readJson(path.join(issuesDir(appId), file));
			const issues = safeParse(z.array(issueSchema), raw, `issues/${appId}/${file}`);
			if (issues) out.push({
				appId,
				moduleId: file.replace(/\.json$/, ""),
				issues
			});
		}
	}
	return out;
}
async function loadSequence(appId) {
	const raw = await readJson(path.join(issuesDir(appId), "_sequence.json"));
	if (raw === void 0) return void 0;
	return safeParse(sequenceSchema, raw, `issues/${appId}/_sequence.json`);
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
//#region src/lib/server/uploads.ts
var ALLOWED = {
	"image/png": {
		ext: "png",
		kind: "image"
	},
	"image/jpeg": {
		ext: "jpg",
		kind: "image"
	},
	"image/webp": {
		ext: "webp",
		kind: "image"
	},
	"image/gif": {
		ext: "gif",
		kind: "image"
	},
	"application/pdf": {
		ext: "pdf",
		kind: "pdf"
	}
};
var UploadError = class extends Error {};
/** Sniff the real type from magic bytes; never trust the client MIME (§12). */
function sniffMime(buf) {
	const ascii = (from, to) => String.fromCharCode(...buf.slice(from, to));
	if (buf.length >= 8 && buf[0] === 137 && ascii(1, 4) === "PNG") return "image/png";
	if (buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return "image/jpeg";
	if (buf.length >= 6 && ascii(0, 4) === "GIF8") return "image/gif";
	if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
	if (buf.length >= 4 && ascii(0, 4) === "%PDF") return "application/pdf";
}
/** "Screen Shot (1).PNG" → "screen-shot-1.png" — traversal-safe, collision-safe. */
function sanitizeFilename(original, ext) {
	return `${path.basename(original).replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file"}.${ext}`;
}
/**
* Validate and persist uploaded blobs; returns Attachment records whose URLs
* point at the final (or pending) location.
*/
async function saveUploads(files, target, uploadedBy, existingCount) {
	if (existingCount + files.length > maxAttachments()) throw new UploadError(`That would be ${existingCount + files.length} attachments. The limit is ${maxAttachments()} per issue.`);
	const pending = target.issueId === "pending";
	if (pending && !target.draftId) throw new UploadError("Missing draftId for a pending upload.");
	const dir = pending ? pendingDir(target.appId, target.draftId) : uploadsDir(target.appId, target.issueId);
	await mkdir(dir, { recursive: true });
	const already = (await readdir(dir)).length;
	const out = [];
	let index = existingCount + already;
	for (const file of files) {
		if (file.size > maxUploadBytes()) throw new UploadError(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${maxUploadBytes() / 1024 / 1024} MB.`);
		const buf = new Uint8Array(await file.arrayBuffer());
		const mime = sniffMime(buf);
		if (!mime || !ALLOWED[mime]) throw new UploadError(`${file.name} is not an allowed type. Use PNG, JPG, WEBP, GIF or PDF.`);
		const { ext, kind } = ALLOWED[mime];
		index += 1;
		const filename = `${String(index).padStart(2, "0")}-${sanitizeFilename(file.name, ext)}`;
		await writeFile(path.join(dir, filename), buf);
		const urlBase = pending ? `/api/files/${target.appId}/_pending/${target.draftId}` : `/api/files/${target.appId}/${target.issueId}`;
		out.push({
			id: v7(),
			filename,
			originalName: file.name,
			mime,
			kind,
			size: buf.length,
			url: `${urlBase}/${filename}`,
			uploadedBy,
			uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	return out;
}
/**
* Move `_pending/<draftId>/*` → `uploads/<app>/<issueId>/*` once the issue ID
* is known, rewriting each attachment's URL to its permanent form.
*/
async function movePendingUploads(appId, draftId, issueId, attachments) {
	const from = pendingDir(appId, draftId);
	const to = uploadsDir(appId, issueId);
	await mkdir(to, { recursive: true });
	let names = [];
	try {
		names = await readdir(from);
	} catch {
		names = [];
	}
	for (const name of names) await rename(path.join(from, name), path.join(to, name));
	await rm(from, {
		recursive: true,
		force: true
	});
	return attachments.map((a) => a.url.includes("/_pending/") ? {
		...a,
		url: `/api/files/${appId}/${issueId}/${a.filename}`
	} : a);
}
/** Delete a stored attachment file (used when an edit removes it). */
async function deleteUploadFile(appId, issueId, filename) {
	const safe = path.basename(filename);
	await rm(path.join(uploadsDir(appId, issueId), safe), { force: true });
}
//#endregion
//#region src/lib/server/store/seed.ts
/**
* First-run bootstrap (§21): seeds ONLY reference data — users, applications
* and settings. No issues are seeded; use the Python simulators under
* `simulators/` to populate test issues on demand.
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
/** Write reference data + empty per-app sequence counters into DATA_DIR. */
async function seedDataDir() {
	await mkdir(configDir(), { recursive: true });
	await writeJsonAtomic(path.join(configDir(), "users.json"), SEED_USERS);
	await writeJsonAtomic(path.join(configDir(), "applications.json"), SEED_APPS);
	await writeJsonAtomic(path.join(configDir(), "settings.json"), {
		productName: "IssueDesk",
		defaultPageSize: 50
	});
	for (const app of SEED_APPS) await writeJsonAtomic(path.join(issuesDir(app.id), "_sequence.json"), {
		code: app.code,
		next: 1
	});
}
//#endregion
//#region src/lib/server/store/indexes.ts
/** Secondary indexes for fast filtering: Map<key, Set<issueId>> (§10). */
var IssueIndexes = class {
	byApp = /* @__PURE__ */ new Map();
	byModule = /* @__PURE__ */ new Map();
	byStatus = /* @__PURE__ */ new Map();
	byPriority = /* @__PURE__ */ new Map();
	byAssignee = /* @__PURE__ */ new Map();
	byReporter = /* @__PURE__ */ new Map();
	byTag = /* @__PURE__ */ new Map();
	add(issue) {
		put(this.byApp, issue.appId, issue.id);
		put(this.byModule, `${issue.appId}/${issue.moduleId}`, issue.id);
		put(this.byStatus, issue.status, issue.id);
		put(this.byPriority, issue.priority, issue.id);
		if (issue.assigneeId) put(this.byAssignee, issue.assigneeId, issue.id);
		put(this.byReporter, issue.reporterId, issue.id);
		for (const tag of issue.tags) put(this.byTag, tag, issue.id);
	}
	remove(issue) {
		drop(this.byApp, issue.appId, issue.id);
		drop(this.byModule, `${issue.appId}/${issue.moduleId}`, issue.id);
		drop(this.byStatus, issue.status, issue.id);
		drop(this.byPriority, issue.priority, issue.id);
		if (issue.assigneeId) drop(this.byAssignee, issue.assigneeId, issue.id);
		drop(this.byReporter, issue.reporterId, issue.id);
		for (const tag of issue.tags) drop(this.byTag, tag, issue.id);
	}
	update(before, after) {
		this.remove(before);
		this.add(after);
	}
};
function put(map, key, id) {
	let set = map.get(key);
	if (!set) map.set(key, set = /* @__PURE__ */ new Set());
	set.add(id);
}
function drop(map, key, id) {
	const set = map.get(key);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) map.delete(key);
}
/** Intersect candidate sets, smallest first; undefined entries are "no constraint". */
function intersect(sets) {
	const active = sets.filter((s) => s !== void 0);
	if (active.length === 0) return void 0;
	active.sort((a, b) => a.size - b.size);
	let result = new Set(active[0]);
	for (const s of active.slice(1)) {
		result = new Set([...result].filter((id) => s.has(id)));
		if (result.size === 0) break;
	}
	return result;
}
/** Union of several keys' sets within one index (e.g. status multi-select). */
function unionOf(map, keys) {
	if (!keys || keys.length === 0) return void 0;
	const out = /* @__PURE__ */ new Set();
	for (const k of keys) for (const id of map.get(k) ?? []) out.add(id);
	return out;
}
//#endregion
//#region src/lib/server/store/index.ts
/**
* IssueStore singleton (§10). Node keeps module singletons alive for the
* process lifetime, so this state persists across requests. Single-instance
* by design.
*/
var loaded = false;
var loadPromise;
var usersList = [];
var appsList = [];
var settingsObj = {
	productName: "IssueDesk",
	defaultPageSize: 50
};
var byId = /* @__PURE__ */ new Map();
var indexes = new IssueIndexes();
var sequences = /* @__PURE__ */ new Map();
async function bootstrapIfEmpty() {
	try {
		await access(path.join(configDir(), "users.json"));
	} catch {
		console.log(`[issuedesk] Empty DATA_DIR at ${dataDir()} — seeding demo dataset`);
		await seedDataDir();
	}
}
async function load() {
	await bootstrapIfEmpty();
	usersList = await loadUsers();
	appsList = await loadApplications();
	settingsObj = await loadSettings();
	byId.clear();
	clearIndexes();
	for (const file of await loadAllIssues()) for (const issue of file.issues) {
		byId.set(issue.id, issue);
		indexes.add(issue);
	}
	for (const app of appsList) {
		const seq = await loadSequence(app.id);
		sequences.set(app.id, seq ?? {
			code: app.code,
			next: 1
		});
	}
	loaded = true;
}
async function ensureLoaded() {
	if (loaded) return;
	loadPromise ??= load();
	await loadPromise;
}
/** Rebuild the in-memory cache from disk (used by the WATCH_FILES re-sync). */
async function reload() {
	loadPromise = load();
	await loadPromise;
}
function users() {
	return usersList;
}
function applications() {
	return appsList;
}
function settings() {
	return settingsObj;
}
/** "CHR-15" per app — the modal's next-ID preview. */
function nextIds() {
	const out = {};
	for (const [appId, seq] of sequences) out[appId] = `${seq.code}-${seq.next}`;
	return out;
}
function get(id) {
	return byId.get(id);
}
function list(filter) {
	const candidateSet = intersect([
		filter.appId ? indexes.byApp.get(filter.appId) ?? /* @__PURE__ */ new Set() : void 0,
		filter.moduleId && filter.appId ? indexes.byModule.get(`${filter.appId}/${filter.moduleId}`) ?? /* @__PURE__ */ new Set() : void 0,
		unionOf(indexes.byStatus, filter.status),
		unionOf(indexes.byPriority, filter.priority),
		filter.assigneeId ? indexes.byAssignee.get(filter.assigneeId) ?? /* @__PURE__ */ new Set() : void 0,
		filter.reporterId ? indexes.byReporter.get(filter.reporterId) ?? /* @__PURE__ */ new Set() : void 0,
		filter.tag ? indexes.byTag.get(filter.tag) ?? /* @__PURE__ */ new Set() : void 0
	]);
	let rows = candidateSet ? [...candidateSet].map((id) => byId.get(id)).filter(Boolean) : [...byId.values()];
	if (filter.type) rows = rows.filter((i) => i.type === filter.type);
	if (filter.q) {
		const q = filter.q.toLowerCase();
		rows = rows.filter((i) => `${i.id} ${i.title} ${i.description} ${i.moduleName} ${i.tags.join(" ")}`.toLowerCase().includes(q));
	}
	if (filter.updatedFrom) rows = rows.filter((i) => i.updatedAt >= filter.updatedFrom);
	if (filter.updatedTo) rows = rows.filter((i) => i.updatedAt <= filter.updatedTo + "￿");
	const key = filter.sort ?? "updated";
	const mul = (filter.dir ?? (key === "id" || key === "title" ? "asc" : "desc")) === "asc" ? 1 : -1;
	rows.sort((a, b) => {
		let av, bv;
		switch (key) {
			case "priority":
				av = -priorityRank(a.priority);
				bv = -priorityRank(b.priority);
				break;
			case "status":
				av = statusRank(a.status);
				bv = statusRank(b.status);
				break;
			case "id":
				av = a.appCode + String(a.seq).padStart(5, "0");
				bv = b.appCode + String(b.seq).padStart(5, "0");
				break;
			case "title":
				av = a.title.toLowerCase();
				bv = b.title.toLowerCase();
				break;
			case "created":
				av = a.createdAt;
				bv = b.createdAt;
				break;
			default:
				av = a.updatedAt;
				bv = b.updatedAt;
		}
		return av < bv ? -mul : av > bv ? mul : 0;
	});
	const total = rows.length;
	if (filter.page || filter.pageSize) {
		const pageSize = filter.pageSize ?? settingsObj.defaultPageSize;
		const page = filter.page ?? 1;
		rows = rows.slice((page - 1) * pageSize, page * pageSize);
	}
	return {
		rows,
		total
	};
}
async function persistModule(appId, moduleId) {
	const group = [...byId.values()].filter((i) => i.appId === appId && i.moduleId === moduleId).sort((a, b) => a.seq - b.seq);
	await writeJsonAtomic(moduleFile(appId, moduleId), group);
}
/** Resolve the app + module labels (the only seeded taxonomy). */
function denormalise(input) {
	const app = appsList.find((a) => a.id === input.appId);
	if (!app) throw new Error(`Unknown application "${input.appId}"`);
	const mod = app.modules.find((m) => m.id === input.moduleId);
	if (!mod) throw new Error(`Unknown module "${input.moduleId}" in ${app.name}`);
	return {
		appId: app.id,
		appCode: app.code,
		appName: app.name,
		moduleId: mod.id,
		moduleCode: mod.code,
		moduleName: mod.name
	};
}
/** Page/form are free text; a leading-slash value is treated as a route path. */
function pageFields(page, form) {
	const p = page?.trim();
	const f = form?.trim();
	return {
		pagePath: p || void 0,
		pageName: p || void 0,
		formName: f || void 0
	};
}
async function create(input, actor, draftId) {
	await ensureLoaded();
	return withLock(`app:${input.appId}`, async () => {
		const loc = denormalise(input);
		const app = appsList.find((a) => a.id === input.appId);
		const seq = sequences.get(app.id) ?? {
			code: app.code,
			next: 1
		};
		const number = seq.next;
		sequences.set(app.id, {
			code: seq.code,
			next: number + 1
		});
		const id = `${seq.code}-${number}`;
		let attachments = input.attachments;
		if (draftId) attachments = await movePendingUploads(app.id, draftId, id, attachments);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const issue = {
			id,
			uuid: v7(),
			seq: number,
			type: input.type,
			title: input.title,
			description: input.description,
			...loc,
			...pageFields(input.page, input.form),
			priority: input.priority,
			status: input.status,
			reporterId: actor,
			assigneeId: input.assigneeId || void 0,
			tags: input.tags,
			attachments,
			testCaseId: input.testCaseId,
			runId: input.runId,
			activity: [{
				id: v7(),
				at: now,
				by: actor,
				kind: "created"
			}],
			createdAt: now,
			updatedAt: now
		};
		byId.set(id, issue);
		indexes.add(issue);
		await writeJsonAtomic(sequenceFile(app.id), sequences.get(app.id));
		await persistModule(app.id, issue.moduleId);
		return issue;
	});
}
async function update(id, patch, actor) {
	await ensureLoaded();
	const before = byId.get(id);
	if (!before) throw new Error(`Issue ${id} not found`);
	return withLock(`app:${before.appId}`, async () => {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const loc = denormalise({
			appId: before.appId,
			moduleId: patch.moduleId ?? before.moduleId
		});
		const page = patch.page !== void 0 ? patch.page : before.pagePath;
		const form = patch.form !== void 0 ? patch.form : before.formName;
		const after = {
			...before,
			...loc,
			...pageFields(page, form),
			type: patch.type ?? before.type,
			title: patch.title ?? before.title,
			description: patch.description ?? before.description,
			priority: patch.priority ?? before.priority,
			status: patch.status ?? before.status,
			assigneeId: patch.assigneeId !== void 0 ? patch.assigneeId || void 0 : before.assigneeId,
			tags: patch.tags ?? before.tags,
			attachments: patch.attachments ?? before.attachments,
			activity: [...before.activity],
			updatedAt: now
		};
		if (after.status !== before.status) after.activity.push({
			id: v7(),
			at: now,
			by: actor,
			kind: "status",
			from: before.status,
			to: after.status
		});
		if (after.priority !== before.priority) after.activity.push({
			id: v7(),
			at: now,
			by: actor,
			kind: "priority",
			from: before.priority,
			to: after.priority
		});
		if ((after.assigneeId ?? "") !== (before.assigneeId ?? "")) after.activity.push({
			id: v7(),
			at: now,
			by: actor,
			kind: "assignee",
			from: before.assigneeId ?? "",
			to: after.assigneeId ?? ""
		});
		if (after.title !== before.title || after.description !== before.description) after.activity.push({
			id: v7(),
			at: now,
			by: actor,
			kind: "edit"
		});
		const keep = new Set(after.attachments.map((a) => a.id));
		for (const gone of before.attachments.filter((a) => !keep.has(a.id))) {
			await deleteUploadFile(before.appId, before.id, gone.filename);
			after.activity.push({
				id: v7(),
				at: now,
				by: actor,
				kind: "attachment",
				from: gone.filename
			});
		}
		byId.set(id, after);
		indexes.update(before, after);
		await persistModule(after.appId, after.moduleId);
		if (after.moduleId !== before.moduleId) await persistModule(before.appId, before.moduleId);
		return after;
	});
}
async function remove(id, _actor) {
	await ensureLoaded();
	const issue = byId.get(id);
	if (!issue) throw new Error(`Issue ${id} not found`);
	await withLock(`app:${issue.appId}`, async () => {
		byId.delete(id);
		indexes.remove(issue);
		await persistModule(issue.appId, issue.moduleId);
	});
}
async function comment(id, message, actor) {
	await ensureLoaded();
	const before = byId.get(id);
	if (!before) throw new Error(`Issue ${id} not found`);
	return withLock(`app:${before.appId}`, async () => {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const after = {
			...before,
			activity: [...before.activity, {
				id: v7(),
				at: now,
				by: actor,
				kind: "comment",
				message
			}],
			updatedAt: now
		};
		byId.set(id, after);
		indexes.update(before, after);
		await persistModule(after.appId, after.moduleId);
		return after;
	});
}
async function upsertUser(user) {
	await ensureLoaded();
	const i = usersList.findIndex((u) => u.id === user.id);
	if (i >= 0) usersList[i] = user;
	else usersList.push(user);
	await writeJsonAtomic(path.join(configDir(), "users.json"), usersList);
}
async function upsertApplication(app) {
	await ensureLoaded();
	const i = appsList.findIndex((a) => a.id === app.id);
	if (i >= 0) appsList[i] = app;
	else {
		appsList.push(app);
		sequences.set(app.id, {
			code: app.code,
			next: 1
		});
		await writeJsonAtomic(sequenceFile(app.id), {
			code: app.code,
			next: 1
		});
	}
	await writeJsonAtomic(path.join(configDir(), "applications.json"), appsList);
}
function clearIndexes() {
	for (const map of [
		indexes.byApp,
		indexes.byModule,
		indexes.byStatus,
		indexes.byPriority,
		indexes.byAssignee,
		indexes.byReporter,
		indexes.byTag
	]) map.clear();
}
/** Sweep stale `_pending` upload folders (boot-time hygiene, §12). */
async function sweepPending() {
	const { rm } = await import('node:fs/promises');
	const base = path.join(dataDir(), "uploads");
	let apps = [];
	try {
		apps = await readdir(base);
	} catch {
		return;
	}
	for (const app of apps) await rm(path.join(base, app, "_pending"), {
		recursive: true,
		force: true
	});
}

export { issueSchema as A, saveUploads as B, UploadError as U, settings as a, applications as b, update as c, comment as d, ensureLoaded as e, remove as f, updateIssueSchema as g, createIssueSchema as h, create as i, applicationSchema as j, upsertApplication as k, list as l, moduleRefSchema as m, nextIds as n, userSchema as o, upsertUser as p, get as q, reload as r, sweepPending as s, loadUsers as t, users as u, loadApplications as v, loadAllIssues as w, withLock as x, settingsSchema as y, sequenceSchema as z };
//# sourceMappingURL=store.js-B62sRqIC.js.map
