import { rm } from 'node:fs/promises';
import { v7 as uuidv7 } from 'uuid';
import type {
	Application,
	CaseResult,
	CreateRunnerInput,
	CreateSuiteInput,
	CreateTestCaseInput,
	IssueTarget,
	TestCase,
	TestCaseFilter,
	TestRun,
	TestRunner,
	TestSuite,
	UpdateRunnerInput,
	UpdateSuiteInput,
	UpdateTestCaseInput
} from '$lib/types';
import {
	checkpointSequenceFile,
	runFile,
	runnersFile,
	suitesFile,
	testModuleFile
} from '../fs/paths';
import {
	loadAllRuns,
	loadAllSuites,
	loadAllTestCases,
	loadCheckpointSequence,
	loadRunners
} from '../fs/checkpointRead';
import { writeJsonAtomic } from '../fs/write';
import { withLock } from './mutex';
import { applications, ensureLoaded as ensureIssuesLoaded } from './index';

/**
 * Checkpoint store (design doc §9). A module-level singleton like the issue
 * store, synced from JSON on boot and write-through on mutation. It reuses the
 * issue store's application taxonomy for denormalisation, the keyed mutex for
 * per-app serialisation, and atomic tmp+rename writes. Kept separate from the
 * issue store so the issue tracker is untouched.
 */

interface Seq {
	testCase: number;
	suite: number;
	run: number;
}

let loaded = false;
let loadPromise: Promise<void> | undefined;

let runnersList: TestRunner[] = [];
const casesById = new Map<string, TestCase>();
const suitesById = new Map<string, TestSuite>();
const runsById = new Map<string, TestRun>();
const seqByApp = new Map<string, Seq>();
let nextRunnerSeq = 1;

/** caseId → its results across runs, oldest run first. Derived from runsById. */
const resultsByCase = new Map<string, Array<{ run: TestRun; result: CaseResult }>>();

// ---------- boot / sync ----------
function seqNumOf(id: string): number {
	const m = id.match(/(\d+)$/);
	return m ? Number(m[1]) : 0;
}

function rebuildResultsIndex(): void {
	resultsByCase.clear();
	const runs = [...runsById.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
	for (const run of runs) {
		for (const result of run.results) {
			let list = resultsByCase.get(result.testCaseId);
			if (!list) resultsByCase.set(result.testCaseId, (list = []));
			list.push({ run, result });
		}
	}
}

async function load(): Promise<void> {
	await ensureIssuesLoaded(); // applications() must be populated first
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
		seqByApp.set(app.id, seq ?? { testCase: 1, suite: 1, run: 1 });
	}

	rebuildResultsIndex();
	loaded = true;
}

export async function ensureLoaded(): Promise<void> {
	if (loaded) return;
	loadPromise ??= load();
	await loadPromise;
}

export async function reload(): Promise<void> {
	loadPromise = load();
	await loadPromise;
}

export function __resetForTests(): void {
	loaded = false;
	loadPromise = undefined;
	runnersList = [];
	casesById.clear();
	suitesById.clear();
	runsById.clear();
	seqByApp.clear();
	resultsByCase.clear();
	nextRunnerSeq = 1;
}

// ---------- denormalisation ----------
function appOf(appId: string): Application {
	const app = applications().find((a) => a.id === appId);
	if (!app) throw new Error(`Unknown application "${appId}"`);
	return app;
}

function targetOf(
	appId: string,
	moduleId: string,
	page?: string,
	form?: string
): { appCode: string; appName: string; target: IssueTarget } {
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
			pageName: page?.trim() || undefined,
			formName: form?.trim() || undefined
		}
	};
}

// ---------- numbering ----------
async function allocate(appId: string, kind: keyof Seq): Promise<number> {
	const seq = seqByApp.get(appId) ?? { testCase: 1, suite: 1, run: 1 };
	const n = seq[kind];
	seq[kind] = n + 1;
	seqByApp.set(appId, seq);
	await writeJsonAtomic(checkpointSequenceFile(appId), seq);
	return n;
}

export function nextCaseId(appId: string): string {
	const seq = seqByApp.get(appId) ?? { testCase: 1, suite: 1, run: 1 };
	return `TC-${appOf(appId).code}-${seq.testCase}`;
}
export function nextSuiteId(appId: string): string {
	const seq = seqByApp.get(appId) ?? { testCase: 1, suite: 1, run: 1 };
	return `SUITE-${appOf(appId).code}-${seq.suite}`;
}
export function nextRunnerId(): string {
	return `RNR-${nextRunnerSeq}`;
}

