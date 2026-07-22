<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Issue, IssueFilter } from '$lib/types';
	import { filterToParams } from '$lib/filter';
	import { singleIssueMarkdown } from '$lib/export/copyIssue';
	import { toast } from '$lib/stores/toasts.svelte';
	import { openDrawer, openEditIssue, openExport, openNewIssue } from '$lib/stores/ui.svelte';
	import FilterRail from '$lib/components/FilterRail.svelte';
	import FilterChips from '$lib/components/FilterChips.svelte';
	import IssueTable from '$lib/components/IssueTable.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	let quick = $state(page.url.searchParams.get('q') ?? '');
	let quickTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		quick = page.url.searchParams.get('q') ?? '';
	});

	function navigate(patch: Partial<IssueFilter>, replace = false) {
		const next: IssueFilter = { ...data.filter, ...patch };
		goto(`/desk?${filterToParams(next)}`, { keepFocus: true, noScroll: true, replaceState: replace });
	}

	function onQuickInput() {
		clearTimeout(quickTimer);
		quickTimer = setTimeout(() => navigate({ q: quick.trim() || undefined }, true), 200);
	}

	function clearAll() {
		quick = '';
		goto('/desk', { keepFocus: true, noScroll: true });
	}

	function sortBy(key: NonNullable<IssueFilter['sort']>) {
		const current = data.filter.sort ?? 'updated';
		const newestFirst = (k: string) => k === 'priority' || k === 'updated' || k === 'created';
		const currentDir = data.filter.dir ?? (newestFirst(current) ? 'desc' : 'asc');
		if (current === key) {
			navigate({ sort: key, dir: currentDir === 'asc' ? 'desc' : 'asc' });
		} else {
			navigate({ sort: key, dir: newestFirst(key) ? 'desc' : 'asc' });
		}
	}

	async function copyIssue(issue: Issue) {
		try {
			await navigator.clipboard.writeText(
				singleIssueMarkdown(issue, data.users, location.origin)
			);
			toast(`Copied ${issue.id}`, 'Single-issue prompt ready for Claude Code');
		} catch {
			toast('Copy failed', 'Select the text and copy manually');
		}
	}
</script>

<section class="screen">
	<FilterRail
		applications={data.applications}
		counts={data.counts}
		filter={data.filter}
		onChange={(patch) => navigate(patch)}
	/>

	<div class="table-area">
		<div class="toolbar">
			<h1>Issues</h1>
			<span class="count">{data.total} {data.total === 1 ? 'issue' : 'issues'}</span>
			<div class="toolbar-spacer"></div>
			<div class="tb-search">
				<Icon name="search" />
				<input placeholder="Quick filter…" bind:value={quick} oninput={onQuickInput} />
			</div>
			<button class="btn btn-ghost" onclick={() => openExport(data.total)}>
				<Icon name="export" />
				Export
			</button>
			<button class="btn btn-primary" onclick={() => openNewIssue()}>
				<Icon name="plus" />
				New issue
			</button>
		</div>
		<FilterChips
			filter={data.filter}
			applications={data.applications}
			onChange={(patch) => navigate(patch)}
			onClearAll={clearAll}
		/>
		<IssueTable
			rows={data.rows}
			users={data.users}
			applications={data.applications}
			filter={data.filter}
			onSort={sortBy}
			onOpen={(issue) => openDrawer(issue)}
			onEdit={(issue) => openEditIssue(issue)}
			onCopy={copyIssue}
		/>
	</div>
</section>
