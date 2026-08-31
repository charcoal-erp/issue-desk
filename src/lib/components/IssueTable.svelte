<script lang="ts">
	import type { Application, Issue, IssueFilter, User } from '$lib/types';
	import { COLUMNS, columns } from '$lib/stores/columns.svelte';
	import Icon from './Icon.svelte';
	import IssueRow from './IssueRow.svelte';

	let {
		rows,
		users,
		applications,
		filter,
		onSort,
		onOpen,
		onEdit,
		onCopy
	}: {
		rows: Issue[];
		users: User[];
		applications: Application[];
		filter: IssueFilter;
		onSort: (key: NonNullable<IssueFilter['sort']>) => void;
		onOpen: (issue: Issue) => void;
		onEdit: (issue: Issue) => void;
		onCopy: (issue: Issue) => void;
	} = $props();

	const appColor = $derived(
		new Map(applications.map((a) => [a.id, a.color] as const))
	);

	// One list drives both the headers here and the cells in each row, so a
	// hidden column cannot go out of step between the two.
	const shown = $derived(COLUMNS.filter((c) => columns.visible[c.key]));

	function arrow(key: string): string {
		if ((filter.sort ?? 'updated') !== key) return '';
		return (filter.dir ?? 'desc') === 'asc' ? '▲' : '▼';
	}
</script>

<div class="table-wrap">
	{#if rows.length}
		<table class="tbl">
			<thead>
				<tr>
					<th class="rail"></th>
					<th class="sortable" onclick={() => onSort('id')}>ID <span class="sarrow">{arrow('id')}</span></th>
					<th class="sortable" onclick={() => onSort('title')}>Issue <span class="sarrow">{arrow('title')}</span></th>
					{#each shown as c (c.key)}
						{#if c.sort}
							{@const sort = c.sort}
							<th class="sortable" onclick={() => onSort(sort)}>
								{c.label} <span class="sarrow">{arrow(sort)}</span>
							</th>
						{:else}
							<th>{c.label}</th>
						{/if}
					{/each}
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as issue (issue.id)}
					<IssueRow {issue} {users} appColor={appColor.get(issue.appId)} {onOpen} {onEdit} {onCopy} />
				{/each}
			</tbody>
		</table>
	{:else}
		<div class="empty">
			<Icon name="search-lg" />
			<h3>No issues match these filters</h3>
			<p>Try clearing a filter, or file a new issue.</p>
		</div>
	{/if}
</div>
