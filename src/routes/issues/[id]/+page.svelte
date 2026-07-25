<script lang="ts">
	import { openDrawer } from '$lib/stores/ui.svelte';

	let { data } = $props();

	// Deep link (§11): /issues/CHR-14 opens the detail drawer over the workspace.
	$effect(() => {
		openDrawer(data.issue);
	});
</script>

<section class="screen"></section>
