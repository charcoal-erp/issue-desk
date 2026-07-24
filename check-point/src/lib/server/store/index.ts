import path from 'node:path';
import type { Application, User } from '$lib/types';
import { configDir } from '../fs/paths';
import { loadApplications, loadUsers } from '../fs/read';
import { writeJsonAtomic } from '../fs/write';
import { seedConfigIfEmpty } from './seed';

/**
 * Checkpoint's reference-data store: its own applications taxonomy and its own
 * users (the testers on this box). A small module-level singleton, mirroring
 * the checkpoint content store.
 *
 * In the combined app this data was borrowed from the issue tracker. Checkpoint
 * is now its own app and owns this outright — the same shapes as IssueDesk so
 * app ids/codes line up when filing a bug over HTTP, but no shared code.
 */
let usersList: User[] = [];
let appsList: Application[] = [];
let loaded = false;

export async function ensureLoaded(): Promise<void> {
	if (loaded) return;
	await reload();
	loaded = true;
}

export async function reload(): Promise<void> {
	await seedConfigIfEmpty();
	usersList = await loadUsers();
	appsList = await loadApplications();
}

export function users(): User[] {
	return usersList;
}

export function applications(): Application[] {
	return appsList;
}

/** Persist an added/edited user (config admin). */
export async function upsertUser(user: User): Promise<void> {
	const i = usersList.findIndex((u) => u.id === user.id);
	if (i >= 0) usersList[i] = user;
	else usersList.push(user);
	await writeJsonAtomic(path.join(configDir(), 'users.json'), usersList);
}

export function __resetForTests(): void {
	usersList = [];
	appsList = [];
	loaded = false;
}
