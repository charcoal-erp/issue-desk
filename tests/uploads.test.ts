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

	it('detects legacy Word (.doc) from the OLE2 signature', () => {
		const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
		expect(sniffMime(ole)).toBe('application/msword');
	});

	it('distinguishes DOCX from a generic ZIP by the OOXML word part', () => {
		const pk = [0x50, 0x4b, 0x03, 0x04];
		const docx = new Uint8Array([...pk, ...new TextEncoder().encode('....word/document.xml....')]);
		expect(sniffMime(docx)).toBe(
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		);
		const zip = new Uint8Array([...pk, ...new TextEncoder().encode('....notes.txt....')]);
		expect(sniffMime(zip)).toBe('application/zip');
	});

	it('detects HTML from a leading doctype/tag, conservatively', () => {
		expect(sniffMime(new TextEncoder().encode('<!DOCTYPE html>\n<html></html>'))).toBe('text/html');
		expect(sniffMime(new TextEncoder().encode('  \n<html lang="en">'))).toBe('text/html');
		expect(sniffMime(new TextEncoder().encode('<meta charset="utf-8">'))).toBe('text/html');
		// A BOM prefix must not defeat the sniff.
		const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('<!doctype html>')]);
		expect(sniffMime(bom)).toBe('text/html');
	});

	it('rejects unknown content regardless of claimed extension', () => {
		expect(sniffMime(new TextEncoder().encode('#!/bin/sh\nrm -rf'))).toBeUndefined();
		expect(sniffMime(new TextEncoder().encode('just some plain text, not html'))).toBeUndefined();
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
