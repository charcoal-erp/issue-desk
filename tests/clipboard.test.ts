import { describe, expect, it } from 'vitest';
import { clipboardImages, isTextEntry, pastedFilename, pastedImages } from '$lib/clipboard';

const AT = new Date(2026, 6, 18, 14, 30, 22);

/** Stand-in for a DataTransfer carrying clipboard items. */
function clipboard(items: { kind: string; type: string; file?: File }[], text = '') {
	return {
		items: items.map((i) => ({ ...i, getAsFile: () => i.file ?? null })),
		getData: (mime: string) => (mime === 'text/plain' ? text : '')
	} as unknown as DataTransfer;
}

function png(name = 'image.png', bytes = 4) {
	return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

describe('pastedFilename', () => {
	it('timestamps the paste and uses the extension for the type', () => {
		expect(pastedFilename('image/png', AT)).toBe('pasted-20260718-143022.png');
		expect(pastedFilename('image/jpeg', AT)).toBe('pasted-20260718-143022.jpg');
		expect(pastedFilename('image/webp', AT)).toBe('pasted-20260718-143022.webp');
	});

	it('numbers images pasted within the same second', () => {
		expect(pastedFilename('image/png', AT, 1)).toBe('pasted-20260718-143022-2.png');
		expect(pastedFilename('image/png', AT, 2)).toBe('pasted-20260718-143022-3.png');
	});

	it('pads single-digit date parts', () => {
		expect(pastedFilename('image/png', new Date(2026, 0, 5, 9, 8, 7))).toBe(
			'pasted-20260105-090807.png'
		);
	});
});

describe('clipboardImages', () => {
	it('renames clipboard images and ignores everything else', () => {
		const data = clipboard([
			{ kind: 'string', type: 'text/html', file: png() },
			{ kind: 'file', type: 'image/png', file: png() },
			{ kind: 'file', type: 'application/pdf', file: png('doc.pdf') }
		]);
		const out = clipboardImages(data, AT);
		expect(out.map((f) => f.name)).toEqual(['pasted-20260718-143022.png']);
		expect(out[0].type).toBe('image/png');
	});

	it('keeps several images distinct', () => {
		const data = clipboard([
			{ kind: 'file', type: 'image/png', file: png() },
			{ kind: 'file', type: 'image/png', file: png() }
		]);
		expect(clipboardImages(data, AT).map((f) => f.name)).toEqual([
			'pasted-20260718-143022.png',
			'pasted-20260718-143022-2.png'
		]);
	});

	it('skips empty blobs and an empty clipboard', () => {
		expect(clipboardImages(clipboard([{ kind: 'file', type: 'image/png' }]), AT)).toEqual([]);
		expect(
			clipboardImages(clipboard([{ kind: 'file', type: 'image/png', file: png('x.png', 0) }]), AT)
		).toEqual([]);
		expect(clipboardImages(null, AT)).toEqual([]);
	});
});

/** Stand-in for the element a paste landed on. */
const el = (props: Record<string, unknown>) => props as unknown as EventTarget;

describe('isTextEntry', () => {
	it('recognises fields that take typed text', () => {
		expect(isTextEntry(el({ tagName: 'TEXTAREA' }))).toBe(true);
		expect(isTextEntry(el({ tagName: 'INPUT', type: 'text' }))).toBe(true);
		expect(isTextEntry(el({ tagName: 'DIV', isContentEditable: true }))).toBe(true);
	});

	it('rejects everything else', () => {
		expect(isTextEntry(el({ tagName: 'INPUT', type: 'checkbox' }))).toBe(false);
		expect(isTextEntry(el({ tagName: 'DIV' }))).toBe(false);
		expect(isTextEntry(null)).toBe(false);
	});
});

describe('pastedImages', () => {
	const paste = (data: DataTransfer | null, target: EventTarget | null = null) =>
		({ clipboardData: data, target }) as unknown as ClipboardEvent;

	it('takes a screenshot pasted into any field', () => {
		const data = clipboard([{ kind: 'file', type: 'image/png', file: png() }]);
		expect(pastedImages(paste(data, el({ tagName: 'TEXTAREA' })), AT)).toHaveLength(1);
	});

	it('leaves text alone when a copied cell carries a bitmap alongside it', () => {
		const data = clipboard([{ kind: 'file', type: 'image/png', file: png() }], 'Q3\t1200');
		expect(pastedImages(paste(data, el({ tagName: 'TEXTAREA' })), AT)).toEqual([]);
		// ...but outside a text field there's nothing to type into, so attach it.
		expect(pastedImages(paste(data, el({ tagName: 'DIV' })), AT)).toHaveLength(1);
	});

	it('ignores a paste with no image at all', () => {
		expect(pastedImages(paste(clipboard([], 'hello')), AT)).toEqual([]);
		expect(pastedImages(paste(null), AT)).toEqual([]);
	});
});
