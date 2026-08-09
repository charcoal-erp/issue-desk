import type { Status } from './types';

export interface StatusMeta {
	label: string;
	color: string;
	badgeClass: string; // status-badge modifier
}

export const STATUS_META: Record<Status, StatusMeta> = {
	backlog: { label: 'Backlog', color: '#7C3AED', badgeClass: 'st-backlog' },
	open: { label: 'Open', color: '#E5484D', badgeClass: 'st-open' },
	'in-progress': { label: 'In-progress', color: '#F5A623', badgeClass: 'st-inprog' },
	'to-be-verified': { label: 'To be verified', color: '#3B82F6', badgeClass: 'st-verify' },
	complete: { label: 'Complete', color: '#2FA36B', badgeClass: 'st-done' },
	rejected: { label: 'Rejected', color: '#64748B', badgeClass: 'st-rejected' }
};

export const STATUS_ORDER: Status[] = [
	'backlog',
	'open',
	'in-progress',
	'to-be-verified',
	'complete',
	'rejected'
];

export function statusRank(s: Status): number {
	return STATUS_ORDER.indexOf(s);
}

/**
 * Work that is live: filed and not yet finished. Backlog is parked by
 * definition and closed work is done, so neither counts — this is what the
 * dashboard's "open" figures and the agent queue mean by outstanding.
 */
export const ACTIVE_STATUSES: Status[] = ['open', 'in-progress', 'to-be-verified'];
