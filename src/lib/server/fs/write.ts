import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withLock } from '../store/mutex';

/**
 * Atomic JSON write: serialise → write to <file>.tmp → rename over <file>.
 * Rename is atomic on the same filesystem, so a crash mid-write never leaves
 * a half-written file. Serialised per file via the keyed mutex.
 */
export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
	await withLock(`file:${filePath}`, async () => {
		await mkdir(path.dirname(filePath), { recursive: true });
		const tmp = `${filePath}.tmp`;
		await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
		await rename(tmp, filePath);
	});
}
