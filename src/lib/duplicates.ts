import type { DuplicateCheckResult } from './types';

export interface DuplicateCheckInput {
	title: string;
	description: string;
	tags?: string[];
	appId?: string;
	moduleId?: string;
	excludeId?: string;
	limit?: number;
}

/** Ask the server which existing issues look like this one. Throws with a readable message. */
export async function checkDuplicates(input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
	const res = await fetch('/api/ai/duplicates', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(String(body.message ?? res.statusText));
	return body as DuplicateCheckResult;
}

/** The words a score is read as — the same bands the model is asked to use. */
export function scoreBand(score: number): { label: string; tone: 'high' | 'mid' | 'low' } {
	if (score >= 70) return { label: 'Likely duplicate', tone: 'high' };
	if (score >= 40) return { label: 'Related', tone: 'mid' };
	return { label: 'Weak match', tone: 'low' };
}
