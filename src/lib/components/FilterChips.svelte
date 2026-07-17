<script lang="ts">
	import type { Application, IssueFilter, Priority, Status } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import Icon from './Icon.svelte';

	let {
		filter,
		applications,
		onChange,
		onClearAll
	}: {
		filter: IssueFilter;
		applications: Application[];
		onChange: (patch: Partial<IssueFilter>) => void;
		onClearAll: () => void;
	} = $props();

	const appName = $derived(applications.find((a) => a.id === filter.appId)?.name ?? filter.appId);
	const hasAny = $derived(
		Boolean(
			filter.appId || filter.status?.length || filter.priority?.length || filter.type || filter.q
		)
	);

	function dropStatus(s: Status) {
		onChange({ status: (filter.status ?? []).filter((x) => x !== s) });
	}
	function dropPriority(p: Priority) {
		onChange({ priority: (filter.priority ?? []).filter((x) => x !== p) });
	}
</script>

<div class="chips">
	{#if hasAny}
		<span class="lead">Filters</span>
		{#if filter.appId}
			<span class="chip"
				>App <b>{appName}</b><button
					aria-label="Remove app filter"
					onclick={() => onChange({ appId: undefined })}><Icon name="x-sm" /></button
				></span
			>
		{/if}
		{#each filter.status ?? [] as s (s)}
			<span class="chip"
				>Status <b>{STATUS_META[s].label}</b><button
					aria-label="Remove status filter"
					onclick={() => dropStatus(s)}><Icon name="x-sm" /></button
				></span
			>
		{/each}
		{#each filter.priority ?? [] as p (p)}
			<span class="chip"
				>Priority <b>{PRIORITY_META[p].label}</b><button
					aria-label="Remove priority filter"
					onclick={() => dropPriority(p)}><Icon name="x-sm" /></button
				></span
			>
		{/each}
		{#if filter.type}
			<span class="chip"
				>Type <b>{filter.type === 'bug' ? 'Bugs' : 'Features'}</b><button
					aria-label="Remove type filter"
					onclick={() => onChange({ type: undefined })}><Icon name="x-sm" /></button
				></span
			>
		{/if}
		{#if filter.q}
			<span class="chip"
				>Search <b>“{filter.q}”</b><button
					aria-label="Clear search"
					onclick={() => onChange({ q: undefined })}><Icon name="x-sm" /></button
				></span
			>
		{/if}
		<button class="chip clear-all" onclick={onClearAll}>Clear all</button>
	{/if}
</div>

<style>
	.clear-all {
		border-style: dashed;
		color: var(--muted);
	}
</style>
