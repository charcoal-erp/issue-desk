import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
	applicationSchema,
	issueSchema,
	sequenceSchema,
	settingsSchema,
	userSchema
} from '$lib/schemas';
import type { Application, Issue, Settings, User } from '$lib/types';
import { configDir, issuesDir } from './paths';

async function readJson(filePath: string): Promise<unknown | undefined> {
	try {
		return JSON.parse(await readFile(filePath, 'utf8'));
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error(`[issuedesk] Skipping unreadable file ${filePath}:`, e);
		}
		return undefined;
	}
}

/** Parse with a schema; log + return undefined instead of crashing boot (NFR-6). */
function safeParse<T>(schema: z.ZodType<T>, value: unknown, source: string): T | undefined {
	const result = schema.safeParse(value);
	if (!result.success) {
		console.error(`[issuedesk] Skipping invalid ${source}:`, result.error.message);
		return undefined;
	}
	return result.data;
}

export async function loadUsers(): Promise<User[]> {
	const raw = await readJson(path.join(configDir(), 'users.json'));
	return safeParse(z.array(userSchema), raw ?? [], 'config/users.json') ?? [];
}

export async function loadApplications(): Promise<Application[]> {
	const raw = await readJson(path.join(configDir(), 'applications.json'));
	return safeParse(z.array(applicationSchema), raw ?? [], 'config/applications.json') ?? [];
}

export async function loadSettings(): Promise<Settings> {
	const raw = await readJson(path.join(configDir(), 'settings.json'));
	return (
		safeParse(settingsSchema, raw ?? {}, 'config/settings.json') ?? {
			productName: 'IssueDesk',
			defaultPageSize: 50
		}
	);
}

export interface LoadedIssueFile {
	appId: string;
	moduleId: string;
	issues: Issue[];
}

/** Walk issues/<app>/<module>.json; a malformed file is logged and skipped. */
export async function loadAllIssues(): Promise<LoadedIssueFile[]> {
	const out: LoadedIssueFile[] = [];
	let appDirs: string[] = [];
	try {
		appDirs = (await readdir(issuesDir(), { withFileTypes: true }))
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
	} catch {
		return out;
	}
	for (const appId of appDirs) {
		let files: string[] = [];
		try {
			files = (await readdir(issuesDir(appId))).filter(
				(f) => f.endsWith('.json') && !f.startsWith('_')
			);
		} catch {
			continue;
		}
		for (const file of files) {
			const raw = await readJson(path.join(issuesDir(appId), file));
			const issues = safeParse(z.array(issueSchema), raw, `issues/${appId}/${file}`);
			if (issues) out.push({ appId, moduleId: file.replace(/\.json$/, ''), issues });
		}
	}
	return out;
}

export async function loadSequence(
	appId: string
): Promise<{ code: string; next: number } | undefined> {
	const raw = await readJson(path.join(issuesDir(appId), '_sequence.json'));
	if (raw === undefined) return undefined;
	return safeParse(sequenceSchema, raw, `issues/${appId}/_sequence.json`);
}
