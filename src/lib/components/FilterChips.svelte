<script lang="ts">
	import type { Application, Category, IssueFilter, Priority, Source, Status } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import { SOURCE_META } from '$lib/source';
	import Icon from './Icon.svelte';

	let {
		filter,
		applications,
		categories,
		onChange,
		onClearAll
	}: {
		filter: IssueFilter;
		applications: Application[];
		categories: Category[];
		onChange: (patch: Partial<IssueFilter>) => void;
		onClearAll: () => void;
	} = $props();

	const selectedApp = $derived(applications.find((a) => a.id === filter.appId));
	const appName = $derived(selectedApp?.name ?? filter.appId);
	const moduleName = $derived(
		selectedApp?.modules.find((m) => m.id === filter.moduleId)?.name ?? filter.moduleId
	);
	const categoryName = $derived(
		categories.find((c) => c.id === filter.categoryId)?.name ?? filter.categoryId
	);
	const dateLabel = $derived(
		filter.updatedFrom && filter.updatedTo
			? filter.updatedFrom === filter.updatedTo
				? filter.updatedFrom
				: `${filter.updatedFrom} → ${filter.updatedTo}`
			: filter.updatedFrom
				? `since ${filter.updatedFrom}`
				: `until ${filter.updatedTo}`
	);
	const hasAny = $derived(
		Boolean(
			filter.appId ||
				filter.moduleId ||
				filter.categoryId ||
				filter.tag ||
				filter.status?.length ||
				filter.priority?.length ||
				filter.source?.length ||
				filter.updatedFrom ||
				filter.updatedTo ||
				filter.type ||
				filter.q
		)
	);

	function dropStatus(s: Status) {
		onChange({ status: (filter.status ?? []).filter((x) => x !== s) });
	}
	function dropPriority(p: Priority) {
		onChange({ priority: (filter.priority ?? []).filter((x) => x !== p) });
	}
	function dropSource(s: Source) {
		onChange({ source: (filter.source ?? []).filter((x) => x !== s) });
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
		{#if filter.moduleId}
			<span class="chip"
				>Module <b>{moduleName}</b><button
					aria-label="Remove module filter"
					onclick={() => onChange({ moduleId: undefined })}><Icon name="x-sm" /></button
				></span
			>
		{/if}
		{#if filter.categoryId}
			<span class="chip"
				>Category <b>{categoryName}</b><button
					aria-label="Remove category filter"
					onclick={() => onChange({ categoryId: undefined })}><Icon name="x-sm" /></button
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
		{#each filter.source ?? [] as s (s)}
			<span class="chip"
				>Source <b>{SOURCE_META[s].label}</b><button
					aria-label="Remove source filter"
					onclick={() => dropSource(s)}><Icon name="x-sm" /></button
				></span
			>
		{/each}
		{#if filter.tag}
			<span class="chip"
				>Tag <b>{filter.tag}</b><button
					aria-label="Remove tag filter"
					onclick={() => onChange({ tag: undefined })}><Icon name="x-sm" /></button
				></span
			>
		{/if}
		{#if filter.updatedFrom || filter.updatedTo}
			<span class="chip"
				>Updated <b>{dateLabel}</b><button
					aria-label="Remove date filter"
					onclick={() => onChange({ updatedFrom: undefined, updatedTo: undefined })}
					><Icon name="x-sm" /></button
				></span
			>
		{/if}
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
