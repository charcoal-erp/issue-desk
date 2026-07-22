<script lang="ts">
	import type { Priority } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';

	let { priority, showLabel = true }: { priority: Priority; showLabel?: boolean } = $props();

	const CLS: Record<Priority, string> = {
		critical: 'crit',
		very_high: 'veryHigh',
		high: 'high',
		medium: 'med',
		low: 'low'
	};
	const filled = $derived(PRIORITY_META[priority].pips);
</script>

<span class="pip {CLS[priority]}">
	<span class="pips">
		{#each Array(5) as _, i (i)}
			<span class="pip-b" class:on={i < filled}></span>
		{/each}
	</span>
	{#if showLabel}<span class="plabel">{PRIORITY_META[priority].label}</span>{/if}
</span>
