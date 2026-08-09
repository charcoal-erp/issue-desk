import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type {
	Application,
	Attachment,
	Category,
	CreateIssueInput,
	Issue,
	IssueFilter,
	Settings,
	Source,
	UpdateIssueInput,
	User
} from '$lib/types';
import { priorityRank } from '$lib/priority';
import { statusRank } from '$lib/status';
import { configDir, dataDir, moduleFile, sequenceFile } from '../fs/paths';
import {
	loadAllIssues,
	loadApplications,
	loadCategories,
	loadSequence,
	loadSettings,
	loadUsers
} from '../fs/read';
import { writeJsonAtomic } from '../fs/write';
import { deleteUploadFile, movePendingUploads } from '../uploads';
import { SEED_CATEGORIES, seedDataDir } from './seed';
import { IssueIndexes, intersect, unionOf } from './indexes';
import { withLock } from './mutex';

/**
 * IssueStore singleton (§10). Node keeps module singletons alive for the
 * process lifetime, so this state persists across requests. Single-instance
 * by design.
 */

let loaded = false;
let loadPromise: Promise<void> | undefined;

let usersList: User[] = [];
let appsList: Application[] = [];
let categoriesList: Category[] = [];
let settingsObj: Settings = { productName: 'IssueDesk', defaultPageSize: 50 };

const byId = new Map<string, Issue>();
const indexes = new IssueIndexes();
const sequences = new Map<string, { code: string; next: number }>();

async function bootstrapIfEmpty(): Promise<void> {
	try {
		await access(path.join(configDir(), 'users.json'));
	} catch {
		console.log(`[issuedesk] Empty DATA_DIR at ${dataDir()} — seeding demo dataset`);
		await seedDataDir();
	}
}

async function load(): Promise<void> {
	await bootstrapIfEmpty();
	usersList = await loadUsers();
	appsList = await loadApplications();
	categoriesList = await ensureCategoriesFile();
	settingsObj = await loadSettings();
	byId.clear();
	clearIndexes();
	for (const file of await loadAllIssues()) {
		for (const issue of file.issues) {
			byId.set(issue.id, issue);
			indexes.add(issue);
		}
	}
	for (const app of appsList) {
		const seq = await loadSequence(app.id);
		sequences.set(app.id, seq ?? { code: app.code, next: 1 });
	}
	loaded = true;
}

/**
 * Categories arrived after the first data dirs were written, so a dir without
 * the file gets the starter vocabulary rather than an empty picker. Written
 * once — after that the file is authoritative, empty list included.
 */
async function ensureCategoriesFile(): Promise<Category[]> {
	const file = path.join(configDir(), 'categories.json');
	try {
		await access(file);
	} catch {
		await writeJsonAtomic(file, SEED_CATEGORIES);
		return SEED_CATEGORIES;
	}
	return loadCategories();
}

export async function ensureLoaded(): Promise<void> {
	if (loaded) return;
	loadPromise ??= load();
	await loadPromise;
}

/** Rebuild the in-memory cache from disk (used by the WATCH_FILES re-sync). */
export async function reload(): Promise<void> {
	loadPromise = load();
	await loadPromise;
}

// ---------- reference data ----------
export function users(): User[] {
	return usersList;
}
export function applications(): Application[] {
	return appsList;
}
export function categories(): Category[] {
	return categoriesList;
}
export function settings(): Settings {
	return settingsObj;
}

/** Distinct tag slugs currently in use — the reconciliation vocabulary for AI tag extraction. */
export function tags(): string[] {
	return [...indexes.byTag.keys()];
}

/** "CHR-15" per app — the modal's next-ID preview. */
export function nextIds(): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [appId, seq] of sequences) out[appId] = `${seq.code}-${seq.next}`;
	return out;
}

// ---------- reads ----------
export function get(id: string): Issue | undefined {
	return byId.get(id);
}

