import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type { Attachment } from '$lib/types';
import { maxAttachments, maxUploadBytes, pendingDir, uploadsDir } from './fs/paths';

type Kind = 'image' | 'pdf' | 'doc' | 'archive' | 'html';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const ALLOWED: Record<string, { ext: string; kind: Kind }> = {
	'image/png': { ext: 'png', kind: 'image' },
	'image/jpeg': { ext: 'jpg', kind: 'image' },
	'image/webp': { ext: 'webp', kind: 'image' },
	'image/gif': { ext: 'gif', kind: 'image' },
	'application/pdf': { ext: 'pdf', kind: 'pdf' },
	'text/html': { ext: 'html', kind: 'html' },
	'application/zip': { ext: 'zip', kind: 'archive' },
	'application/msword': { ext: 'doc', kind: 'doc' },
	[DOCX_MIME]: { ext: 'docx', kind: 'doc' }
};

/** Human list of accepted formats, for error messages and UI hints. */
export const ACCEPTED_FORMATS = 'PNG, JPG, WEBP, GIF, PDF, HTML, ZIP, DOC or DOCX';

export class UploadError extends Error {}

/** Does the buffer contain this ASCII marker within the first `limit` bytes? */
function containsAscii(buf: Uint8Array, marker: string, limit = buf.length): boolean {
	const bytes = new TextEncoder().encode(marker);
	const end = Math.min(buf.length - bytes.length, limit);
	for (let i = 0; i <= end; i++) {
		let ok = true;
		for (let j = 0; j < bytes.length; j++) {
			if (buf[i + j] !== bytes[j]) {
				ok = false;
				break;
			}
		}
		if (ok) return true;
	}
	return false;
}

/**
 * Heuristic HTML sniff: HTML has no magic bytes, so inspect the leading text.
 * Conservative on purpose — a text file that isn't clearly HTML is rejected
 * rather than misclassified, since HTML is the only text format we accept.
 */
function looksLikeHtml(buf: Uint8Array): boolean {
	// Decode a leading window, drop a UTF-8/UTF-16 BOM and leading whitespace.
	let start = 0;
	if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) start = 3;
	const head = new TextDecoder('utf-8', { fatal: false })
		.decode(buf.slice(start, start + 1024))
		.replace(/^\s+/, '')
		.toLowerCase();
	return (
		head.startsWith('<!doctype html') ||
		head.startsWith('<html') ||
		/^<\?xml[^>]*\?>\s*<!doctype html/.test(head) ||
		/^<(head|body|meta|title)[\s>]/.test(head)
	);
}

/** Sniff the real type from magic bytes; never trust the client MIME (§12). */
export function sniffMime(buf: Uint8Array): string | undefined {
	const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));
	if (buf.length >= 8 && buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
	if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
	if (buf.length >= 6 && ascii(0, 4) === 'GIF8') return 'image/gif';
	if (buf.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
	if (buf.length >= 4 && ascii(0, 4) === '%PDF') return 'application/pdf';
	// Legacy Word (OLE2 compound file): D0 CF 11 E0 A1 B1 1A E1.
	if (
		buf.length >= 8 &&
		buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
		buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1
	) {
		return 'application/msword';
	}
	// ZIP local-file header (PK\x03\x04). DOCX is a ZIP — disambiguate by the
	// OOXML word part; anything else that is a ZIP is treated as a generic archive.
	if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
		if (containsAscii(buf, 'word/document.xml') || containsAscii(buf, 'word/_rels')) {
			return DOCX_MIME;
		}
		return 'application/zip';
	}
	if (looksLikeHtml(buf)) return 'text/html';
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
				`${file.name} is not a supported format. Accepted formats: ${ACCEPTED_FORMATS}.`
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
