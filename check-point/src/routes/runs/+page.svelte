<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { ENV_LABEL, rateColor } from '$lib/checkpoint/meta';
	import { openFailures, openLaunch } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import ProgressBar from '$lib/components/checkpoint/ProgressBar.svelte';

	let { data } = $props();
	let cleaning = $state(false);

	/** Filters live in the URL, so any view — including one suite's history — is shareable. */
	function setParam(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`/runs?${params}`, { keepFocus: true, noScroll: true });
	}

	const suiteName = $derived(data.suites.find((s) => s.id === data.filter.suiteId)?.name ?? null);

	const CUTOFFS = [
		{ label: 'older than a day', hours: 24 },
		{ label: 'older than a week', hours: 24 * 7 },
		{ label: 'older than a month', hours: 24 * 30 },
		{ label: 'older than three months', hours: 24 * 90 }
	];
	let cutoffHours = $state(24 * 30);
	let cutoffDate = $state('');
	let scopeToSuite = $state(true);
</script>

<div class="table-area">
	<div class="toolbar">
		<h1>Test Runs</h1>
		<span class="count">{data.runs.length} run{data.runs.length === 1 ? '' : 's'}</span>
		<div class="toolbar-spacer"></div>
		<button class="btn btn-ghost" onclick={() => (cleaning = !cleaning)}>
			<Icon name="trash" /> Clean up
		</button>
		<button class="btn btn-primary" onclick={() => openLaunch(null)}><Icon name="play" /> Launch run</button>
	</div>

	<div class="run-filters">
		<div class="run-tabs">
			{#each data.tabs as t (t.key)}
				<button class="run-tab" class:on={data.filter.age === t.key} onclick={() => setParam('age', t.key === 'all' ? '' : t.key)}>
					{t.label}<span class="rt-n">{t.count}</span>
				</button>
			{/each}
		</div>
		<div class="rf-spacer"></div>
		<select class="sel sel-sm" value={data.filter.suiteId} onchange={(e) => setParam('suite', e.currentTarget.value)}>
			<option value="">All suites</option>
			{#each data.suites as s (s.id)}<option value={s.id}>{s.name} ({s.runs})</option>{/each}
		</select>
		<select class="sel sel-sm" value={data.filter.outcome} onchange={(e) => setParam('outcome', e.currentTarget.value)}>
			<option value="">Any outcome</option>
			<option value="failing">With failures</option>
			<option value="passing">No failures</option>
		</select>
	</div>

	{#if cleaning}
		<form
			class="cleanup-bar"
			method="POST"
			action="?/cleanup"
			use:enhance={() => async ({ result }) => {
				if (result.type === 'success') {
					const n = (result.data as { removed?: number })?.removed ?? 0;
					toast(n ? `Deleted ${n} run${n === 1 ? '' : 's'}` : 'Nothing to delete', 'Archived runs were kept');
					cleaning = false;
					await invalidateAll();
				} else if (result.type === 'failure') {
					toast('Could not clean up', String((result.data as { error?: string })?.error ?? ''));
				}
			}}
		>
			<div class="cb-head"><Icon name="trash" /> Delete runs</div>
			<select class="sel sel-sm" name="hours" bind:value={cutoffHours} disabled={!!cutoffDate}>
				{#each CUTOFFS as c (c.hours)}<option value={c.hours}>{c.label}</option>{/each}
			</select>
			<span class="cb-or">or before</span>
			<input class="inp inp-sm" type="date" name="date" bind:value={cutoffDate} />
			{#if data.filter.suiteId}
				<label class="cb-scope">
					<input type="checkbox" bind:checked={scopeToSuite} />
					only {suiteName}
				</label>
				{#if scopeToSuite}<input type="hidden" name="suite" value={data.filter.suiteId} />{/if}
			{/if}
			<div class="rf-spacer"></div>
			<span class="cb-note">Archived and in-flight runs are never deleted.</span>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => (cleaning = false)}>Cancel</button>
			<button class="btn btn-danger btn-sm"><Icon name="trash" /> Delete</button>
		</form>
	{/if}

	<div class="scroll">
		{#if data.runs.length}
			{#each data.runs as r (r.id)}
				<div class="run-card" class:archived={r.archived}>
					<button class="run-open" onclick={() => goto(`/runs/${r.id}`)} aria-label="Open {r.id}">
						<div class="run-top">
							<span class="run-id">{r.id}</span>
							<span class="run-suite">{r.suiteName}</span>
							{#each r.kinds as k (k)}<KindBadge kind={k} small />{/each}
							<span class="env-chip">{ENV_LABEL[r.environment]}</span>
							{#if r.archived}<span class="arch-chip"><Icon name="check" /> archived</span>{/if}
							{#if r.running}<span class="arch-chip live">running</span>{/if}
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
					</button>
					<div class="run-actions">
						{#if r.counts.fail + r.counts.blocked > 0}
							<!-- Blocked counts too, matching what the export actually contains. -->
							<button
								class="btn btn-danger btn-xs"
								title="Build a Claude Code prompt from this run's {r.counts.fail} failing and {r.counts.blocked} blocked case{r.counts.fail + r.counts.blocked === 1 ? '' : 's'} — with the runner output"
								onclick={() => openFailures({ kind: 'run', runId: r.id })}
							>
								<Icon name="code" /> Fix {r.counts.fail + r.counts.blocked}
							</button>
						{/if}
						<form method="POST" action="?/archiveRun" use:enhance={() => async ({ result }) => {
							if (result.type === 'success') { toast(r.archived ? 'Run un-archived' : 'Run archived', r.archived ? 'It can be cleaned up again' : 'Cleanups will keep it'); await invalidateAll(); }
						}}>
							<input type="hidden" name="id" value={r.id} />
							<input type="hidden" name="archived" value={r.archived ? 'false' : 'true'} />
							<button class="btn btn-ghost btn-xs" title={r.archived ? 'Allow cleanup to delete this run' : 'Keep this run through cleanups'}>
								<Icon name="check" /> {r.archived ? 'Un-archive' : 'Archive'}
							</button>
						</form>
						<form method="POST" action="?/deleteRun" use:enhance={() => async ({ result }) => {
							if (result.type === 'success') { toast('Run deleted'); await invalidateAll(); }
						}}>
							<input type="hidden" name="id" value={r.id} />
							<button class="btn btn-ghost btn-xs" aria-label="Delete {r.id}" title="Delete this run"><Icon name="trash" /></button>
						</form>
					</div>
				</div>
			{/each}
		{:else}
			<div class="empty">
				<div class="empty-in">
					<div class="ei"><Icon name="play" /></div>
					<h3>{data.filter.age !== 'all' || data.filter.suiteId || data.filter.outcome ? 'No runs match this filter' : 'No runs yet'}</h3>
					<p>
						{#if data.filter.age !== 'all' || data.filter.suiteId || data.filter.outcome}
							Clear the filters to see the whole history.
						{:else}
							Launch a suite to record a run — automated runners execute, manual cases become a checklist, all under one pass rate.
						{/if}
					</p>
					<button class="btn btn-primary" style="margin-top:14px" onclick={() => openLaunch(null)}><Icon name="play" /> Launch run</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.run-filters {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 0 22px 12px;
		flex-wrap: wrap;
	}
	.run-tabs {
		display: flex;
		gap: 3px;
	}
	.run-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 6px 11px;
		font-size: 13px;
		color: var(--muted);
		cursor: pointer;
	}
	.run-tab:hover {
		background: var(--accent-soft-2);
	}
	.run-tab.on {
		background: var(--surface);
		border-color: var(--line);
		color: var(--ink);
		font-weight: 600;
	}
	.rt-n {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--faint);
	}
	.rf-spacer {
		flex: 1;
	}
	/* .sel/.inp are full-width by default; in these bars they sit inline. */
	.run-filters .sel,
	.cleanup-bar .sel,
	.cleanup-bar .inp {
		width: auto;
		min-width: 160px;
	}
	.cleanup-bar .inp {
		min-width: 150px;
	}
	.cleanup-bar {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: 0 22px 12px;
		padding: 11px 14px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface-2);
		flex-wrap: wrap;
	}
	.cb-head {
		display: flex;
		align-items: center;
		gap: 7px;
		font-weight: 600;
		font-size: 13px;
	}
	.cb-or,
	.cb-note {
		font-size: 12px;
		color: var(--muted);
	}
	.cb-scope {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		color: var(--muted);
	}
	.run-card {
		position: relative;
	}
	.run-card.archived {
		border-left: 3px solid var(--ws);
	}
	.run-open {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.run-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		margin-top: 8px;
	}
	.arch-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10.5px;
		padding: 2px 7px;
		border-radius: 5px;
		background: var(--teal-soft, #e6f6f4);
		color: var(--ws, #0e7c6b);
	}
	.arch-chip.live {
		background: #fff5e5;
		color: #8a5a00;
	}
</style>
