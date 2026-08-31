import type { Activity } from './types';
import { PRIORITY_META } from './priority';
import { STATUS_META } from './status';

/**
 * One activity entry, split so each caller can emphasise the changed value in
 * its own markup — `<b>` in the drawer, `**` in a Markdown export — without a
 * second copy of the switch below drifting out of step with this one.
 */
export interface ActivityLine {
	lead: string;
	/** The changed value, if the entry has one. */
	value?: string;
	trail: string;
}

/** Describes what an entry did. Comments carry their own body and are not here. */
export function describeActivity(entry: Activity, nameOf: (id: string) => string): ActivityLine {
	switch (entry.kind) {
		case 'created':
			return { lead: '', value: nameOf(entry.by), trail: ' created this issue' };
		case 'status':
			return {
				lead: 'Status moved to ',
				value: STATUS_META[entry.to as keyof typeof STATUS_META]?.label ?? entry.to,
				trail: ''
			};
		case 'priority':
			return {
				lead: 'Priority changed to ',
				value: PRIORITY_META[entry.to as keyof typeof PRIORITY_META]?.label ?? entry.to,
				trail: ''
			};
		case 'assignee':
			return entry.to
				? { lead: 'Assigned to ', value: nameOf(entry.to), trail: '' }
				: { lead: 'Unassigned', trail: '' };
		case 'edit':
			return { lead: '', value: nameOf(entry.by), trail: ' edited this issue' };
		case 'attachment':
			return entry.to
				? { lead: 'Attachment ', value: entry.to, trail: ' added' }
				: { lead: 'Attachment ', value: entry.from ?? '', trail: ' removed' };
		default:
			return { lead: '', value: nameOf(entry.by), trail: ' updated this issue' };
	}
}

/** "Status moved to **Open**" — the same line rendered for Markdown. */
export function activityMarkdown(entry: Activity, nameOf: (id: string) => string): string {
	const { lead, value, trail } = describeActivity(entry, nameOf);
	return `${lead}${value ? `**${value}**` : ''}${trail}`;
}
