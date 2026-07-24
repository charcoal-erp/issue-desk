import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
	checkpointSequenceSchema,
	testCaseSchema,
	testRunSchema,
	testRunnerSchema,
	testSuiteSchema
} from '$lib/schemas';
import type { TestCase, TestRun, TestRunner, TestSuite } from '$lib/types';
import { runnersFile, runsDir, suitesDir, suitesFile, testsDir } from './paths';
import { readJson, safeParse } from './read';

/** Directory names under a base dir, or [] if the base does not exist yet. */
async function subdirs(base: string): Promise<string[]> {
	try {
		return (await readdir(base, { withFileTypes: true }))
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
	} catch {
		return [];
	}
}

/** `*.json` files (skipping `_`-prefixed bookkeeping files) in a dir. */
async function jsonFiles(dir: string): Promise<string[]> {
	try {
		return (await readdir(dir)).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
	} catch {
		return [];
	}
}

// ---------- Runners (global) ----------
export async function loadRunners(): Promise<TestRunner[]> {
	const raw = await readJson(runnersFile());
	return safeParse(z.array(testRunnerSchema), raw ?? [], 'runners.json') ?? [];
}

// ---------- Test cases (per app / module) ----------
export interface LoadedTestFile {
	appId: string;
	moduleId: string;
	cases: TestCase[];
}

export async function loadAllTestCases(): Promise<LoadedTestFile[]> {
	const out: LoadedTestFile[] = [];
	for (const appId of await subdirs(testsDir())) {
		for (const file of await jsonFiles(testsDir(appId))) {
			const raw = await readJson(path.join(testsDir(appId), file));
			const cases = safeParse(z.array(testCaseSchema), raw, `tests/${appId}/${file}`);
			if (cases) out.push({ appId, moduleId: file.replace(/\.json$/, ''), cases });
		}
	}
	return out;
}

// ---------- Suites (one file per app) ----------
export async function loadSuitesForApp(appId: string): Promise<TestSuite[]> {
	const raw = await readJson(suitesFile(appId));
	return safeParse(z.array(testSuiteSchema), raw ?? [], `suites/${appId}.json`) ?? [];
}

export async function loadAllSuites(): Promise<TestSuite[]> {
	const out: TestSuite[] = [];
	for (const file of await jsonFiles(suitesDir())) {
		const raw = await readJson(path.join(suitesDir(), file));
		const suites = safeParse(z.array(testSuiteSchema), raw, `suites/${file}`);
		if (suites) out.push(...suites);
	}
	return out;
}

// ---------- Runs (one file per run, under the app dir) ----------
export async function loadAllRuns(): Promise<TestRun[]> {
	const out: TestRun[] = [];
	for (const appId of await subdirs(runsDir())) {
		for (const file of await jsonFiles(runsDir(appId))) {
			const raw = await readJson(path.join(runsDir(appId), file));
			const run = safeParse(testRunSchema, raw, `runs/${appId}/${file}`);
			if (run) out.push(run);
		}
	}
	return out;
}

// ---------- Per-app Checkpoint sequence ----------
export async function loadCheckpointSequence(
	appId: string
): Promise<{ testCase: number; suite: number; run: number } | undefined> {
	const raw = await readJson(path.join(testsDir(appId), '_sequence.json'));
	if (raw === undefined) return undefined;
	return safeParse(checkpointSequenceSchema, raw, `tests/${appId}/_sequence.json`);
}
