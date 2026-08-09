import type { Source } from './types';

export interface SourceMeta {
	label: string;
	shortLabel: string;
	color: string;
	description: string;
}

/**
 * Display metadata for how an issue arrived. Nothing here is user-selectable —
 * the source is derived on the server from the account that filed the issue
 * (see `sourceFor` in the store) — so these labels only ever describe, never
 * offer a choice.
 */
export const SOURCE_META: Record<Source, SourceMeta> = {
	'manual-testing': {
		label: 'Manual testing',
		shortLabel: 'Manual',
		color: '#5B4BFF',
		description: 'Filed by a person, testing by hand.'
	},
	'checkpoint-triggered': {
		label: 'Checkpoint-triggered',
		shortLabel: 'Checkpoint',
		color: '#0891B2',
		description: 'Raised from an automated Checkpoint test run.'
	},
	'agent-testing': {
		label: 'Agent testing',
		shortLabel: 'Agent',
		color: '#C15F3C',
		description: 'Raised by an agent during agentic testing.'
	}
};

export const SOURCE_ORDER: Source[] = ['manual-testing', 'checkpoint-triggered', 'agent-testing'];