// ---------- persistence helpers ----------
async function persistCaseModule(appId: string, moduleId: string): Promise<void> {
	const group = [...casesById.values()]
		.filter((c) => c.appId === appId && c.target.moduleId === moduleId)
		.sort((a, b) => a.seq - b.seq);
	await writeJsonAtomic(testModuleFile(appId, moduleId), group);
}

async function persistSuitesForApp(appId: string): Promise<void> {
	const group = [...suitesById.values()].filter((s) => s.appId === appId).sort((a, b) => a.seq - b.seq);
	await writeJsonAtomic(suitesFile(appId), group);
}

// ---------- membership sync (case.suiteIds ↔ suite.caseIds) ----------
async function syncCaseIntoSuites(
	caseId: string,
	oldSuiteIds: string[],
	newSuiteIds: string[]
): Promise<void> {
	const added = newSuiteIds.filter((id) => !oldSuiteIds.includes(id));
	const removed = oldSuiteIds.filter((id) => !newSuiteIds.includes(id));
	const dirtyApps = new Set<string>();
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

async function syncSuiteIntoCases(
	suiteId: string,
	oldCaseIds: string[],
	newCaseIds: string[]
): Promise<void> {
	const added = newCaseIds.filter((id) => !oldCaseIds.includes(id));
	const removed = oldCaseIds.filter((id) => !newCaseIds.includes(id));
	const dirty = new Set<string>(); // `${appId}/${moduleId}`
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
		const [appId, moduleId] = key.split('/');
		await persistCaseModule(appId, moduleId);
	}
}

// ---------- reads ----------
export function runners(): TestRunner[] {
	return runnersList;
}
export function runner(id: string): TestRunner | undefined {
	return runnersList.find((r) => r.id === id);
}
export function getCase(id: string): TestCase | undefined {
	return casesById.get(id);
}
export function cases(): TestCase[] {
	return [...casesById.values()];
}
export function suites(appId?: string): TestSuite[] {
	const all = [...suitesById.values()];
	return (appId ? all.filter((s) => s.appId === appId) : all).sort((a, b) =>
		a.appCode === b.appCode ? a.seq - b.seq : a.appCode.localeCompare(b.appCode)
	);
}
export function getSuite(id: string): TestSuite | undefined {
	return suitesById.get(id);
}
export function runs(appId?: string): TestRun[] {
	const all = [...runsById.values()];
	return (appId ? all.filter((r) => r.appId === appId) : all).sort((a, b) =>
		b.startedAt.localeCompare(a.startedAt)
	);
}
export function getRun(id: string): TestRun | undefined {
	return runsById.get(id);
}

export function resultsForCase(caseId: string): Array<{ run: TestRun; result: CaseResult }> {
	return resultsByCase.get(caseId) ?? [];
}
export function lastResultForCase(
	caseId: string
): { run: TestRun; result: CaseResult } | undefined {
	const list = resultsByCase.get(caseId);
	return list && list.length ? list[list.length - 1] : undefined;
}

/** Filter + sort the case list for the Cases table (design §10.2). */
export function listCases(filter: TestCaseFilter = {}): TestCase[] {
	let rows = [...casesById.values()];
	if (filter.appId) rows = rows.filter((c) => c.appId === filter.appId);
	if (filter.moduleId) rows = rows.filter((c) => c.target.moduleId === filter.moduleId);
	if (filter.kind?.length) rows = rows.filter((c) => filter.kind!.includes(c.kind));
	if (filter.status?.length) rows = rows.filter((c) => filter.status!.includes(c.status));
	if (filter.tag) rows = rows.filter((c) => c.tags.includes(filter.tag!));
	if (filter.lastResult?.length) {
		rows = rows.filter((c) => {
			const last = lastResultForCase(c.id);
			const key = last ? last.result.status : 'none';
			return filter.lastResult!.includes(key);
		});
	}
	if (filter.q) {
		const q = filter.q.toLowerCase();
		rows = rows.filter((c) =>
			`${c.id} ${c.title} ${c.specPath ?? ''} ${c.target.moduleName} ${c.tags.join(' ')}`
				.toLowerCase()
				.includes(q)
		);
	}
	// Newest first within each app (matches the mockup: TC-CHR-12, 11, 10 …).
	return rows.sort((a, b) => (a.appCode === b.appCode ? b.seq - a.seq : a.appCode.localeCompare(b.appCode)));
}

