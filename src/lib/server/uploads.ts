import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type { Attachment } from '$lib/types';
import { maxAttachments, maxUploadBytes, pendingDir, uploadsDir } from './fs/paths';

const ALLOWED: Record<string, { ext: string; kind: 'image' | 'pdf' }> = {
	'image/png': { ext: 'png', kind: 'image' },
	'image/jpeg': { ext: 'jpg', kind: 'image' },
	'image/webp': { ext: 'webp', kind: 'image' },
	'image/gif': { ext: 'gif', kind: 'image' },
	'application/pdf': { ext: 'pdf', kind: 'pdf' }
};

export class UploadError extends Error {}

/** Sniff the real type from magic bytes; never trust the client MIME (§12). */
export function sniffMime(buf: Uint8Array): string | undefined {
	const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));
	if (buf.length >= 8 && buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
	if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
	if (buf.length >= 6 && ascii(0, 4) === 'GIF8') return 'image/gif';
	if (buf.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
	if (buf.length >= 4 && ascii(0, 4) === '%PDF') return 'application/pdf';
	return undefined;
}

/** "Screen Shot (1).PNG" → "screen-shot-1.png" — traversal-safe, collision-safe. */
export function sanitizeFilename(original: string, ext: string): string {
	const base = path
		.basename(original)
		.replace(/\.[^.]*$/, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return `${base || 'file'}.${ext}`;
}

export interface SaveTarget {
	appId: string;
	issueId: string; // real issue id, or 'pending' with draftId set
	draftId?: string;
}

/**
 * Validate and persist uploaded blobs; returns Attachment records whose URLs
 * point at the final (or pending) location.
 */
export async function saveUploads(
	files: File[],
	target: SaveTarget,
	uploadedBy: string,
	existingCount: number
): Promise<Attachment[]> {
	if (existingCount + files.length > maxAttachments()) {
		throw new UploadError(
			`That would be ${existingCount + files.length} attachments. The limit is ${maxAttachments()} per issue.`
		);
	}
	const pending = target.issueId === 'pending';
	if (pending && !target.draftId) throw new UploadError('Missing draftId for a pending upload.');
	const dir = pending
		? pendingDir(target.appId, target.draftId!)
		: uploadsDir(target.appId, target.issueId);
	await mkdir(dir, { recursive: true });

	const already = (await readdir(dir)).length;
	const out: Attachment[] = [];
	let index = existingCount + already;

	for (const file of files) {
		if (file.size > maxUploadBytes()) {
			throw new UploadError(
				`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${maxUploadBytes() / 1024 / 1024} MB.`
			);
		}
		const buf = new Uint8Array(await file.arrayBuffer());
		const mime = sniffMime(buf);
		if (!mime || !ALLOWED[mime]) {
			throw new UploadError(
				`${file.name} is not an allowed type. Use PNG, JPG, WEBP, GIF or PDF.`
			);
		}
		const { ext, kind } = ALLOWED[mime];
		index += 1;
		const filename = `${String(index).padStart(2, '0')}-${sanitizeFilename(file.name, ext)}`;
		await writeFile(path.join(dir, filename), buf);
		const urlBase = pending
			? `/api/files/${target.appId}/_pending/${target.draftId}`
			: `/api/files/${target.appId}/${target.issueId}`;
		out.push({
			id: uuidv7(),
			filename,
			originalName: file.name,
			mime,
			kind,
			size: buf.length,
			url: `${urlBase}/${filename}`,
			uploadedBy,
			uploadedAt: new Date().toISOString()
		});
	}
	return out;
}

/**
 * Move `_pending/<draftId>/*` → `uploads/<app>/<issueId>/*` once the issue ID
 * is known, rewriting each attachment's URL to its permanent form.
 */
export async function movePendingUploads(
	appId: string,
	draftId: string,
	issueId: string,
	attachments: Attachment[]
): Promise<Attachment[]> {
	const from = pendingDir(appId, draftId);
	const to = uploadsDir(appId, issueId);
	await mkdir(to, { recursive: true });
	let names: string[] = [];
	try {
		names = await readdir(from);
	} catch {
		names = [];
	}
	for (const name of names) {
		await rename(path.join(from, name), path.join(to, name));
	}
	await rm(from, { recursive: true, force: true });
	return attachments.map((a) =>
		a.url.includes('/_pending/')
			? { ...a, url: `/api/files/${appId}/${issueId}/${a.filename}` }
			: a
	);
}

/** Delete a stored attachment file (used when an edit removes it). */
export async function deleteUploadFile(appId: string, issueId: string, filename: string) {
	const safe = path.basename(filename);
	await rm(path.join(uploadsDir(appId, issueId), safe), { force: true });
}
