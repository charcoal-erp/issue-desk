/** Clipboard image types we accept, mapped to the extension we name them with. */
const PASTEABLE: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/** Input types that don't take typed text, so a paste there isn't a text paste. */
const NON_TEXT_INPUT = new Set([
	'button',
	'checkbox',
	'color',
	'file',
	'image',
	'radio',
	'range',
	'reset',
	'submit'
]);

/**
 * "pasted-20260718-143022.png" — a screenshot on the clipboard arrives as
 * "image.png" (or nameless), so it gets a timestamped name of its own.
 * `index` disambiguates several images pasted in the same second.
 */
export function pastedFilename(mime: string, at: Date, index = 0): string {
	const p = (n: number) => String(n).padStart(2, '0');
	const date = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}`;
	const time = `${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`;
	const suffix = index > 0 ? `-${index + 1}` : '';
	return `pasted-${date}-${time}${suffix}.${PASTEABLE[mime] ?? 'png'}`;
}

/** True when the caret sits in something that takes typed text. */
export function isTextEntry(el: EventTarget | null): boolean {
	const node = el as (HTMLElement & { type?: string }) | null;
	if (!node || typeof node.tagName !== 'string') return false;
	if (node.isContentEditable) return true;
	if (node.tagName === 'TEXTAREA') return true;
	return node.tagName === 'INPUT' && !NON_TEXT_INPUT.has(node.type ?? 'text');
}

/** Image blobs on the clipboard, renamed for storage. */
export function clipboardImages(data: DataTransfer | null, at: Date = new Date()): File[] {
	const out: File[] = [];
	const items = data?.items;
	for (let i = 0; i < (items?.length ?? 0); i++) {
		const item = items![i];
		if (item.kind !== 'file' || !(item.type in PASTEABLE)) continue;
		// getAsFile() only works synchronously, while the paste event is live.
		const file = item.getAsFile();
		if (!file || file.size === 0) continue;
		out.push(new File([file], pastedFilename(item.type, at, out.length), { type: item.type }));
	}
	return out;
}

/**
 * Images a paste should attach — empty when the paste carries none, or when it
 * carries text into a text field. Copying a spreadsheet row or a rich snippet
 * puts a bitmap on the clipboard next to the text; in a field that takes typed
 * text, that paste is the text, not a screenshot.
 */
export function pastedImages(e: ClipboardEvent, at: Date = new Date()): File[] {
	const images = clipboardImages(e.clipboardData, at);
	if (!images.length) return [];
	if (e.clipboardData?.getData('text/plain') && isTextEntry(e.target)) return [];
	return images;
}

/**
 * Copy text to the clipboard, reporting whether it worked.
 *
 * `navigator.clipboard` only exists in a secure context, and these screens are
 * routinely opened over a plain-http LAN address — so the modern API alone
 * fails silently on exactly the machines a dashboard gets shared from. The
 * selection fallback still works there.
 */
export async function writeClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return selectionCopy(text);
	}
}

function selectionCopy(value: string): boolean {
	const ta = document.createElement('textarea');
	ta.value = value;
	ta.setAttribute('readonly', '');
	ta.style.position = 'fixed';
	ta.style.top = '-1000px';
	ta.style.opacity = '0';
	document.body.appendChild(ta);
	ta.select();
	let ok = false;
	try {
		ok = document.execCommand('copy');
	} catch {
		ok = false;
	}
	ta.remove();
	return ok;
}
