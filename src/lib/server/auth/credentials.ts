import { rm } from 'node:fs/promises';
import { z } from 'zod';
import { storedCredentialsSchema } from '$lib/schemas';
import type { User } from '$lib/types';
import { bootstrapAdminPassword, credentialsFile } from '../fs/paths';
import { readJson, safeParse } from '../fs/read';
import { writeJsonAtomicPrivate } from '../fs/write';
import { withLock } from '../store/mutex';
import * as store from '../store';
import { generatePassword, hashPassword, verifyPassword } from './password';

/**
 * The credential store: one scrypt digest per account, in data/auth/credentials.json
 * at 0600. Kept out of config/ deliberately — config is human-editable, exported
 * by /api/data/export and imported back; digests belong to none of that.
 *
 * `updatedAt` is load-bearing beyond bookkeeping: tokens issued before it are
 * refused (see `isTokenStale`), so changing a password revokes every JWT that
 * account has outstanding, without any server-side session list.
 */

export interface StoredCredentials {
	userId: string;
	hash: string;
	updatedAt: string;
}

const LOCK = 'auth:credentials';

let cache: Map<string, StoredCredentials> | undefined;

async function load(): Promise<Map<string, StoredCredentials>> {
	if (cache) return cache;
	const raw = await readJson(credentialsFile());
	const parsed =
		safeParse(z.array(storedCredentialsSchema), raw ?? [], 'auth/credentials.json') ?? [];
	cache = new Map(parsed.map((c) => [c.userId, c]));
	return cache;
}

async function persist(map: Map<string, StoredCredentials>): Promise<void> {
	const rows = [...map.values()].sort((a, b) => a.userId.localeCompare(b.userId));
	await writeJsonAtomicPrivate(credentialsFile(), rows);
	cache = map;
}

/** Whether anyone at all can sign in yet — drives first-boot bootstrap. */
export async function hasAnyCredentials(): Promise<boolean> {
	return (await load()).size > 0;
}

export async function hasPassword(userId: string): Promise<boolean> {
	return (await load()).has(userId);
}

export async function setPassword(userId: string, password: string): Promise<void> {
	const hash = await hashPassword(password);
	await withLock(LOCK, async () => {
		const map = new Map(await load());
		map.set(userId, { userId, hash, updatedAt: new Date().toISOString() });
		await persist(map);
	});
}

export async function removePassword(userId: string): Promise<void> {
	await withLock(LOCK, async () => {
		const map = new Map(await load());
		if (!map.delete(userId)) return;
		await persist(map);
	});
}

/**
 * Verify a password. Returns false for unknown accounts *after* doing the same
 * work a known one would, so response timing does not disclose which usernames
 * exist.
 */
export async function checkPassword(userId: string, password: string): Promise<boolean> {
	const record = (await load()).get(userId);
	const digest = record?.hash ?? DUMMY_HASH;
	const matched = await verifyPassword(password, digest);
	return Boolean(record) && matched;
}

// A real digest of an unguessable value: verifying against it costs the same as
// verifying a genuine account, which is the entire point.
const DUMMY_HASH =
	'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
	'Y2Fubm90LW1hdGNoLWFueS1yZWFsLXBhc3N3b3JkLXYx';

/**
 * True when a token predates the account's current password — the revocation
 * check.
 *
 * Both sides are floored to whole seconds because `iat` has no finer
 * resolution. That makes the comparison exact for the case that matters — a
 * token minted at or after the password write is never treated as stale, so
 * logging in with a brand-new password cannot invalidate its own token — at
 * the cost of a sub-second window where a token issued earlier in the *same*
 * second as a password change survives it. Adding slack instead would trade
 * that certainty for a revocation that fires or not depending on where the
 * clock happened to fall inside a second.
 */
export async function isTokenStale(userId: string, issuedAt: number): Promise<boolean> {
	const record = (await load()).get(userId);
	if (!record) return true; // credentials removed = every token dead
	const changedAt = Math.floor(new Date(record.updatedAt).getTime() / 1000);
	if (!Number.isFinite(changedAt)) return false;
	return issuedAt < changedAt;
}

/** Test-only: drop the in-memory cache so a fresh DATA_DIR is read. */
export function __resetForTests(): void {
	cache = undefined;
}

/** Test-only: wipe the credentials file as well as the cache. */
export async function __wipeForTests(): Promise<void> {
	cache = undefined;
	await rm(credentialsFile(), { force: true });
}

/**
 * First-boot bootstrap. With no credentials on disk nobody could ever sign in,
 * so promote one account to admin and give it a password: ISSUEDESK_ADMIN_PASSWORD
 * when supplied, otherwise a generated one printed once to the server log.
 *
 * Runs only while the store is empty of credentials, so it can never reset a
 * password on a running deployment.
 */
export async function bootstrapAdmin(): Promise<void> {
	if (await hasAnyCredentials()) return;

	const users = store.users();
	let target: User | undefined = users.find((u) => u.admin) ?? users[0];
	if (!target) {
		target = { id: 'admin', name: 'Administrator', role: 'Admin', kind: 'human', assignable: true };
	}
	const admin: User = { ...target, kind: target.kind ?? 'human', admin: true };
	await store.upsertUser(admin);

	const configured = bootstrapAdminPassword();
	const password = configured ?? generatePassword();
	await setPassword(admin.id, password);

	const username = admin.username ?? admin.id;
	if (configured) {
		console.log(
			`[issuedesk] Bootstrapped admin login "${username}" with ISSUEDESK_ADMIN_PASSWORD.`
		);
	} else {
		console.log(
			'\n[issuedesk] ──────────────────────────────────────────────────────────\n' +
				`[issuedesk]  First run: sign in as "${username}" with password:\n` +
				`[issuedesk]      ${password}\n` +
				'[issuedesk]  Shown once. Change it under Config → Accounts.\n' +
				'[issuedesk] ──────────────────────────────────────────────────────────\n'
		);
	}
}
