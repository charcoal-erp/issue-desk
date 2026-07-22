<script lang="ts">
	import type { ResultStatus } from '$lib/types';
	import { RESULT_META } from '$lib/checkpoint/meta';

	let { status }: { status: ResultStatus | 'none' } = $props();
	const cls = $derived(status === 'none' ? 'rd-none' : RESULT_META[status].cls);
</script>

<span class="res-dot {cls}"></span>
