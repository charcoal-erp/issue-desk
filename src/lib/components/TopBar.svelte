<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SessionUser } from '$lib/types';
	import Icon from './Icon.svelte';
	import AccountMenu from './AccountMenu.svelte';

	let { user }: { user: SessionUser } = $props();

	// Global search mirrors the table's `q` URL param (§13).
	let value = $state(page.url.searchParams.get('q') ?? '');
	let input = $state<HTMLInputElement | undefined>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// Keep in sync when the URL changes elsewhere (chips, quick filter).
		value = page.url.searchParams.get('q') ?? '';
	});

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			// Searching from anywhere lands on the Issues list; preserve existing
			// filters only when we're already there.
			const params =
				page.url.pathname === '/issues'
					? new URLSearchParams(page.url.searchParams)
					: new URLSearchParams();
			if (value.trim()) params.set('q', value.trim());
			else params.delete('q');
			goto(`/issues?${params}`, { keepFocus: true, noScroll: true, replaceState: true });
		}, 200);
	}

	export function focusSearch() {
		input?.focus();
	}
</script>

<header class="topbar">
	<a class="brand" href="/" aria-label="IssueDesk home">
		<div class="mark"><Icon name="logo" /></div>
	</a>
	<div class="topbar-spacer"></div>
	<div class="topsearch">
		<Icon name="search" />
		<input
			bind:this={input}
			bind:value
			oninput={onInput}
			placeholder="Search issues, IDs, modules…"
		/>
		<kbd>/</kbd>
	</div>
	<AccountMenu {user} />
</header>

<style>
	.brand .mark :global(svg) {
		color: #fff;
	}
</style>
