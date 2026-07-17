<script lang="ts">
	import { toasts } from '$lib/stores/toasts.svelte';
	import Icon from './Icon.svelte';
</script>

<div class="toast-host">
	{#each toasts() as item (item.id)}
		<div class="toast" class:out={item.out}>
			<Icon name="toast-check" />
			<div>
				<div>{item.title}</div>
				{#if item.sub}<div class="tsub">{item.sub}</div>{/if}
			</div>
		</div>
	{/each}
</div>
