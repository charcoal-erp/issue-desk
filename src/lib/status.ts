import type { Status } from './types';

export interface StatusMeta {
	label: string;
	shortLabel: string; // compact label for the modal status picker
	color: string;
	badgeClass: string; // status-badge modifier
	pickerClass: string; // status-opt modifier in the New/Edit modal
}

export const STATUS_META: Record<Status, StatusMeta> = {
	open: { label: 'Open', shortLabel: 'Open', color: '#E5484D', badgeClass: 'st-open', pickerClass: 's-open' },
	implemented: {
		label: 'Implemented', shortLabel: 'Impl.', color: '#F5A623', badgeClass: 'st-impl', pickerClass: 's-impl'
	},
	complete: {
		label: 'Complete', shortLabel: 'Done', color: '#2FA36B', badgeClass: 'st-done', pickerClass: 's-done'
	},
	rejected: {
		label: 'Rejected', shortLabel: 'Reject', color: '#64748B', badgeClass: 'st-rejected', pickerClass: 's-rejected'
	}
};

export const STATUS_ORDER: Status[] = ['open', 'implemented', 'complete', 'rejected'];

export function statusRank(s: Status): number {
	return STATUS_ORDER.indexOf(s);
}
