<script lang="ts">
	let {
		name,
		color,
		bold = false
	}: {
		name: string;
		color?: string;
		bold?: boolean;
	} = $props();
</script>

<span class="app-chip">
	<span class="app-dot" style="background:{color ?? 'var(--muted)'}"></span>
	{#if bold}<b>{name}</b>{:else}{name}{/if}
</span>