export function list(filter: IssueFilter): { rows: Issue[]; total: number } {
	// 1. Index intersection for equality facets (§13).
	const candidateSet = intersect([
		filter.appId ? (indexes.byApp.get(filter.appId) ?? new Set()) : undefined,
		filter.moduleId && filter.appId
			? (indexes.byModule.get(`${filter.appId}/${filter.moduleId}`) ?? new Set())
			: undefined,
		unionOf(indexes.byStatus, filter.status),
		unionOf(indexes.byPriority, filter.priority),
		unionOf(indexes.bySource, filter.source),
		filter.assigneeId ? (indexes.byAssignee.get(filter.assigneeId) ?? new Set()) : undefined,
		filter.reporterId ? (indexes.byReporter.get(filter.reporterId) ?? new Set()) : undefined,
		filter.categoryId ? (indexes.byCategory.get(filter.categoryId) ?? new Set()) : undefined,
		filter.tag ? (indexes.byTag.get(filter.tag) ?? new Set()) : undefined
	]);
	let rows = candidateSet
		? [...candidateSet].map((id) => byId.get(id)!).filter(Boolean)
		: [...byId.values()];

	// 2. Residual predicates.
	if (filter.type) rows = rows.filter((i) => i.type === filter.type);
	if (filter.q) {
		const q = filter.q.toLowerCase();
		rows = rows.filter((i) =>
			`${i.id} ${i.title} ${i.description} ${i.moduleName ?? ''} ${i.tags.join(' ')}`
				.toLowerCase()
				.includes(q)
		);
	}
	if (filter.updatedFrom) rows = rows.filter((i) => i.updatedAt >= filter.updatedFrom!);
	if (filter.updatedTo) rows = rows.filter((i) => i.updatedAt <= filter.updatedTo! + '￿');

	// 3. Sort (default: updated desc).
	const key = filter.sort ?? 'updated';
	const dir = filter.dir ?? (key === 'id' || key === 'title' ? 'asc' : 'desc');
	const mul = dir === 'asc' ? 1 : -1;
	rows.sort((a, b) => {
		let av: string | number, bv: string | number;
		switch (key) {
			case 'priority':
				// Rank inverted so "desc" surfaces Critical first (§13).
				av = -priorityRank(a.priority);
				bv = -priorityRank(b.priority);
				break;
			case 'status':
				av = statusRank(a.status);
				bv = statusRank(b.status);
				break;
			case 'id':
				av = a.appCode + String(a.seq).padStart(5, '0');
				bv = b.appCode + String(b.seq).padStart(5, '0');
				break;
			case 'title':
				av = a.title.toLowerCase();
				bv = b.title.toLowerCase();
				break;
			case 'created':
				av = a.createdAt;
				bv = b.createdAt;
				break;
			default:
				av = a.updatedAt;
				bv = b.updatedAt;
		}
		return av < bv ? -mul : av > bv ? mul : 0;
	});

	// 4. Paginate.
	const total = rows.length;
	if (filter.page || filter.pageSize) {
		const pageSize = filter.pageSize ?? settingsObj.defaultPageSize;
		const page = filter.page ?? 1;
		rows = rows.slice((page - 1) * pageSize, page * pageSize);
	}
	return { rows, total };
}

// ---------- persistence helpers ----------
/**
 * Which file an issue lives in. Module is optional, so module-less issues need
 * a home: `unassigned.json`. Grouping and filtering both go through this one
 * function, so an app that happens to have a real module called "unassigned"
 * simply shares the file rather than the two halves overwriting each other.
 */
export const UNASSIGNED_MODULE_FILE = 'unassigned';

function moduleFileKey(issue: Issue): string {
	return issue.moduleId || UNASSIGNED_MODULE_FILE;
}

async function persistModule(appId: string, fileKey: string): Promise<void> {
	const group = [...byId.values()]
		.filter((i) => i.appId === appId && moduleFileKey(i) === fileKey)
		.sort((a, b) => a.seq - b.seq);
	await writeJsonAtomic(moduleFile(appId, fileKey), group);
}

/**
 * Resolve the app + module labels (the only seeded taxonomy). An absent module
 * is valid and leaves the module fields unset; a *named* module that doesn't
 * exist is still an error.
 */
