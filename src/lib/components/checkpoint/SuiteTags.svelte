<script lang="ts">
	/**
	 * Suite tags, rendered by severity rather than as flat text.
	 *
	 * Tags are the only place a suite can say "this wipes a database" or "this
	 * binds a port", and that warning is worthless if it is only visible while
	 * editing the suite. Prefixes carry the severity — `destructive:` reads as a
	 * warning, `cleanup:` / `binds:` / `requires:` as something to be aware of,
	 * everything else as neutral metadata — so the vocabulary stays the content
	 * repo's business and this component needs no list of known tags.
	 */
	let { tags, compact = false }: { tags: string[]; compact?: boolean } = $props();

	function severity(tag: string): 'danger' | 'warn' | 'ok' | 'flat' {
		if (tag.startsWith('destructive:')) return 'danger';
		if (tag.startsWith('cleanup:') || tag.startsWith('binds:') || tag.startsWith('requires:')) return 'warn';
		if (tag === 'db:none') return 'ok';
		return 'flat';
	}
</script>

{#if tags.length}
	<div class="cp-tags" class:compact>
		{#each tags as tag (tag)}
			<span class="cp-tag {severity(tag)}">{tag}</span>
		{/each}
	</div>
{/if}

<style>
	.cp-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.cp-tag {
		font-family: var(--font-mono);
		font-size: 10.5px;
		line-height: 1;
		padding: 4px 7px;
		border-radius: 5px;
		border: 1px solid transparent;
		white-space: nowrap;
	}
	.compact .cp-tag {
		font-size: 10px;
		padding: 3px 6px;
	}
	.cp-tag.flat {
		background: var(--accent-soft-2, #f1f3f7);
		color: var(--muted, #5b6472);
	}
	.cp-tag.ok {
		background: #e8f6ee;
		color: #1c7a45;
		border-color: #bfe3cd;
	}
	.cp-tag.warn {
		background: #fff5e5;
		color: #8a5a00;
		border-color: #f2ddb5;
	}
	.cp-tag.danger {
		background: #fdeceb;
		color: #a52019;
		border-color: #f4c7c3;
		font-weight: 600;
	}
</style>
