import { describe, expect, it } from 'vitest';
import { filterToParams, parseFilter } from '$lib/filter';
import type { IssueFilter } from '$lib/types';

describe('filter <-> URL round trip', () => {
	it('round-trips a full filter', () => {
		const filter: IssueFilter = {
			q: 'otp',
			appId: 'charcoal-erp',
			moduleId: 'auth',
			type: 'bug',
			status: ['open', 'in-progress'],
			priority: ['critical'],
			assigneeId: 'kiran',
			tag: 'regression',
			updatedFrom: '2026-07-01',
			updatedTo: '2026-07-17',
			sort: 'priority',
			dir: 'desc',
			page: 2,
			pageSize: 25
		};
		expect(parseFilter(filterToParams(filter))).toEqual(filter);
	});

	it('drops unknown enum values instead of crashing', () => {
		const params = new URLSearchParams('status=bogus&priority=nope&type=weird&sort=hack&dir=up');
		expect(parseFilter(params)).toEqual({});
	});

	it('ignores empty and whitespace-only q', () => {
		expect(parseFilter(new URLSearchParams('q=+++'))).toEqual({});
	});
});
