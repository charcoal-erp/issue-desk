<script lang="ts">
	import type { Priority } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';

	// Priority is always a pip meter — five squares, N filled (§15.1).
	// variant maps to the mockup's three pip sizes:
	//   meter → table/board (5×12) · pips → filter rail (4×10) · pm → modal picker (4×11)
	let {
		priority,
		variant = 'meter'
	}: {
		priority: Priority;
		variant?: 'meter' | 'pips' | 'pm';
	} = $props();

	const meta = $derived(PRIORITY_META[priority]);
</script>

<span class={variant}>
	{#each { length: 5 } as _, i (i)}
		<i style={i < meta.pips ? `background:${meta.color}` : ''}></i>
	{/each}
</span>

<style>
	.pm {
		display: inline-flex;
		gap: 2px;
	}
	.pm i {
		width: 4px;
		height: 11px;
		border-radius: 2px;
		background: var(--pip-empty);
	}
</style>