function denormalise(input: { appId: string; moduleId?: string }) {
	const app = appsList.find((a) => a.id === input.appId);
	if (!app) throw new Error(`Unknown application "${input.appId}"`);
	const base = { appId: app.id, appCode: app.code, appName: app.name };
	if (!input.moduleId) {
		return { ...base, moduleId: undefined, moduleCode: undefined, moduleName: undefined };
	}
	const mod = app.modules.find((m) => m.id === input.moduleId);
	if (!mod) throw new Error(`Unknown module "${input.moduleId}" in ${app.name}`);
	return { ...base, moduleId: mod.id, moduleCode: mod.code, moduleName: mod.name };
}

/**
 * Where an issue came from, decided by who filed it rather than by a dropdown.
 * The Checkpoint ingest path has no session, so the route passes the source
 * explicitly; everything else follows the account kind.
 */
export function sourceFor(actorId: string): Source {
	return usersList.find((u) => u.id === actorId)?.kind === 'agent'
		? 'agent-testing'
		: 'manual-testing';
}

/** Page/form are free text; a leading-slash value is treated as a route path. */
function pageFields(page?: string, form?: string) {
	const p = page?.trim();
	const f = form?.trim();
	return {
		pagePath: p || undefined,
		pageName: p || undefined,
		formName: f || undefined
	};
}

// ---------- writes (write-through, §6.3) ----------
export async function create(
	input: CreateIssueInput,
	actor: string,
	draftId?: string,
	source?: Source
): Promise<Issue> {
	await ensureLoaded();
	return withLock(`app:${input.appId}`, async () => {
		const loc = denormalise(input);
		const app = appsList.find((a) => a.id === input.appId)!;
		const seq = sequences.get(app.id) ?? { code: app.code, next: 1 };
		const number = seq.next;
		sequences.set(app.id, { code: seq.code, next: number + 1 });
		const id = `${seq.code}-${number}`;

		let attachments = input.attachments;
		if (draftId) attachments = await movePendingUploads(app.id, draftId, id, attachments);

		const now = new Date().toISOString();
		const issue: Issue = {
			id,
			uuid: uuidv7(),
			seq: number,
			type: input.type,
			title: input.title,
			description: input.description,
			...loc,
			...pageFields(input.page, input.form),
			priority: input.priority,
			status: input.status,
			source: source ?? sourceFor(actor),
			reporterId: actor,
			assigneeId: input.assigneeId || undefined,
			categoryId: input.categoryId || undefined,
			tags: input.tags,
			attachments,
			testCaseId: input.testCaseId,
			runId: input.runId,
			activity: [{ id: uuidv7(), at: now, by: actor, kind: 'created' }],
			createdAt: now,
			updatedAt: now
		};
		byId.set(id, issue);
		indexes.add(issue);
		await writeJsonAtomic(sequenceFile(app.id), sequences.get(app.id));
		await persistModule(app.id, moduleFileKey(issue));
		return issue;
	});
}

export async function update(id: string, patch: UpdateIssueInput, actor: string): Promise<Issue> {
	await ensureLoaded();
	const existing = byId.get(id);
	if (!existing) throw new Error(`Issue ${id} not found`);
	return withLock(`app:${existing.appId}`, async () => {
		// Re-read inside the lock: another writer may have landed while we queued.
		const before = byId.get(id);
		if (!before) throw new Error(`Issue ${id} not found`);
		return applyUpdate(before, patch, actor);
	});
}

/**
 * The update body, minus the locking. Callers must already hold
 * `app:<appId>` — `update` and `claim` both do. Split out so a claim can
 * read-check-and-write as one atomic step: two agents asking for work at the
 * same moment must not both walk away with the same issue.
 */