// ---------- test cases: writes ----------
export async function createCase(input: CreateTestCaseInput, actor: string): Promise<TestCase> {
	await ensureLoaded();
	return withLock(`cp:app:${input.appId}`, async () => {
		const { appCode, appName, target } = targetOf(input.appId, input.moduleId, input.page, input.form);
		const n = await allocate(input.appId, 'testCase');
		const id = `TC-${appCode}-${n}`;
		const now = new Date().toISOString();
		const manual = input.kind === 'manual';
		const testCase: TestCase = {
			id,
			uuid: uuidv7(),
			seq: n,
			appId: input.appId,
			appCode,
			appName,
			target,
			title: input.title,
			preconditions: input.preconditions || undefined,
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

export async function updateCase(
	id: string,
	patch: UpdateTestCaseInput,
	_actor: string
): Promise<TestCase> {
	await ensureLoaded();
	const before = casesById.get(id);
	if (!before) throw new Error(`Test case ${id} not found`);
	return withLock(`cp:app:${before.appId}`, async () => {
		const moduleId = patch.moduleId ?? before.target.moduleId;
		const { appCode, appName, target } = targetOf(
			before.appId,
			moduleId,
			patch.page !== undefined ? patch.page : before.target.pageName,
			patch.form !== undefined ? patch.form : before.target.formName
		);
		const manual = (patch.kind ?? before.kind) === 'manual';
		const after: TestCase = {
			...before,
			appCode,
			appName,
			target,
			title: patch.title ?? before.title,
			preconditions:
				patch.preconditions !== undefined ? patch.preconditions || undefined : before.preconditions,
			steps: patch.steps ?? before.steps,
			priority: patch.priority ?? before.priority,
			status: patch.status ?? before.status,
			tags: patch.tags ?? before.tags,
			kind: patch.kind ?? before.kind,
			runnerId: manual ? null : (patch.runnerId !== undefined ? patch.runnerId : before.runnerId),
			specPath: manual ? null : (patch.specPath !== undefined ? patch.specPath : before.specPath),
			externalTestId: manual
				? null
				: patch.externalTestId !== undefined
					? patch.externalTestId
					: before.externalTestId,
			parentIssueId: patch.parentIssueId !== undefined ? patch.parentIssueId : before.parentIssueId,
			suiteIds: patch.suiteIds ?? before.suiteIds,
			updatedAt: new Date().toISOString()
		};
		casesById.set(id, after);
		await persistCaseModule(before.appId, before.target.moduleId);
		if (moduleId !== before.target.moduleId) await persistCaseModule(before.appId, moduleId);
		if (patch.suiteIds) await syncCaseIntoSuites(id, before.suiteIds, after.suiteIds);
		return after;
	});
}

export async function deleteCase(id: string): Promise<void> {
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
export async function addFiledIssueToCase(caseId: string, issueId: string): Promise<void> {
	await ensureLoaded();
	const c = casesById.get(caseId);
	if (!c) return;
	await withLock(`cp:app:${c.appId}`, async () => {
		if (!c.issueIds.includes(issueId)) {
			c.issueIds.push(issueId);
			c.updatedAt = new Date().toISOString();
			await persistCaseModule(c.appId, c.target.moduleId);
		}
	});
}

// ---------- suites: writes ----------
export async function createSuite(input: CreateSuiteInput, _actor: string): Promise<TestSuite> {
	await ensureLoaded();
	return withLock(`cp:app:${input.appId}`, async () => {
		const app = appOf(input.appId);
		const n = await allocate(input.appId, 'suite');
		const id = `SUITE-${app.code}-${n}`;
		const now = new Date().toISOString();
		const suite: TestSuite = {
			id,
			seq: n,
			appId: input.appId,
			appCode: app.code,
			appName: app.name,
			name: input.name,
			description: input.description || undefined,
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

export async function updateSuite(
	id: string,
	patch: UpdateSuiteInput,
	_actor: string
): Promise<TestSuite> {
	await ensureLoaded();
	const before = suitesById.get(id);
	if (!before) throw new Error(`Suite ${id} not found`);
	return withLock(`cp:app:${before.appId}`, async () => {
		const after: TestSuite = {
			...before,
			name: patch.name ?? before.name,
			description:
				patch.description !== undefined ? patch.description || undefined : before.description,
			caseIds: patch.caseIds ?? before.caseIds,
			defaultEnv: patch.defaultEnv ?? before.defaultEnv,
			tags: patch.tags ?? before.tags,
			updatedAt: new Date().toISOString()
		};
		suitesById.set(id, after);
		await persistSuitesForApp(before.appId);
		if (patch.caseIds) await syncSuiteIntoCases(id, before.caseIds, after.caseIds);
		return after;
	});
}

export async function duplicateSuite(id: string, actor: string): Promise<TestSuite> {
	await ensureLoaded();
	const src = suitesById.get(id);
	if (!src) throw new Error(`Suite ${id} not found`);
	return createSuite(
		{
			appId: src.appId,
			name: `${src.name} (copy)`,
			description: src.description,
			caseIds: [...src.caseIds],
			defaultEnv: src.defaultEnv,
			tags: [...src.tags]
		},
		actor
	);
}

export async function deleteSuite(id: string): Promise<void> {
	await ensureLoaded();
	const s = suitesById.get(id);
	if (!s) throw new Error(`Suite ${id} not found`);
	await withLock(`cp:app:${s.appId}`, async () => {
		suitesById.delete(id);
		await persistSuitesForApp(s.appId);
		await syncSuiteIntoCases(id, s.caseIds, []); // strip the suiteId from member cases
	});
}

// ---------- runners: writes ----------
export async function createRunner(input: CreateRunnerInput): Promise<TestRunner> {
	await ensureLoaded();
	return withLock('cp:runners', async () => {
		const id = `RNR-${nextRunnerSeq}`;
		nextRunnerSeq += 1;
		const runnerRec: TestRunner = { id, ...input };
		runnersList.push(runnerRec);
		await writeJsonAtomic(runnersFile(), runnersList);
		return runnerRec;
	});
}

export async function updateRunner(id: string, patch: UpdateRunnerInput): Promise<TestRunner> {
	await ensureLoaded();
	return withLock('cp:runners', async () => {
		const i = runnersList.findIndex((r) => r.id === id);
		if (i < 0) throw new Error(`Runner ${id} not found`);
		runnersList[i] = { ...runnersList[i], ...patch, id };
		await writeJsonAtomic(runnersFile(), runnersList);
		return runnersList[i];
	});
}

export async function toggleRunner(id: string, enabled: boolean): Promise<TestRunner> {
	return updateRunner(id, { enabled });
}

export async function deleteRunner(id: string): Promise<void> {
	await ensureLoaded();
	await withLock('cp:runners', async () => {
		runnersList = runnersList.filter((r) => r.id !== id);
		await writeJsonAtomic(runnersFile(), runnersList);
	});
}

// ---------- runs: writes ----------
/** Allocate the next run id for an app (locked + persisted). */
export async function allocateRunId(appId: string): Promise<string> {
	await ensureLoaded();
	return withLock(`cp:app:${appId}`, async () => {
		const n = await allocate(appId, 'run');
		return `RUN-${appOf(appId).code}-${n}`;
	});
}

/** Persist a run (created or updated) and refresh the derived results index. */
export async function saveRun(run: TestRun): Promise<TestRun> {
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
export async function setRunArchived(runId: string, archived: boolean): Promise<TestRun> {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	const next: TestRun = { ...run, archived };
	if (archived) next.archivedAt = new Date().toISOString();
	else delete next.archivedAt;
	return saveRun(next);
}

/** Delete one run and its stored file. Run history is append-only until asked. */
export async function deleteRun(runId: string): Promise<void> {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) return;
	await withLock(`cp:run:${runId}`, async () => {
		runsById.delete(runId);
		await rm(runFile(run.appId, runId), { force: true });
		rebuildResultsIndex();
	});
}

export interface PruneFilter {
	/** Delete runs started strictly before this ISO instant. */
	before: string;
	/** Restrict to one suite, so a noisy suite can be cleaned on its own. */
	suiteId?: string;
	appId?: string;
}

/** Which runs a prune would remove — archived and in-flight runs are never included. */
export function prunableRuns(filter: PruneFilter): TestRun[] {
	return runs(filter.appId).filter(
		(r) =>
			!r.archived &&
			r.completedAt && // never delete a run that is still executing
			r.startedAt < filter.before &&
			(!filter.suiteId || r.suiteId === filter.suiteId)
	);
}

/** Delete every run matching the filter; returns the ids removed. */
export async function pruneRuns(filter: PruneFilter): Promise<string[]> {
	const doomed = prunableRuns(filter);
	for (const run of doomed) await deleteRun(run.id);
	return doomed.map((r) => r.id);
}

/** Record or replace one case's result in a run (manual marking / bug link). */
export async function recordResult(runId: string, result: CaseResult): Promise<TestRun> {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	const results = run.results.filter(
		(r) => !(r.testCaseId === result.testCaseId && r.runnerId === result.runnerId)
	);
	results.push(result);
	return saveRun({ ...run, results });
}

/** Mark a run complete (immutable history from here on). */
export async function completeRun(runId: string): Promise<TestRun> {
	await ensureLoaded();
	const run = runsById.get(runId);
	if (!run) throw new Error(`Run ${runId} not found`);
	return saveRun({ ...run, completedAt: run.completedAt ?? new Date().toISOString() });
}
