<script lang="ts">
	import type { TestKind } from '$lib/types';
	import { TEST_KIND_META } from '$lib/checkpoint/meta';
	import Icon from '../Icon.svelte';

	let { kind, small = false }: { kind: TestKind; small?: boolean } = $props();

	const KIND_ICON: Record<TestKind, string> = {
		unit: 'flask',
		api: 'code',
		e2e: 'monitor',
		visual: 'eye',
		shell: 'terminal',
		manual: 'task'
	};
</script>

<span class="kind {TEST_KIND_META[kind].cls}" class:sm={small}>
	<Icon name={KIND_ICON[kind]} />
	{TEST_KIND_META[kind].label}
</span>
