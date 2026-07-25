<script lang="ts">
	import { dismiss, toasts } from '$lib/stores/toasts.svelte';
	import Icon from './Icon.svelte';
</script>

<div class="toast-host">
	{#each toasts() as item (item.id)}
		<div class="toast" class:out={item.out}>
			<Icon name="toast-check" />
			<div class="tbody">
				<div>{item.title}</div>
				{#if item.sub}<div class="tsub">{item.sub}</div>{/if}
			</div>
			<button
				type="button"
				class="tx"
				onclick={() => dismiss(item.id)}
				aria-label="Dismiss notification"
			>
				<Icon name="x-sm" />
			</button>
		</div>
	{/each}
</div>