async function applyUpdate(before: Issue, patch: UpdateIssueInput, actor: string): Promise<Issue> {
	const id = before.id;
	{
		const now = new Date().toISOString();
		const loc = denormalise({
			appId: before.appId, // app never changes — the ID is per-app
			// `moduleId: ''` is how the form clears the module; `undefined` means
			// "not part of this patch" and keeps whatever the issue already had.
			moduleId: patch.moduleId !== undefined ? patch.moduleId || undefined : before.moduleId
		});
		const page = patch.page !== undefined ? patch.page : before.pagePath;
		const form = patch.form !== undefined ? patch.form : before.formName;
		const after: Issue = {
			...before,
			...loc,
			...pageFields(page, form),
			type: patch.type ?? before.type,
			title: patch.title ?? before.title,
			description: patch.description ?? before.description,
			priority: patch.priority ?? before.priority,
			status: patch.status ?? before.status,
			assigneeId:
				patch.assigneeId !== undefined ? patch.assigneeId || undefined : before.assigneeId,
			categoryId:
				patch.categoryId !== undefined ? patch.categoryId || undefined : before.categoryId,
			tags: patch.tags ?? before.tags,
			attachments: patch.attachments ?? before.attachments,
			activity: [...before.activity],
			updatedAt: now
		};

		// Activity entries for tracked field changes.
		if (after.status !== before.status)
			after.activity.push({
				id: uuidv7(), at: now, by: actor, kind: 'status', from: before.status, to: after.status
			});
		if (after.priority !== before.priority)
			after.activity.push({
				id: uuidv7(), at: now, by: actor, kind: 'priority', from: before.priority, to: after.priority
			});
		if ((after.assigneeId ?? '') !== (before.assigneeId ?? ''))
			after.activity.push({
				id: uuidv7(), at: now, by: actor, kind: 'assignee',
				from: before.assigneeId ?? '', to: after.assigneeId ?? ''
			});
		if (after.title !== before.title || after.description !== before.description)
			after.activity.push({ id: uuidv7(), at: now, by: actor, kind: 'edit' });

		// Delete files for attachments that were removed.
		const keep = new Set(after.attachments.map((a) => a.id));
		for (const gone of before.attachments.filter((a) => !keep.has(a.id))) {
			await deleteUploadFile(before.appId, before.id, gone.filename);
			after.activity.push({
				id: uuidv7(), at: now, by: actor, kind: 'attachment', from: gone.filename
			});
		}

		byId.set(id, after);
		indexes.update(before, after);
		await persistModule(after.appId, moduleFileKey(after));
		// Moving between modules rewrites both files, or the issue would exist in
		// two places on disk until something else touched the old one.
		if (moduleFileKey(after) !== moduleFileKey(before)) {
			await persistModule(before.appId, moduleFileKey(before));
		}
		return after;
	}
}

/** Why a claim was refused — each maps to a distinct API response. */
export type ClaimRefusal = 'not-found' | 'taken' | 'not-claimable';
export type ClaimResult =
	| { ok: true; issue: Issue }
	| { ok: false; reason: ClaimRefusal; issue?: Issue };

/**
 * Take ownership of an issue: assign it to `actor` and move it to in-progress,
 * but only if it is genuinely free. The check and the write happen under one
 * lock, so of two agents claiming the same issue exactly one wins and the other
 * is told it is taken.
 *
 * Re-claiming something you already hold succeeds — an agent that retries after
 * a dropped connection should not be punished for it.
 */
export async function claim(id: string, actor: string): Promise<ClaimResult> {
	await ensureLoaded();
	const existing = byId.get(id);
	if (!existing) return { ok: false, reason: 'not-found' };

	return withLock(`app:${existing.appId}`, async () => {
		const before = byId.get(id);
		if (!before) return { ok: false, reason: 'not-found' };
		if (before.assigneeId && before.assigneeId !== actor) {
			return { ok: false, reason: 'taken', issue: before };
		}
		// Verified and closed work is nobody's to pick up.
		if (before.status !== 'open' && before.status !== 'in-progress') {
			return { ok: false, reason: 'not-claimable', issue: before };
		}
		const issue = await applyUpdate(before, { assigneeId: actor, status: 'in-progress' }, actor);
		return { ok: true, issue };
	});
}

