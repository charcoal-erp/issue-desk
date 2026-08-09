import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing with node's scrypt — no dependency added for something the
 * platform already ships. The cost parameters travel inside the digest, so a
 * future increase re-verifies old hashes correctly and only new writes get the
 * stronger cost.
 *
 * Format: scrypt$<N>$<r>$<p>$<salt-base64>$<key-base64>
 */

const scrypt = promisify(scryptCb) as (
	password: string | Buffer,
	salt: Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const N = 1 << 15; // 32768 — ~100ms on commodity hardware
const R = 8;
const P = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

// scrypt's default maxmem (32 MB) is just under what N=32768,r=8 needs.
const maxmem = (): number => 256 * N * R * 2;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const key = await scrypt(password.normalize('NFKC'), salt, KEY_BYTES, {
		N,
		r: R,
		p: P,
		maxmem: maxmem()
	});
	return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/**
 * Constant-time verify. Any malformed digest is a failed verification rather
 * than a throw — a corrupt credentials file must lock the account, not 500 the
 * login route.
 */
export async function verifyPassword(password: string, digest: string): Promise<boolean> {
	const parts = digest.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const [, nRaw, rRaw, pRaw, saltB64, keyB64] = parts;
	const n = Number(nRaw);
	const r = Number(rRaw);
	const p = Number(pRaw);
	if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

	let expected: Buffer;
	let salt: Buffer;
	try {
		expected = Buffer.from(keyB64, 'base64');
		salt = Buffer.from(saltB64, 'base64');
	} catch {
		return false;
	}
	if (expected.length === 0 || salt.length === 0) return false;

	try {
		const actual = await scrypt(password.normalize('NFKC'), salt, expected.length, {
			N: n,
			r,
			p,
			maxmem: 256 * n * r * 2
		});
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

/**
 * A readable, high-entropy password for bootstrap and agent accounts. Avoids
 * look-alike characters so it survives being copied out of a log line by hand.
 */
export function generatePassword(length = 24): string {
	const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = randomBytes(length);
	let out = '';
	for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
	return out;
}
