<script lang="ts">
	import { COLUMNS, columns, restoreColumns, showAllColumns, toggleColumn } from '$lib/stores/columns.svelte';
	import Icon from './Icon.svelte';

	let open = $state(false);
	let btn = $state<HTMLButtonElement | undefined>();
	let pop = $state<HTMLDivElement | undefined>();

	// The stored preference is read here rather than at module load, so it is
	// applied once the table is on screen instead of during hydration.
	$effect(() => {
		restoreColumns();
	});

	const hidden = $derived(COLUMNS.filter((c) => !columns.visible[c.key]).length);
	// Hiding the last one would leave a table of ids and titles with nothing to
	// compare, so the final checkbox stays locked on.
	const onlyOneLeft = $derived(COLUMNS.filter((c) => columns.visible[c.key]).length === 1);

	$effect(() => {
		if (!open) return;
		const away = (e: Event) => {
			const t = e.target as Node;
			if (!btn?.contains(t) && !pop?.contains(t)) open = false;
		};
		const escape = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			// The page listens for Escape too; a dropdown should close alone.
			e.stopPropagation();
			open = false;
			btn?.focus();
		};
		window.addEventListener('pointerdown', away, true);
		window.addEventListener('keydown', escape, true);
		return () => {
			window.removeEventListener('pointerdown', away, true);
			window.removeEventListener('keydown', escape, true);
		};
	});
</script>

<div class="colpick">
	<button
		bind:this={btn}
		class="btn btn-ghost"
		aria-haspopup="true"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<Icon name="rows" />
		Columns
		{#if hidden}<span class="cp-badge">{hidden} hidden</span>{/if}
	</button>

	{#if open}
		<div bind:this={pop} class="cp-menu">
			<div class="cp-head">
				<span>Show columns</span>
				<button class="cp-all" onclick={showAllColumns} disabled={!hidden}>Show all</button>
			</div>
			{#each COLUMNS as c (c.key)}
				{@const on = columns.visible[c.key]}
				<label class="cp-item" class:locked={on && onlyOneLeft}>
					<input
						type="checkbox"
						checked={on}
						disabled={on && onlyOneLeft}
						onchange={() => toggleColumn(c.key)}
					/>
					<span>{c.label}</span>
				</label>
			{/each}
		</div>
	{/if}
</div>

<style>
	.colpick {
		position: relative;
	}
	.cp-badge {
		font-size: 10.5px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-ink);
	}
	.cp-menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 60;
		min-width: 220px;
		padding: 6px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 10px;
		box-shadow: var(--shadow-lg);
		animation: pop 0.12s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.cp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 4px 8px 8px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--line-2);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	.cp-all {
		font-size: 11.5px;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
		color: var(--accent-ink);
		cursor: pointer;
	}
	.cp-all:disabled {
		color: var(--faint);
		cursor: default;
	}
	.cp-item {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 7px 8px;
		border-radius: 7px;
		font-size: 13px;
		color: var(--ink-2);
		cursor: pointer;
	}
	.cp-item:hover {
		background: var(--surface-2);
	}
	.cp-item.locked {
		cursor: default;
		color: var(--muted);
	}
	.cp-item input {
		accent-color: var(--accent);
		width: 14px;
		height: 14px;
		cursor: inherit;
	}
</style>