export async function remove(id: string, _actor: string): Promise<void> {
	await ensureLoaded();
	const issue = byId.get(id);
	if (!issue) throw new Error(`Issue ${id} not found`);
	await withLock(`app:${issue.appId}`, async () => {
		byId.delete(id);
		indexes.remove(issue);
		await persistModule(issue.appId, moduleFileKey(issue));
	});
}

export async function addAttachments(
	id: string,
	added: Attachment[],
	actor: string
): Promise<Issue> {
	await ensureLoaded();
	const issue = byId.get(id);
	if (!issue) throw new Error(`Issue ${id} not found`);
	return update(id, { attachments: [...issue.attachments, ...added] }, actor);
}

export async function comment(id: string, message: string, actor: string): Promise<Issue> {
	await ensureLoaded();
	const before = byId.get(id);
	if (!before) throw new Error(`Issue ${id} not found`);
	return withLock(`app:${before.appId}`, async () => {
		const now = new Date().toISOString();
		const after: Issue = {
			...before,
			activity: [
				...before.activity,
				{ id: uuidv7(), at: now, by: actor, kind: 'comment', message }
			],
			updatedAt: now
		};
		byId.set(id, after);
		indexes.update(before, after);
		await persistModule(after.appId, moduleFileKey(after));
		return after;
	});
}

// ---------- reference-data mutations (admin, FR-8) ----------
export async function upsertUser(user: User): Promise<void> {
	await ensureLoaded();
	const i = usersList.findIndex((u) => u.id === user.id);
	if (i >= 0) usersList[i] = user;
	else usersList.push(user);
	await writeJsonAtomic(path.join(configDir(), 'users.json'), usersList);
}

export async function upsertApplication(app: Application): Promise<void> {
	await ensureLoaded();
	const i = appsList.findIndex((a) => a.id === app.id);
	if (i >= 0) appsList[i] = app;
	else {
		appsList.push(app);
		sequences.set(app.id, { code: app.code, next: 1 });
		await writeJsonAtomic(sequenceFile(app.id), { code: app.code, next: 1 });
	}
	await writeJsonAtomic(path.join(configDir(), 'applications.json'), appsList);
	// Denormalised labels on issues refresh lazily on next edit (§8).
}

export async function upsertCategory(category: Category): Promise<void> {
	await ensureLoaded();
	const i = categoriesList.findIndex((c) => c.id === category.id);
	if (i >= 0) categoriesList[i] = category;
	else categoriesList.push(category);
	await writeJsonAtomic(path.join(configDir(), 'categories.json'), categoriesList);
}

/**
 * Removing a category leaves `categoryId` dangling on issues that used it —
 * they stay listed and simply show as uncategorised, which is preferable to
 * rewriting every module file to chase a config edit.
 */
export async function removeCategory(id: string): Promise<void> {
	await ensureLoaded();
	const next = categoriesList.filter((c) => c.id !== id);
	if (next.length === categoriesList.length) return;
	categoriesList = next;
	await writeJsonAtomic(path.join(configDir(), 'categories.json'), categoriesList);
}

function clearIndexes(): void {
	for (const map of [
		indexes.byApp, indexes.byModule, indexes.byStatus, indexes.byPriority,
		indexes.bySource, indexes.byAssignee, indexes.byReporter, indexes.byCategory, indexes.byTag
	])
		map.clear();
}

/** Test-only: reset in-memory state so a fresh DATA_DIR can be loaded. */
export function __resetForTests(): void {
	loaded = false;
	loadPromise = undefined;
	usersList = [];
	appsList = [];
	categoriesList = [];
	byId.clear();
	sequences.clear();
	clearIndexes();
}

/** Sweep stale `_pending` upload folders (boot-time hygiene, §12). */
export async function sweepPending(): Promise<void> {
	const { rm } = await import('node:fs/promises');
	const base = path.join(dataDir(), 'uploads');
	let apps: string[] = [];
	try {
		apps = await readdir(base);
	} catch {
		return;
	}
	for (const app of apps) {
		await rm(path.join(base, app, '_pending'), { recursive: true, force: true });
	}
}
