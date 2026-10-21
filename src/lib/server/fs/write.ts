import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withLock } from '../store/mutex';

/**
 * Last body this process wrote to each file, keyed by absolute path. Lets the
 * WATCH_FILES watcher tell its own writes apart from out-of-band edits.
 */
const ownWrites = new Map<string, string>();

/**
 * Atomic JSON write: serialise → write to <file>.tmp → rename over <file>.
 * Rename is atomic on the same filesystem, so a crash mid-write never leaves
 * a half-written file. Serialised per file via the keyed mutex.
 */
export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
	await withLock(`file:${filePath}`, async () => {
		await mkdir(path.dirname(filePath), { recursive: true });
		const tmp = `${filePath}.tmp`;
		const body = JSON.stringify(value, null, 2) + '\n';
		await writeFile(tmp, body, 'utf8');
		await rename(tmp, filePath);
		ownWrites.set(path.resolve(filePath), body);
	});
}

/** True when the file on disk is exactly what this process last wrote to it. */
export async function isOwnWrite(filePath: string): Promise<boolean> {
	const expected = ownWrites.get(path.resolve(filePath));
	if (expected === undefined) return false;
	try {
		return (await readFile(filePath, 'utf8')) === expected;
	} catch {
		return false;
	}
}

/**
 * Same atomic write, but 0600 (owner-only) — for secrets like the encrypted
 * provider-key vault, which must never be world-readable even though the
 * contents are already ciphertext.
 */
export async function writeJsonAtomicPrivate(filePath: string, value: unknown): Promise<void> {
	await withLock(`file:${filePath}`, async () => {
		await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
		const tmp = `${filePath}.tmp`;
		await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
		await rename(tmp, filePath);
	});
}
