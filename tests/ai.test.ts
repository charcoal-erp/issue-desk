import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { slugify, labelFor, reconcileTags } from '$lib/tags';
import { parseTags } from '$lib/server/ai/tags';
import { systemPromptFor } from '$lib/server/ai/refine';
import { setKey, getKeyForRequest, removeKey, mask, status, isVaultReady } from '$lib/server/security/vault';
import { credentialFile } from '$lib/server/fs/paths';

describe('tag vocabulary helpers', () => {
	it('slugifies to the issue tag shape', () => {
		expect(slugify('Login OTP!')).toBe('login-otp');
		expect(slugify('  Data Loss  ')).toBe('data-loss');
	});

	it('labels acronyms and words for display', () => {
		expect(labelFor('login-otp')).toBe('Login OTP');
		expect(labelFor('performance')).toBe('Performance');
	});

	it('folds near-duplicates onto the existing vocabulary', () => {
		// exact + synonym + plural collapse against what already exists
		expect(reconcileTags(['auth', 'authentications'], ['authentication'])).toEqual([
			'authentication'
		]);
		// preserves order and de-dupes within a batch
		expect(reconcileTags(['ui', 'frontend', 'reporting'], [])).toEqual(['ui', 'reporting']);
	});
});

describe('parseTags (fails closed)', () => {
	it('extracts a JSON array, reconciled against the vocabulary', () => {
		expect(parseTags('["authentication","otp","regression"]', ['regression'])).toEqual([
			'authentication',
			'otp',
			'regression'
		]);
	});

	it('tolerates a code fence and surrounding prose', () => {
		expect(parseTags('```json\n["performance","timeout"]\n```', [])).toEqual([
			'performance',
			'timeout'
		]);
		expect(parseTags('Here are the tags: ["ui","layout"] — done', [])).toEqual(['ui', 'layout']);
	});

	it('returns nothing for non-array / junk output', () => {
		expect(parseTags('not json at all', [])).toEqual([]);
		expect(parseTags('{"tags": 5}', [])).toEqual([]);
		expect(parseTags('', [])).toEqual([]);
	});
});

describe('refine system prompts', () => {
	it('carries the mode instruction and the anti-preamble contract', () => {
		const p = systemPromptFor('repro');
		expect(p).toMatch(/Steps to reproduce/);
		expect(p).toMatch(/Return ONLY the rewritten description/);
	});

	it('embeds a custom instruction when given', () => {
		const p = systemPromptFor('custom', 'rewrite for a stakeholder');
		expect(p).toMatch(/rewrite for a stakeholder/);
	});
});

describe('API-key vault', () => {
	afterEach(async () => {
		await removeKey('anthropic');
		await rm(credentialFile('anthropic'), { force: true });
	});

	it('has a usable KEK in the test env', () => {
		expect(isVaultReady()).toBe(true);
	});

	it('encrypts on write and returns plaintext only to getKeyForRequest', async () => {
		const view = await setKey('anthropic', 'sk-ant-secret-value-1234');
		expect(view.status).toBe('configured');
		expect(view.hint).toBe(mask('sk-ant-secret-value-1234'));
		// The client-safe view never carries the key.
		expect(JSON.stringify(view)).not.toContain('secret-value');

		expect(await getKeyForRequest('anthropic')).toBe('sk-ant-secret-value-1234');
	});

	it('rejects a tampered ciphertext instead of returning garbage', async () => {
		await setKey('anthropic', 'sk-ant-abc-9999');
		const { readFile, writeFile } = await import('node:fs/promises');
		const rec = JSON.parse(await readFile(credentialFile('anthropic'), 'utf8'));
		const flipped = Buffer.from(rec.ciphertext, 'base64');
		flipped[0] ^= 0xff;
		rec.ciphertext = flipped.toString('base64');
		await writeFile(credentialFile('anthropic'), JSON.stringify(rec));
		// Undecryptable → treated as no key (falls through to env, which is unset here).
		const prev = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		expect(await getKeyForRequest('anthropic')).toBeUndefined();
		if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
	});

	it('removeKey clears the stored credential', async () => {
		await setKey('anthropic', 'sk-ant-xyz-0000');
		await removeKey('anthropic');
		const prev = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		const view = await status('anthropic');
		expect(view.status).toBe('unset');
		expect(view.source).toBe('none');
		if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
	});
});
