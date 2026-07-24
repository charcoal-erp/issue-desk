<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { User } from '$lib/types';
	import { toast } from '$lib/stores/toasts.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	let { users, currentUserId }: { users: User[]; currentUserId: string } = $props();

	let open = $state(false);
	const current = $derived(users.find((u) => u.id === currentUserId) ?? users[0]);

	async function pick(user: User) {
		open = false;
		if (user.id === currentUserId) return;
		document.cookie = `issuedesk_user=${encodeURIComponent(user.id)}; path=/; max-age=31536000; samesite=lax`;
		await invalidateAll();
		toast(`Now filing as ${user.name.split(' ')[0]}`, user.role);
	}
</script>

<svelte:document onclick={() => (open = false)} />

<div class="usw">
	<button
		class="usw-btn"
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
	>
		<Avatar user={current} size={30} />
		<span class="who"><span class="n">{current?.name}</span><span class="r">{current?.role}</span></span>
		<Icon name="chevron" class="chev" />
	</button>
	<div class="usw-menu" class:open>
		<div class="lbl">Filing issues as</div>
		{#each users as user (user.id)}
			<button
				class="usw-item"
				class:active={user.id === currentUserId}
				onclick={(e) => {
					e.stopPropagation();
					pick(user);
				}}
			>
				<Avatar {user} size={30} />
				<span class="who"><span class="n">{user.name}</span><span class="r">{user.role}</span></span>
				<Icon name="check" class="tick" />
			</button>
		{/each}
	</div>
</div>

<style>
	.usw-btn .who,
	.usw-item .who {
		display: flex;
		flex-direction: column;
	}
</style>
