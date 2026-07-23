<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';

	let { data } = $props();
</script>

<div class="table-area">
	<div class="toolbar">
		<h1>Search</h1>
		{#if data.q}
			<span class="count">{data.total} result{data.total === 1 ? '' : 's'} for “{data.q}”</span>
		{/if}
	</div>

	<div class="scroll">
		{#if !data.q}
			<div class="empty">
				<div class="empty-in">
					<div class="ei"><Icon name="search" /></div>
					<h3>Search Checkpoint</h3>
					<p>Find a case, suite, run or runner by name, id, spec path, tag or command. Every word has to match, so extra words narrow the result.</p>
				</div>
			</div>
		{:else if !data.groups.length}
			<div class="empty">
				<div class="empty-in">
					<div class="ei"><Icon name="search" /></div>
					<h3>Nothing matches “{data.q}”</h3>
					<p>Try one word, or part of an id — <code>SUITE-SEED</code>, <code>visual</code>, <code>RNR-12</code>.</p>
				</div>
			</div>
		{:else}
			{#each data.groups as g (g.key)}
				<div class="sec-title">
					{g.label}
					<span class="sr-n">{g.total}</span>
					{#if g.total > g.hits.length}<span class="sr-more">showing first {g.hits.length}</span>{/if}
				</div>
				<div class="sr-list">
					{#each g.hits as h (h.id)}
						<a class="sr-row" href={h.href}>
							{#if h.kind}<KindBadge kind={h.kind} small />{/if}
							<span class="sr-id">{h.id}</span>
							<span class="sr-title">{h.title}</span>
							<span class="sr-sub">{h.sub}</span>
							{#if h.badge}<span class="sr-badge">{h.badge}</span>{/if}
						</a>
					{/each}
				</div>
			{/each}
		{/if}
	</div>
</div>
