<script lang="ts">
	import type { DuplicateCheckResult, Issue } from '$lib/types';
	import { scoreBand } from '$lib/duplicates';
	import StatusBadge from './StatusBadge.svelte';

	// The result of a duplicate check, best match first. With `onOpen` a match
	// opens in place; without it, it opens in a new tab, so a half-written issue
	// is never navigated away from.
	let {
		result,
		onOpen
	}: {
		result: DuplicateCheckResult;
		onOpen?: (issue: Issue) => void;
	} = $props();
</script>

<div class="dup-meta">
	Compared with {result.scanned} issues ·
	{#if result.scored === 'ai'}
		scored by AI
	{:else}
		<span class="dup-kw" title={result.aiError}>keyword match only{result.aiError ? ' — AI unavailable' : ''}</span>
	{/if}
</div>

{#if result.matches.length === 0}
	<p class="dup-none">No similar issues found.</p>
{:else}
	<ol class="dup-list">
		{#each result.matches as m (m.issue.id)}
			{@const band = scoreBand(m.score)}
			<li class="dup">
				<span class="dup-score {band.tone}" title="{band.label}{m.keywordOnly ? ' (keyword score)' : ''} · keyword overlap {m.keywordScore}%">
					{m.score}%
				</span>
				<div class="dup-body">
					<div class="dup-line">
						{#if onOpen}
							<button type="button" class="dup-id" onclick={() => onOpen(m.issue)}>{m.issue.id}</button>
						{:else}
							<a class="dup-id" href="/issues/{m.issue.id}" target="_blank" rel="noopener">{m.issue.id}</a>
						{/if}
						<span class="dup-title" title={m.issue.title}>{m.issue.title}</span>
					</div>
					<div class="dup-sub">
						<StatusBadge status={m.issue.status} />
						<span>{m.issue.appName}{m.issue.moduleName ? ` / ${m.issue.moduleName}` : ''}</span>
						<span class="dup-band {band.tone}">{band.label}</span>
					</div>
					{#if m.reason}<p class="dup-reason">{m.reason}</p>{/if}
				</div>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.dup-meta {
		font-size: 11.5px;
		color: var(--faint);
		margin-bottom: 8px;
	}
	.dup-kw {
		color: var(--warn-ink);
	}
	.dup-none {
		margin: 0;
		font-size: 12.5px;
		color: var(--muted);
	}
	.dup-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		/* minmax(0, …): without it a long title widens the card past a narrow
		   column instead of wrapping inside it. */
		grid-template-columns: minmax(0, 1fr);
		gap: 8px;
	}
	.dup {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 9px 11px;
	}
	.dup-score {
		flex: none;
		min-width: 46px;
		text-align: center;
		font-weight: 700;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		padding: 4px 6px;
		border-radius: 8px;
	}
	.dup-score.high,
	.dup-band.high {
		color: var(--danger-ink);
		background: var(--open-soft);
	}
	.dup-score.mid,
	.dup-band.mid {
		color: var(--inprog-ink);
		background: var(--inprog-soft);
	}
	.dup-score.low,
	.dup-band.low {
		color: var(--muted);
		background: var(--surface-2);
	}
	.dup-body {
		flex: 1;
		min-width: 0;
	}
	.dup-line {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}
	.dup-id {
		flex: none;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		color: var(--accent);
		padding: 0;
		text-decoration: none;
		cursor: pointer;
	}
	.dup-id:hover {
		text-decoration: underline;
	}
	/* Two lines, then an ellipsis — enough to recognise an issue in the issue
	   view's narrow column, without one long title dominating the list. */
	.dup-title {
		font-size: 13px;
		color: var(--ink);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.dup-sub {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 5px;
		font-size: 11.5px;
		color: var(--muted);
	}
	.dup-band {
		font-size: 10.5px;
		font-weight: 600;
		padding: 1px 7px;
		border-radius: 999px;
	}
	.dup-reason {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--ink-2);
		line-height: 1.45;
	}
</style>
