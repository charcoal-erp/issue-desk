import { rm } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as store from '$lib/server/store';
import { seedDataDir } from '$lib/server/store/seed';
import { login, resolveRequest, resolveToken, toSessionUser } from '$lib/server/auth';
import {
	__wipeForTests,
	bootstrapAdmin,
	checkPassword,
	hasAnyCredentials,
	isTokenStale,
	removePassword,
	setPassword
} from '$lib/server/auth/credentials';
import { __resetSecretForTests, issueToken, verifyToken } from '$lib/server/auth/jwt';
import { generatePassword, hashPassword, verifyPassword } from '$lib/server/auth/password';

const dir = process.env.DATA_DIR!;

beforeEach(async () => {
	await rm(dir, { recursive: true, force: true });
	store.__resetForTests();
	await __wipeForTests();
	__resetSecretForTests();
	await seedDataDir();
	await store.ensureLoaded();
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

const bearer = (token: string) =>
	new Request('http://x/api/agent/issues', { headers: { authorization: `Bearer ${token}` } });

describe('password hashing', () => {
	it('verifies a correct password and rejects a wrong one', async () => {
		const digest = await hashPassword('correct horse battery');
		expect(await verifyPassword('correct horse battery', digest)).toBe(true);
		expect(await verifyPassword('Correct horse battery', digest)).toBe(false);
	});

	it('salts, so the same password hashes differently every time', async () => {
		expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
	});

	it('treats a malformed digest as a failed verification, not an error', async () => {
		for (const bad of ['', 'nonsense', 'scrypt$1$2$3', 'bcrypt$a$b$c$d$e']) {
			expect(await verifyPassword('x', bad)).toBe(false);
		}
	});

	it('generates distinct passwords of the requested length', () => {
		const a = generatePassword(24);
		expect(a).toHaveLength(24);
		expect(a).not.toBe(generatePassword(24));
	});
});

describe('JWT', () => {
	const claimant = { id: 'kiran', username: 'kiran', kind: 'human' as const, admin: true };

	it('round-trips claims through sign and verify', async () => {
		const { token } = await issueToken(claimant);
		const result = await verifyToken(token);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.claims.sub).toBe('kiran');
			expect(result.claims.adm).toBe(true);
			expect(result.claims.iss).toBe('issuedesk');
		}
	});

	it('rejects a tampered payload', async () => {
		const { token } = await issueToken(claimant);
		const [header, , signature] = token.split('.');
		const forged = Buffer.from(
			JSON.stringify({ sub: 'kiran', usr: 'kiran', knd: 'human', adm: true, iat: 1, exp: 9999999999, iss: 'issuedesk' })
		).toString('base64url');
		const result = await verifyToken(`${header}.${forged}.${signature}`);
		expect(result).toEqual({ ok: false, reason: 'signature' });
	});

	it('rejects an unsigned "alg: none" token outright', async () => {
		const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
		const payload = Buffer.from(
			JSON.stringify({ sub: 'kiran', exp: 9999999999, iss: 'issuedesk' })
		).toString('base64url');
		const result = await verifyToken(`${header}.${payload}.`);
		expect(result.ok).toBe(false);
	});

	it('rejects malformed input instead of throwing', async () => {
		for (const bad of ['', 'a.b', 'a.b.c.d', 'not-a-token']) {
			expect((await verifyToken(bad)).ok).toBe(false);
		}
	});
});

describe('credentials', () => {
	it('stores and verifies a password', async () => {
		await setPassword('kiran', 'a-long-enough-password');
		expect(await checkPassword('kiran', 'a-long-enough-password')).toBe(true);
		expect(await checkPassword('kiran', 'wrong')).toBe(false);
	});

	it('reports false for an account that has no password', async () => {
		expect(await checkPassword('tushar', 'anything')).toBe(false);
	});

	it('treats tokens issued before the current password as stale', async () => {
		await setPassword('kiran', 'first-password-here');
		const wayBack = Math.floor(Date.now() / 1000) - 3600;
		expect(await isTokenStale('kiran', wayBack)).toBe(true);
		// A token minted at or after the write survives — otherwise setting a
		// password would invalidate the token issued moments later by the login
		// that used it.
		expect(await isTokenStale('kiran', Math.floor(Date.now() / 1000))).toBe(false);
		expect(await isTokenStale('kiran', Math.floor(Date.now() / 1000) + 5)).toBe(false);
	});

	it('treats every token as stale once the password is removed', async () => {
		await setPassword('kiran', 'first-password-here');
		await removePassword('kiran');
		expect(await isTokenStale('kiran', Math.floor(Date.now() / 1000))).toBe(true);
	});
});

