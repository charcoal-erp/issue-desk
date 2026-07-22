<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from './Icon.svelte';

	let { current }: { current: 'desk' | 'qa' } = $props();

	const WORKSPACES = {
		desk: {
			href: '/desk',
			name: 'IssueDesk',
			desc: 'Bugs & feature requests',
			icon: 'bug',
			color: '#5B4BFF'
		},
		qa: {
			href: '/qa',
			name: 'Checkpoint',
			desc: 'Tests, suites & runs',
			icon: 'task',
			color: '#0D9488'
		}
	} as const;

	const order = ['desk', 'qa'] as const;
	let open = $state(false);
	const active = $derived(WORKSPACES[current]);

	function toggle() {
		open = !open;
	}
	function pick(key: 'desk' | 'qa') {
		open = false;
		if (key !== current) goto(WORKSPACES[key].href);
	}
	function onWindowClick(e: MouseEvent) {
		if (open && !(e.target as HTMLElement).closest('.wsw')) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="wsw">
	<button class="wsw-btn" onclick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label="Switch workspace">
		<span class="wdot" style="background:{active.color}"></span>
		<span class="wn">{active.name}</span>
		<Icon name="chevron" />
	</button>

	{#if open}
		<div class="wsw-menu" role="menu">
			<div class="wsw-lbl">Switch workspace</div>
			{#each order as key (key)}
				{@const w = WORKSPACES[key]}
				<button class="wsw-item" class:active={key === current} role="menuitem" onclick={() => pick(key)}>
					<span class="wi-mark" style="background:{w.color}"><Icon name={w.icon} /></span>
					<span class="wi-txt">
						<span class="wi-n">{w.name}</span>
						<span class="wi-d">{w.desc}</span>
					</span>
					{#if key === current}<Icon name="check-sm" class="wi-tick" />{/if}
				</button>
			{/each}
			<div class="wsw-foot">One repo · two separate interfaces</div>
		</div>
	{/if}
</div>

<style>
	.wsw {
		position: relative;
	}
	.wsw-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 40px;
		min-width: 186px;
		padding: 0 13px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		transition: background 0.15s;
	}
	.wsw-btn:hover {
		background: var(--surface-2);
	}
	.wdot {
		width: 9px;
		height: 9px;
		border-radius: 3px;
		flex: 0 0 9px;
	}
	.wn {
		flex: 1;
		text-align: left;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--ink);
		white-space: nowrap;
	}
	.wsw-btn :global(svg) {
		width: 14px;
		height: 14px;
		color: var(--faint);
	}
	.wsw-menu {
		position: absolute;
		top: 48px;
		left: 0;
		width: 258px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: var(--shadow-lg);
		padding: 6px;
		z-index: 60;
		animation: wsw-pop 0.14s ease;
	}
	@keyframes wsw-pop {
		from {
			opacity: 0;
			transform: scale(0.97) translateY(4px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
	.wsw-lbl {
		font-size: 10.5px;
		color: var(--faint);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 8px 10px 6px;
		font-weight: 600;
	}
	.wsw-item {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 9px 10px;
		border-radius: 9px;
		width: 100%;
		text-align: left;
		transition: background 0.12s;
	}
	.wsw-item:hover {
		background: var(--surface-2);
	}
	.wsw-item.active {
		background: var(--surface-2);
	}
	.wi-mark {
		width: 32px;
		height: 32px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		flex: 0 0 32px;
	}
	.wi-mark :global(svg) {
		width: 17px;
		height: 17px;
		color: #fff;
	}
	.wi-txt {
		flex: 1;
		min-width: 0;
	}
	.wi-n {
		display: block;
		font-weight: 600;
		font-size: 13.5px;
		color: var(--ink);
	}
	.wi-d {
		display: block;
		font-size: 11px;
		color: var(--muted);
	}
	.wsw-item :global(.wi-tick) {
		width: 15px;
		height: 15px;
		color: var(--ink-2);
		flex: 0 0 15px;
	}
	.wsw-foot {
		font-size: 10.5px;
		color: var(--faint);
		padding: 8px 10px 4px;
		border-top: 1px solid var(--line-2);
		margin-top: 4px;
	}
</style>
