<script lang="ts">
	import { goto } from '$app/navigation';
	import { ENV_LABEL, rateColor } from '$lib/checkpoint/meta';
	import { openLaunch } from '$lib/stores/checkpoint-ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import ProgressBar from '$lib/components/checkpoint/ProgressBar.svelte';

	let { data } = $props();
</script>

<div class="table-area">
	<div class="toolbar">
		<h1>Test Runs</h1>
		<span class="count">{data.runs.length} run{data.runs.length === 1 ? '' : 's'}</span>
		<div class="toolbar-spacer"></div>
		<button class="btn btn-primary" onclick={() => openLaunch(null)}><Icon name="play" /> Launch run</button>
	</div>

	<div class="scroll">
		{#if data.runs.length}
			{#each data.runs as r (r.id)}
				<div class="run-card" onclick={() => goto(`/qa/runs/${r.id}`)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && goto(`/qa/runs/${r.id}`)}>
					<div class="run-top">
						<span class="run-id">{r.id}</span>
						<span class="run-suite">{r.suiteName}</span>
						{#each r.kinds as k (k)}<KindBadge kind={k} small />{/each}
						<span class="env-chip">{ENV_LABEL[r.environment]}</span>
						<span class="run-meta">{r.by} · {r.when}</span>
					</div>
					<ProgressBar counts={r.counts} />
					<div class="run-counts">
						<span class="rc"><span class="res-dot rd-pass"></span> {r.counts.pass} pass</span>
						<span class="rc"><span class="res-dot rd-fail"></span> {r.counts.fail} fail</span>
						{#if r.counts.blocked}<span class="rc"><span class="res-dot rd-blocked"></span> {r.counts.blocked} blocked</span>{/if}
						{#if r.counts.skipped}<span class="rc"><span class="res-dot rd-skipped"></span> {r.counts.skipped} skipped</span>{/if}
						<span class="passrate" style="color:{rateColor(r.passRate)}">{r.passRate === null ? '—' : `${r.passRate}%`}</span>
					</div>
				</div>
			{/each}
		{:else}
			<div class="empty">
				<div class="empty-in">
					<div class="ei"><Icon name="play" /></div>
					<h3>No runs yet</h3>
					<p>Launch a suite to record a run — automated runners execute, manual cases become a checklist, all under one pass rate.</p>
					<button class="btn btn-primary" style="margin-top:14px" onclick={() => openLaunch(null)}><Icon name="play" /> Launch run</button>
				</div>
			</div>
		{/if}
	</div>
</div>
