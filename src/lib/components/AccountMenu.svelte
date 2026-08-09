<script lang="ts">
	import type { SessionUser, User } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	/**
	 * Replaces the old user switcher: identity now comes from a real session, so
	 * this shows who you are and lets you leave, rather than letting anyone file
	 * as anyone.
	 */
	let { user }: { user: SessionUser } = $props();

	let open = $state(false);

	// Avatar takes the config shape; a session carries the same visual fields.
	const asUser = $derived({
		id: user.id,
		name: user.name,
		role: user.role,
		avatarColor: user.avatarColor
	} satisfies User);
</script>

<svelte:document onclick={() => (open = false)} />

<div class="usw">
	<button
		class="usw-btn"
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
	>
		<Avatar user={asUser} size={30} />
		<span class="who">
			<span class="n">{user.name}</span>
			<span class="r">{user.role ?? (user.kind === 'agent' ? 'Agent' : 'Member')}</span>
		</span>
		<Icon name="chevron" class="chev" />
	</button>

	<div class="usw-menu" class:open>
		<div class="lbl">Signed in as</div>
		<div class="usw-id">
			<span class="u">{user.username}</span>
			{#if user.admin}<span class="tag">admin</span>{/if}
			{#if user.kind === 'agent'}<span class="tag agent">agent</span>{/if}
		</div>
		<form method="POST" action="/logout">
			<button class="usw-item signout" type="submit">
				<Icon name="chevron" />
				<span class="who"><span class="n">Sign out</span></span>
			</button>
		</form>
	</div>
</div>

<style>
	.usw-btn .who,
	.usw-item .who {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1.25;
	}
	.usw-id {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 12px 10px;
		border-bottom: 1px solid var(--line-2);
		margin-bottom: 6px;
	}
	.usw-id .u {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-2);
	}
	.tag {
		font-size: 9.5px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 6px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-ink);
	}
	.tag.agent {
		background: var(--inprog-soft);
		color: #a2650e;
	}
	.signout {
		width: 100%;
		color: var(--open);
	}
</style>
