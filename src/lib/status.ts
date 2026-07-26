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
	'in-progress': {
		label: 'In-progress', shortLabel: 'In prog.', color: '#F5A623', badgeClass: 'st-inprog', pickerClass: 's-inprog'
	},
	'to-be-verified': {
		label: 'To be verified', shortLabel: 'Verify', color: '#3B82F6', badgeClass: 'st-verify', pickerClass: 's-verify'
	},
	complete: {
		label: 'Complete', shortLabel: 'Done', color: '#2FA36B', badgeClass: 'st-done', pickerClass: 's-done'
	},
	rejected: {
		label: 'Rejected', shortLabel: 'Reject', color: '#64748B', badgeClass: 'st-rejected', pickerClass: 's-rejected'
	}
};

export const STATUS_ORDER: Status[] = ['open', 'in-progress', 'to-be-verified', 'complete', 'rejected'];

export function statusRank(s: Status): number {
	return STATUS_ORDER.indexOf(s);
}
