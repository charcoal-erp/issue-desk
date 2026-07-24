import type { Priority } from './types';

export interface PriorityMeta {
	label: string;
	pips: number; // filled squares in the 5-pip meter
	color: string;
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
	critical: { label: 'Critical', pips: 5, color: '#E5484D' },
	very_high: { label: 'Very High', pips: 4, color: '#F76808' },
	high: { label: 'High', pips: 3, color: '#F5A623' },
	medium: { label: 'Medium', pips: 2, color: '#8B93A7' },
	low: { label: 'Low', pips: 1, color: '#B8BEC9' }
};

/** Intrinsic order Critical→Low, used for sorting and the board. */
export const PRIORITY_ORDER: Priority[] = ['critical', 'very_high', 'high', 'medium', 'low'];

export function priorityRank(p: Priority): number {
	return PRIORITY_ORDER.indexOf(p);
}
