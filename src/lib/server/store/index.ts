import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type {
	Application,
	Attachment,
	CreateIssueInput,
	Issue,
	IssueFilter,
	Settings,
	UpdateIssueInput,
	User
} from '$lib/types';
import { priorityRank } from '$lib/priority';
import { statusRank } from '$lib/status';
import { configDir, dataDir, moduleFile, sequenceFile } from '../fs/paths';
import {
	loadAllIssues,
	loadApplications,
	loadSequence,
	loadSettings,
	loadUsers
} from '../fs/read';
import { writeJsonAtomic } from '../fs/write';
import { deleteUploadFile, movePendingUploads } from '../uploads';
import { seedDataDir } from './seed';
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
		filter.assigneeId ? (indexes.byAssignee.get(filter.assigneeId) ?? new Set()) : undefined,
		filter.reporterId ? (indexes.byReporter.get(filter.reporterId) ?? new Set()) : undefined,
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
			`${i.id} ${i.title} ${i.description} ${i.moduleName} ${i.tags.join(' ')}`
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
async function persistModule(appId: string, moduleId: string): Promise<void> {
	const group = [...byId.values()]
		.filter((i) => i.appId === appId && i.moduleId === moduleId)
		.sort((a, b) => a.seq - b.seq);
	await writeJsonAtomic(moduleFile(appId, moduleId), group);
}

/** Resolve the app + module labels (the only seeded taxonomy). */
function denormalise(input: { appId: string; moduleId: string }) {
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
	draftId?: string
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
			reporterId: actor,
			assigneeId: input.assigneeId || undefined,
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
		await persistModule(app.id, issue.moduleId);
		return issue;
	});
}

export async function update(id: string, patch: UpdateIssueInput, actor: string): Promise<Issue> {
	await ensureLoaded();
	const before = byId.get(id);
	if (!before) throw new Error(`Issue ${id} not found`);
	return withLock(`app:${before.appId}`, async () => {
		const now = new Date().toISOString();
		const loc = denormalise({
			appId: before.appId, // app never changes — the ID is per-app
			moduleId: patch.moduleId ?? before.moduleId
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
		await persistModule(after.appId, after.moduleId);
		if (after.moduleId !== before.moduleId) await persistModule(before.appId, before.moduleId);
		return after;
	});
}

export async function remove(id: string, _actor: string): Promise<void> {
	await ensureLoaded();
	const issue = byId.get(id);
	if (!issue) throw new Error(`Issue ${id} not found`);
	await withLock(`app:${issue.appId}`, async () => {
		byId.delete(id);
		indexes.remove(issue);
		await persistModule(issue.appId, issue.moduleId);
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
		await persistModule(after.appId, after.moduleId);
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

function clearIndexes(): void {
	for (const map of [
		indexes.byApp, indexes.byModule, indexes.byStatus, indexes.byPriority,
		indexes.byAssignee, indexes.byReporter, indexes.byTag
	])
		map.clear();
}

/** Test-only: reset in-memory state so a fresh DATA_DIR can be loaded. */
export function __resetForTests(): void {
	loaded = false;
	loadPromise = undefined;
	usersList = [];
	appsList = [];
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
