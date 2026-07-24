<script lang="ts">
	import type { User } from '$lib/types';
	import { initials } from '$lib/format';
	import Icon from './Icon.svelte';

	let {
		user,
		size = 26
	}: {
		user: User | undefined;
		size?: number;
	} = $props();
</script>

{#if user}
	<span
		class="avatar"
		style="background:{user.avatarColor ?? '#64748B'};width:{size}px;height:{size}px;font-size:{size <= 26 ? 10 : 11}px"
		>{initials(user.name)}</span
	>
{:else}
	<span class="unassigned"><Icon name="user" /></span>
{/if}
