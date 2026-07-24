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
	 *
	 * `max` keeps a card readable: the most severe tags are shown and the rest
	 * collapse into a +N chip that names them on hover. Severity ordering is
	 * derived from the prefix, so this stays generic too.
	 */
	let {
		tags,
		compact = false,
		max = 0
	}: { tags: string[]; compact?: boolean; max?: number } = $props();

	const RANK = { danger: 0, warn: 1, ok: 2, info: 3, flat: 4 } as const;

	function severity(tag: string): keyof typeof RANK {
		if (tag.startsWith('destructive:')) return 'danger';
		if (tag.startsWith('cleanup:') || tag.startsWith('binds:') || tag.startsWith('requires:')) return 'warn';
		if (tag === 'db:none') return 'ok';
		// Any other db:* is the suite's data posture — it outranks provenance
		// tags, which are the first thing to collapse into +N on a card.
		if (tag.startsWith('db:')) return 'info';
		return 'flat';
	}

	// Stable sort: most severe first, original order preserved within a rank.
	const ordered = $derived(
		tags
			.map((tag, i) => ({ tag, i, rank: RANK[severity(tag)] }))
			.sort((a, b) => a.rank - b.rank || a.i - b.i)
			.map((x) => x.tag)
	);
	const shown = $derived(max > 0 ? ordered.slice(0, max) : ordered);
	const hidden = $derived(max > 0 ? ordered.slice(max) : []);
</script>

{#if tags.length}
	<div class="cp-tags" class:compact>
		{#each shown as tag (tag)}
			<span class="cp-tag {severity(tag)}">{tag}</span>
		{/each}
		{#if hidden.length}
			<span class="cp-tag flat more" title={hidden.join('\n')}>+{hidden.length}</span>
		{/if}
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
		text-decoration: none;
	}
	.compact .cp-tag {
		font-size: 10px;
		padding: 3px 6px;
	}
	.cp-tag.flat {
		background: var(--accent-soft-2, #f1f3f7);
		color: var(--muted, #5b6472);
	}
	.cp-tag.info {
		background: #eef2fb;
		color: #3f5488;
		border-color: #d5deef;
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
	.cp-tag.more {
		cursor: help;
	}
</style>
