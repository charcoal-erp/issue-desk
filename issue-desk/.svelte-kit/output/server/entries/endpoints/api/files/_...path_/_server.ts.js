import { u as uploadsDir } from "../../../../../chunks/paths.js";
import { error } from "@sveltejs/kit";
import { stat } from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
//#region src/routes/api/files/[...path]/+server.ts
var CONTENT_TYPES = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".pdf": "application/pdf"
};
/**
* Public attachment URLs (FR-13): resolves strictly under DATA_DIR/uploads,
* rejects traversal, streams with long-lived cache headers and Range support.
*/
var GET = async ({ params, request }) => {
	const rel = params.path;
	if (!rel || rel.includes("..") || rel.includes("\0") || path.isAbsolute(rel)) error(404, "Not found");
	const base = uploadsDir();
	const resolved = path.resolve(base, rel);
	if (!resolved.startsWith(base + path.sep)) error(404, "Not found");
	let info;
	try {
		info = await stat(resolved);
	} catch {
		error(404, "Not found");
	}
	if (!info.isFile()) error(404, "Not found");
	const headers = {
		"content-type": CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? "application/octet-stream",
		"cache-control": "public, max-age=31536000, immutable",
		"x-content-type-options": "nosniff",
		"accept-ranges": "bytes"
	};
	const match = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
	if (match && (match[1] || match[2])) {
		const start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
		const end = match[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
		if (start > end || start >= info.size) return new Response(null, {
			status: 416,
			headers: { "content-range": `bytes */${info.size}` }
		});
		return new Response(Readable.toWeb(createReadStream(resolved, {
			start,
			end
		})), {
			status: 206,
			headers: {
				...headers,
				"content-range": `bytes ${start}-${end}/${info.size}`,
				"content-length": String(end - start + 1)
			}
		});
	}
	return new Response(Readable.toWeb(createReadStream(resolved)), { headers: {
		...headers,
		"content-length": String(info.size)
	} });
};
//#endregion
export { GET };
