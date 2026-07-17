<script lang="ts">
	import type { Status } from '$lib/types';
	import { STATUS_META } from '$lib/status';

	// Status is always a coloured dot + word (§15.1).
	let { status }: { status: Status } = $props();
	const meta = $derived(STATUS_META[status]);
</script>

<span class="status-badge {meta.badgeClass}">
	<span class="status-dot" style="background:{meta.color}"></span>{meta.label}
</span>
