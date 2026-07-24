import { describe, expect, it } from 'vitest';
import { sanitizeFilename, sniffMime } from '$lib/server/uploads';

describe('sniffMime', () => {
	it('detects png / jpeg / gif / webp / pdf from magic bytes', () => {
		expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
			'image/png'
		);
		expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
		expect(sniffMime(new TextEncoder().encode('GIF89a......'))).toBe('image/gif');
		const webp = new TextEncoder().encode('RIFF0000WEBPVP8 ');
		expect(sniffMime(webp)).toBe('image/webp');
		expect(sniffMime(new TextEncoder().encode('%PDF-1.7 ...'))).toBe('application/pdf');
	});

	it('rejects unknown content regardless of claimed extension', () => {
		expect(sniffMime(new TextEncoder().encode('#!/bin/sh\nrm -rf'))).toBeUndefined();
		expect(sniffMime(new Uint8Array([]))).toBeUndefined();
	});
});

describe('sanitizeFilename', () => {
	it('slugifies and forces the sniffed extension', () => {
		expect(sanitizeFilename('Screen Shot (1).PNG', 'png')).toBe('screen-shot-1.png');
		expect(sanitizeFilename('../../etc/passwd', 'pdf')).toBe('passwd.pdf');
		expect(sanitizeFilename('Ünïcode näme.jpg', 'jpg')).toBe('n-code-n-me.jpg');
	});

	it('never returns an empty basename', () => {
		expect(sanitizeFilename('....', 'png')).toBe('file.png');
	});
});
