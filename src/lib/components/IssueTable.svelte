<script lang="ts">
	import type { Application, Issue, IssueFilter, User } from '$lib/types';
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
					<th>App / Module</th>
					<th class="sortable" onclick={() => onSort('priority')}>Priority <span class="sarrow">{arrow('priority')}</span></th>
					<th class="sortable" onclick={() => onSort('status')}>Status <span class="sarrow">{arrow('status')}</span></th>
					<th>Assignee</th>
					<th>Files</th>
					<th class="sortable" onclick={() => onSort('updated')}>Updated <span class="sarrow">{arrow('updated')}</span></th>
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
