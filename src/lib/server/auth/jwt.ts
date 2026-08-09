import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { TokenClaims, UserKind } from '$lib/types';
import { jwtSecretFile, jwtSecretFromEnv, tokenTtlSeconds } from '../fs/paths';
import { readJson } from '../fs/read';
import { writeJsonAtomicPrivate } from '../fs/write';

/**
 * HS256 JWTs, implemented on node:crypto. A full JOSE library would buy
 * algorithm agility this app has no use for — one issuer, one verifier, one
 * algorithm — so the ~60 lines here stay honest about what is actually
 * supported and reject everything else, `alg: none` included.
 */

const ISSUER = 'issuedesk' as const;

let secretPromise: Promise<Buffer> | undefined;

/**
 * Resolve the signing secret: AUTH_JWT_SECRET when set, otherwise a random one
 * persisted under DATA_DIR so tokens survive a restart without any deployment
 * ceremony. Set the env var explicitly when you run more than one instance —
 * two servers would otherwise generate different secrets and reject each
 * other's tokens.
 */
async function loadSecret(): Promise<Buffer> {
	const fromEnv = jwtSecretFromEnv();
	if (fromEnv) return Buffer.from(fromEnv, 'utf8');

	const file = jwtSecretFile();
	const existing = (await readJson(file)) as { secret?: unknown } | undefined;
	if (existing && typeof existing.secret === 'string' && existing.secret.length >= 32) {
		return Buffer.from(existing.secret, 'base64');
	}

	const secret = randomBytes(48);
	await writeJsonAtomicPrivate(file, {
		secret: secret.toString('base64'),
		note: 'Auto-generated JWT signing secret. Delete to rotate (logs everyone out). Set AUTH_JWT_SECRET to manage it out-of-band instead.',
		createdAt: new Date().toISOString()
	});
	console.log(`[issuedesk] Generated a JWT signing secret at ${file}`);
	return secret;
}

function secret(): Promise<Buffer> {
	secretPromise ??= loadSecret();
	return secretPromise;
}

/** Test-only: drop the cached secret so a fresh DATA_DIR generates its own. */
export function __resetSecretForTests(): void {
	secretPromise = undefined;
}

const b64url = (buf: Buffer): string => buf.toString('base64url');
const fromB64url = (s: string): Buffer => Buffer.from(s, 'base64url');

async function sign(signingInput: string): Promise<string> {
	return b64url(createHmac('sha256', await secret()).update(signingInput).digest());
}

export interface IssuedToken {
	token: string;
	issuedAt: number; // epoch seconds
	expiresAt: number; // epoch seconds
}

export async function issueToken(user: {
	id: string;
	username: string;
	kind: UserKind;
	admin: boolean;
}): Promise<IssuedToken> {
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + tokenTtlSeconds();
	const claims: TokenClaims = {
		sub: user.id,
		usr: user.username,
		knd: user.kind,
		adm: user.admin,
		iat: issuedAt,
		exp: expiresAt,
		iss: ISSUER
	};
	const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
	const payload = b64url(Buffer.from(JSON.stringify(claims)));
	const signature = await sign(`${header}.${payload}`);
	return { token: `${header}.${payload}.${signature}`, issuedAt, expiresAt };
}

export type VerifyFailure = 'malformed' | 'signature' | 'expired';
export type VerifyResult = { ok: true; claims: TokenClaims } | { ok: false; reason: VerifyFailure };

export async function verifyToken(token: string): Promise<VerifyResult> {
	const parts = token.split('.');
	if (parts.length !== 3) return { ok: false, reason: 'malformed' };
	const [header, payload, signature] = parts;

	// Signature first: nothing in the payload is trustworthy until it verifies.
	const expected = await sign(`${header}.${payload}`);
	const got = fromB64url(signature);
	const want = fromB64url(expected);
	if (got.length !== want.length || !timingSafeEqual(got, want)) {
		return { ok: false, reason: 'signature' };
	}

	let head: { alg?: unknown };
	let claims: TokenClaims;
	try {
		head = JSON.parse(fromB64url(header).toString('utf8'));
		claims = JSON.parse(fromB64url(payload).toString('utf8'));
	} catch {
		return { ok: false, reason: 'malformed' };
	}
	// Belt and braces — the signature already pins the header, but an explicit
	// check keeps "alg" from ever being read as anything but HS256.
	if (head.alg !== 'HS256') return { ok: false, reason: 'malformed' };
	if (claims.iss !== ISSUER || typeof claims.sub !== 'string' || typeof claims.exp !== 'number') {
		return { ok: false, reason: 'malformed' };
	}
	if (claims.exp <= Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
	return { ok: true, claims };
}
