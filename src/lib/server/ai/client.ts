import Anthropic from '@anthropic-ai/sdk';
import { getKeyForRequest, redact } from '../security/vault';

/**
 * Thin Anthropic access layer for IssueDesk's AI features. The key comes from
 * the vault (or the ANTHROPIC_API_KEY fallback) per request; a client is built
 * per call rather than cached, so a rotated or removed key can never keep
 * working through a stale client.
 */

/** The AI service is not configured or a call failed — surfaced to the user. */
export class AiError extends Error {}

const MAX_TOKENS = 4000;

async function client(): Promise<Anthropic> {
	const apiKey = await getKeyForRequest('anthropic');
	if (!apiKey) {
		throw new AiError(
			'AI is not configured. Add an Anthropic API key under Config → Keys (or set ANTHROPIC_API_KEY).'
		);
	}
	return new Anthropic({ apiKey, maxRetries: 1 });
}

interface CallOptions {
	model: string;
	system: string;
	user: string;
	maxTokens?: number;
}

/**
 * One non-streaming completion. Returns the plain text. Adaptive thinking is on
 * (recommended for Opus 4.8 / Haiku 4.5). Any failure — auth, rate limit,
 * refusal, network — is translated into an AiError so the caller can show it and
 * leave the user's data untouched.
 */
export async function complete(opts: CallOptions): Promise<string> {
	const anthropic = await client();
	let message;
	try {
		message = await anthropic.messages.create({
			model: opts.model,
			max_tokens: opts.maxTokens ?? MAX_TOKENS,
			thinking: { type: 'adaptive' },
			system: opts.system,
			messages: [{ role: 'user', content: opts.user }]
		});
	} catch (e) {
		if (e instanceof Anthropic.APIError) {
			throw new AiError(redact(e.message || 'The AI request failed.'));
		}
		throw new AiError(redact((e as Error).message ?? 'The AI request failed.'));
	}
	if (message.stop_reason === 'refusal') {
		throw new AiError('The model declined this request.');
	}
	return message.content
		.filter((b): b is Anthropic.TextBlock => b.type === 'text')
		.map((b) => b.text)
		.join('')
		.trim();
}

/** Cheapest possible live call, to validate a key (Keys screen "Test"). */
export async function testKey(apiKey: string, model: string): Promise<void> {
	const anthropic = new Anthropic({ apiKey, maxRetries: 0 });
	try {
		await anthropic.messages.create({
			model,
			max_tokens: 1,
			messages: [{ role: 'user', content: 'ping' }]
		});
	} catch (e) {
		if (e instanceof Anthropic.APIError) throw new AiError(redact(e.message));
		throw new AiError(redact((e as Error).message ?? 'Connection failed'));
	}
}
