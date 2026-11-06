<script lang="ts">
	import type { IssueFilter, Status, User } from '$lib/types';
	import { STATUS_META, STATUS_ORDER } from '$lib/status';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	// What one person has reported, by status — shown while the list is
	// filtered to them. The counts cover everything they filed, not just what
	// the other filters leave, so the card reads the same whichever you add.
	let {
		reporterId,
		user,
		byStatus,
		filter,
		onChange
	}: {
		reporterId: string;
		user: User | undefined;
		byStatus: Record<Status, number>;
		filter: IssueFilter;
		onChange: (patch: Partial<IssueFilter>) => void;
	} = $props();

	const total = $derived(STATUS_ORDER.reduce((n, s) => n + byStatus[s], 0));

	function toggleStatus(s: Status) {
		const set = new Set(filter.status ?? []);
		if (set.has(s)) set.delete(s);
		else set.add(s);
		onChange({ status: [...set] });
	}
</script>

<section class="rc" aria-label="Issues reported by {user?.name ?? reporterId}">
	<div class="rc-head">
		<Avatar {user} size={30} />
		<div class="rc-who">
			<b>{user?.name ?? reporterId}</b>
			<span>{total} {total === 1 ? 'issue' : 'issues'} reported</span>
		</div>
		<button
			class="rc-x"
			aria-label="Stop filtering by reporter"
			title="Stop filtering by reporter"
			onclick={() => onChange({ reporterId: undefined })}><Icon name="x-sm" /></button
		>
	</div>
	{#if total}
		<div class="rc-bar">
			{#each STATUS_ORDER as s (s)}
				{#if byStatus[s]}
					<span style="flex:{byStatus[s]};background:{STATUS_META[s].color}" title="{STATUS_META[s].label}: {byStatus[s]}"></span>
				{/if}
			{/each}
		</div>
	{/if}
	<div>
		{#each STATUS_ORDER as s (s)}
			<button class="app-item" class:active={filter.status?.includes(s)} onclick={() => toggleStatus(s)}>
				<span class="app-dot" style="background:{STATUS_META[s].color}"></span>
				<span class="an">{STATUS_META[s].label}</span>
				<span class="ac">{byStatus[s]}</span>
			</button>
		{/each}
	</div>
</section>

<style>
	.rc {
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-radius: 11px;
		padding: 12px 8px 8px;
		margin-bottom: 20px;
	}
	.rc-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 4px;
	}
	.rc-who {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.rc-who b {
		font-size: 13.5px;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rc-who span {
		font-size: 11.5px;
		color: var(--muted);
	}
	.rc-x {
		width: 26px;
		height: 26px;
		border-radius: 7px;
		display: grid;
		place-items: center;
		color: var(--muted);
	}
	.rc-x:hover {
		background: var(--surface);
		color: var(--ink);
	}
	.rc-bar {
		display: flex;
		gap: 2px;
		height: 6px;
		margin: 12px 4px 8px;
		border-radius: 4px;
		overflow: hidden;
	}
</style>
