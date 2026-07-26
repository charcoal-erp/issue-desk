import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { PROVIDER_META } from '$lib/types';
import type { CredentialStatusView, Provider } from '$lib/types';
import { storedCredentialSchema } from '$lib/schemas';
import { credentialFile, keyEncryptionKey } from '../fs/paths';
import { readJson, safeParse } from '../fs/read';
import { writeJsonAtomicPrivate } from '../fs/write';
import { withLock } from '../store/mutex';

/**
 * The API-key vault (§ AI), modelled on Prism's. This module is the ONLY place
 * that can produce a plaintext provider key. Its exported surface is deliberately
 * narrow:
 *
 *   setKey / removeKey            write side
 *   getKeyForRequest             returns plaintext to an in-process caller only
 *   status / recordTest          the client-safe view (mask + state only)
 *
 * `getKeyForRequest` is the one function that returns key material, and its
 * result must never reach a response, a Svelte prop, or a log line. Everything
 * else sees `CredentialStatusView`, which structurally cannot carry a key.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32; // AES-256

export class VaultError extends Error {}

/**
 * Resolve the key-encryption key. Absent/malformed is a hard failure on the
 * write path — an app that silently degrades to plaintext secrets is worse than
 * one that refuses to store them.
 */
function kek(): Buffer {
	const raw = keyEncryptionKey();
	if (!raw) {
		throw new VaultError(
			'KEY_ENCRYPTION_KEY is not set. Generate one with ' +
				'`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"` ' +
				'and set it in the environment before adding a provider key.'
		);
	}
	const key = Buffer.from(raw, 'base64');
	if (key.length !== KEY_BYTES) {
		throw new VaultError(
			`KEY_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}).`
		);
	}
	return key;
}

/** True when a usable KEK is configured — drives the Keys screen's warning. */
export function isVaultReady(): boolean {
	try {
		kek();
		return true;
	} catch {
		return false;
	}
}

interface Ciphertext {
	ciphertext: string;
	iv: string;
	authTag: string;
}

function encrypt(plaintext: string): Ciphertext {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, kek(), iv);
	const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return {
		ciphertext: ct.toString('base64'),
		iv: iv.toString('base64'),
		authTag: cipher.getAuthTag().toString('base64')
	};
}

function decrypt(record: Ciphertext): string {
	const decipher = createDecipheriv(ALGORITHM, kek(), Buffer.from(record.iv, 'base64'));
	decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
	try {
		return Buffer.concat([
			decipher.update(Buffer.from(record.ciphertext, 'base64')),
			decipher.final()
		]).toString('utf8');
	} catch {
		// GCM auth failure: tampered ciphertext or a changed KEK. Either way,
		// "do not use this value" — never guess.
		throw new VaultError(
			'Stored key failed authentication. The KEY_ENCRYPTION_KEY may have changed, ' +
				'or the credential file was modified. Re-enter the key.'
		);
	}
}

/** "sk-ant-…4f2a" → "••••4f2a". The only part of a key ever displayed. */
export function mask(plaintext: string): string {
	return `••••${plaintext.slice(-4)}`;
}

type StoredCredential = ReturnType<typeof storedCredentialSchema.parse>;

async function read(provider: Provider): Promise<StoredCredential | undefined> {
	const raw = await readJson(credentialFile(provider));
	if (!raw) return undefined;
	return safeParse(storedCredentialSchema, raw, `credential for ${provider}`);
}

async function write(record: StoredCredential): Promise<void> {
	await writeJsonAtomicPrivate(credentialFile(record.provider), record);
}

/** Store or replace a provider key. Rotation is a re-encrypt with a fresh IV. */
export async function setKey(provider: Provider, plaintext: string): Promise<CredentialStatusView> {
	return withLock(`vault:${provider}`, async () => {
		const record: StoredCredential = {
			provider,
			...encrypt(plaintext),
			hint: mask(plaintext),
			status: 'configured',
			lastTestedAt: undefined,
			lastRotatedAt: new Date().toISOString(),
			lastError: undefined
		};
		await write(record);
		return toView(record);
	});
}

export async function removeKey(provider: Provider): Promise<void> {
	await withLock(`vault:${provider}`, async () => {
		await rm(credentialFile(provider), { force: true });
	});
}

/**
 * The decrypted key for one request. Falls back to the environment variable
 * when the vault has no entry, so local dev works without the Keys screen. The
 * vault always wins — a key added in the UI is explicit intent and should not be
 * shadowed by a stale shell export. Returns undefined when neither is usable.
 */
export async function getKeyForRequest(provider: Provider): Promise<string | undefined> {
	const record = await read(provider);
	if (record) {
		try {
			return decrypt(record);
		} catch (e) {
			// An undecryptable key (KEK missing/changed or file tampered) is simply
			// not usable — log once and fall through to the env-var path rather than
			// throwing on a hot path.
			console.error(
				`[issuedesk] ${provider} key present but undecryptable: ${(e as Error).message}`
			);
		}
	}
	const fromEnv = process.env[PROVIDER_META[provider].envKey];
	return fromEnv || undefined;
}

/** Record a connection-test outcome without touching the ciphertext. */
export async function recordTest(
	provider: Provider,
	ok: boolean,
	error?: string
): Promise<CredentialStatusView> {
	return withLock(`vault:${provider}`, async () => {
		const existing = await read(provider);
		if (!existing) return status(provider);
		const record: StoredCredential = {
			...existing,
			status: ok ? 'configured' : 'error',
			lastTestedAt: new Date().toISOString(),
			lastError: ok ? undefined : redact(error ?? 'Connection failed')
		};
		await write(record);
		return toView(record);
	});
}

// ---------- Client-safe views ----------

function toView(record: StoredCredential): CredentialStatusView {
	return {
		provider: record.provider,
		status: record.status,
		hint: record.hint,
		source: 'vault',
		lastTestedAt: record.lastTestedAt,
		lastRotatedAt: record.lastRotatedAt,
		lastError: record.lastError
	};
}

export async function status(provider: Provider): Promise<CredentialStatusView> {
	const record = await read(provider);
	if (record) return toView(record);
	// An env-var key is real but unmanaged: it can't be rotated/removed from the
	// UI, so the Keys screen says where it came from.
	if (process.env[PROVIDER_META[provider].envKey]) {
		return { provider, status: 'configured', hint: '••••env', source: 'env' };
	}
	return { provider, status: 'unset', hint: '', source: 'none' };
}

/**
 * Scrub anything key-shaped from a string before it reaches a log, an error
 * payload, or a stored `lastError`. Provider errors sometimes echo the request.
 */
export function redact(text: string): string {
	return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***').replace(/\b[A-Fa-f0-9]{32,}\b/g, '***');
}
