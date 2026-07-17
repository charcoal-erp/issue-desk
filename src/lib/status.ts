import type { Status } from './types';

export interface StatusMeta {
	label: string;
	color: string;
	badgeClass: string; // status-badge modifier
}

export const STATUS_META: Record<Status, StatusMeta> = {
	open: { label: 'Open', color: '#E5484D', badgeClass: 'st-open' },
	implemented: { label: 'Implemented', color: '#F5A623', badgeClass: 'st-impl' },
	complete: { label: 'Complete', color: '#2FA36B', badgeClass: 'st-done' }
};

export const STATUS_ORDER: Status[] = ['open', 'implemented', 'complete'];

export function statusRank(s: Status): number {
	return STATUS_ORDER.indexOf(s);
}
