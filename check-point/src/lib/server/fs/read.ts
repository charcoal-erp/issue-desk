import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { applicationSchema, userSchema } from '$lib/schemas';
import type { Application, User } from '$lib/types';
import { configDir } from './paths';

export async function readJson(filePath: string): Promise<unknown | undefined> {
	try {
		return JSON.parse(await readFile(filePath, 'utf8'));
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error(`[checkpoint] Skipping unreadable file ${filePath}:`, e);
		}
		return undefined;
	}
}

/** Parse with a schema; log + return undefined instead of crashing boot. */
export function safeParse<T>(schema: z.ZodType<T>, value: unknown, source: string): T | undefined {
	const result = schema.safeParse(value);
	if (!result.success) {
		console.error(`[checkpoint] Skipping invalid ${source}:`, result.error.message);
		return undefined;
	}
	return result.data;
}

/**
 * This Checkpoint's own taxonomy — a copy of the same shape IssueDesk uses,
 * kept so app ids/codes line up when filing a bug over HTTP, but loaded from
 * Checkpoint's own config dir with no dependency on the tracker.
 */
export async function loadUsers(): Promise<User[]> {
	const raw = await readJson(path.join(configDir(), 'users.json'));
	return safeParse(z.array(userSchema), raw ?? [], 'config/users.json') ?? [];
}

export async function loadApplications(): Promise<Application[]> {
	const raw = await readJson(path.join(configDir(), 'applications.json'));
	return safeParse(z.array(applicationSchema), raw ?? [], 'config/applications.json') ?? [];
}
