<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from '$lib/types';
	import Icon from './Icon.svelte';
	import UserSwitcher from './UserSwitcher.svelte';

	let { users, currentUserId }: { users: User[]; currentUserId: string } = $props();

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
			const params =
				page.url.pathname === '/' ? new URLSearchParams(page.url.searchParams) : new URLSearchParams();
			if (value.trim()) params.set('q', value.trim());
			else params.delete('q');
			goto(`/?${params}`, { keepFocus: true, noScroll: true, replaceState: true });
		}, 200);
	}

	export function focusSearch() {
		input?.focus();
	}
</script>

<header class="topbar">
	<a class="brand" href="/">
		<div class="mark"><Icon name="logo" /></div>
		<div class="name">Issue<b>Desk</b></div>
		<span class="tag">QA · Feature intake</span>
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
	<UserSwitcher {users} {currentUserId} />
</header>

<style>
	.brand .mark :global(svg) {
		color: #fff;
	}
</style>