describe('bootstrapAdmin', () => {
	it('creates a first admin login when none exists', async () => {
		expect(await hasAnyCredentials()).toBe(false);
		await bootstrapAdmin();
		expect(await hasAnyCredentials()).toBe(true);
		expect(store.users().find((u) => u.id === 'kiran')?.admin).toBe(true);
	});

	it('never touches an existing password', async () => {
		await setPassword('kiran', 'chosen-by-a-human');
		await bootstrapAdmin();
		expect(await checkPassword('kiran', 'chosen-by-a-human')).toBe(true);
	});
});

describe('login', () => {
	beforeEach(async () => {
		await setPassword('kiran', 'a-long-enough-password');
		await setPassword('claude-agent', 'agent-password-here');
	});

	it('issues a usable token for valid credentials', async () => {
		const attempt = await login('kiran', 'a-long-enough-password');
		expect(attempt.ok).toBe(true);
		if (!attempt.ok) return;
		expect(attempt.result.tokenType).toBe('Bearer');
		expect(attempt.result.user.admin).toBe(true);

		const resolved = await resolveToken(attempt.result.token);
		expect(resolved.ok && resolved.user.id).toBe('kiran');
	});

	it('rejects a wrong password and an unknown username alike', async () => {
		expect(await login('kiran', 'nope')).toEqual({ ok: false, reason: 'invalid-credentials' });
		expect(await login('nobody', 'nope')).toEqual({ ok: false, reason: 'invalid-credentials' });
	});

	it('matches the username case-insensitively', async () => {
		expect((await login('KIRAN', 'a-long-enough-password')).ok).toBe(true);
	});

	it('marks an agent account as kind "agent"', async () => {
		const attempt = await login('claude-agent', 'agent-password-here');
		expect(attempt.ok && attempt.result.user.kind).toBe('agent');
	});

	it('refuses a deactivated account that still has a valid password', async () => {
		const user = store.users().find((u) => u.id === 'kiran')!;
		await store.upsertUser({ ...user, active: false });
		expect(await login('kiran', 'a-long-enough-password')).toEqual({ ok: false, reason: 'inactive' });
	});
});

describe('resolveRequest', () => {
	beforeEach(async () => {
		await setPassword('kiran', 'a-long-enough-password');
	});

	it('accepts a bearer token', async () => {
		const attempt = await login('kiran', 'a-long-enough-password');
		if (!attempt.ok) throw new Error('login failed');
		const resolved = await resolveRequest(bearer(attempt.result.token), undefined);
		expect(resolved.ok && resolved.user.username).toBe('kiran');
	});

	it('falls back to the session cookie when no header is present', async () => {
		const attempt = await login('kiran', 'a-long-enough-password');
		if (!attempt.ok) throw new Error('login failed');
		const resolved = await resolveRequest(new Request('http://x/'), attempt.result.token);
		expect(resolved.ok && resolved.user.id).toBe('kiran');
	});

	it('reports "absent" with no credentials at all', async () => {
		expect(await resolveRequest(new Request('http://x/'), undefined)).toEqual({
			ok: false,
			reason: 'absent'
		});
	});

	it('rejects a token whose account was deactivated after it was issued', async () => {
		const attempt = await login('kiran', 'a-long-enough-password');
		if (!attempt.ok) throw new Error('login failed');
		const user = store.users().find((u) => u.id === 'kiran')!;
		await store.upsertUser({ ...user, active: false });
		expect(await resolveRequest(bearer(attempt.result.token), undefined)).toEqual({
			ok: false,
			reason: 'inactive'
		});
	});

	it('reads privileges from config, not from the token', async () => {
		const attempt = await login('kiran', 'a-long-enough-password');
		if (!attempt.ok) throw new Error('login failed');
		expect(attempt.result.user.admin).toBe(true);

		// Demote after the token was minted: the old token must not stay admin.
		const user = store.users().find((u) => u.id === 'kiran')!;
		await store.upsertUser({ ...user, admin: false });
		const resolved = await resolveRequest(bearer(attempt.result.token), undefined);
		expect(resolved.ok && resolved.user.admin).toBe(false);
	});

	it('rejects a token issued before the password changed', async () => {
		const attempt = await login('kiran', 'a-long-enough-password');
		if (!attempt.ok) throw new Error('login failed');

		// Backdate the token past the credential stamp the change will write.
		const stale = await issueToken({ ...toSessionUser(store.users()[0]) });
		await new Promise((r) => setTimeout(r, 1100));
		await setPassword('kiran', 'a-different-password');

		expect(await resolveRequest(bearer(stale.token), undefined)).toEqual({
			ok: false,
			reason: 'expired'
		});
	});
});
