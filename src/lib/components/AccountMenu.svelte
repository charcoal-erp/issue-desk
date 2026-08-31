<script lang="ts">
	import type { SessionUser, User } from '$lib/types';
	import { restoreTheme, setTheme, theme, type ThemeChoice } from '$lib/stores/theme.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	/**
	 * Replaces the old user switcher: identity now comes from a real session, so
	 * this shows who you are and lets you leave, rather than letting anyone file
	 * as anyone.
	 */
	let { user }: { user: SessionUser } = $props();

	let open = $state(false);

	// The pre-paint script in app.html has already applied the stored choice;
	// this only catches the state up so the right option reads as selected.
	$effect(() => {
		restoreTheme();
	});

	const THEMES: { value: ThemeChoice; label: string; icon: string }[] = [
		{ value: 'light', label: 'Light', icon: 'eye' },
		{ value: 'dark', label: 'Dark', icon: 'monitor' },
		{ value: 'system', label: 'System', icon: 'refresh' }
	];

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
		<div class="lbl">Appearance</div>
		<div class="theme-seg">
			{#each THEMES as t (t.value)}
				<button
					type="button"
					class:on={theme.choice === t.value}
					aria-pressed={theme.choice === t.value}
					onclick={(e) => {
						e.stopPropagation();
						setTheme(t.value);
					}}
				>
					<Icon name={t.icon} />{t.label}
				</button>
			{/each}
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
		color: var(--inprog-ink);
	}
	.signout {
		width: 100%;
		color: var(--open);
	}
	.theme-seg {
		display: flex;
		gap: 3px;
		padding: 2px 10px 10px;
		margin-bottom: 6px;
		border-bottom: 1px solid var(--line-2);
	}
	.theme-seg button {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 7px 4px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
		transition: 0.12s;
	}
	.theme-seg button:hover {
		border-color: var(--line-hover);
		color: var(--ink-2);
	}
	.theme-seg button.on {
		background: var(--accent-soft-2);
		border-color: var(--accent-soft);
		color: var(--accent-ink);
	}
	.theme-seg :global(svg) {
		width: 15px;
		height: 15px;
	}
</style>
