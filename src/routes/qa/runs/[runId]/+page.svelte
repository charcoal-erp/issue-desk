<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { ResultStatus } from '$lib/types';
	import { ENV_LABEL, RESULT_META, formatDuration, rateColor } from '$lib/checkpoint/meta';
	import { openFailures } from '$lib/stores/checkpoint-ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import ProgressBar from '$lib/components/checkpoint/ProgressBar.svelte';

	let { data } = $props();
	const run = $derived(data.run);
	const TOGGLE: ResultStatus[] = ['pass', 'fail', 'blocked', 'skipped'];

	async function mark(caseId: string, status: ResultStatus) {
		const body = new FormData();
		body.set('caseId', caseId);
		body.set('status', status);
		await fetch(`/qa/runs/${run.id}?/recordResult`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body
		});
		await invalidateAll();
	}
	const isFail = (s: ResultStatus) => s === 'fail' || s === 'blocked';
</script>

<div class="table-area">
	<div class="toolbar">
		<h1>{run.id}</h1>
		<div class="toolbar-spacer"></div>
		{#if data.failingCount}
			<button class="btn btn-danger" onclick={() => openFailures({ kind: 'run', runId: run.id })}><Icon name="markdown" /> Failures → Markdown</button>
		{/if}
		<a class="btn btn-ghost" href="/qa/runs">All runs</a>
	</div>

	<div class="scroll">
		<div class="card" style="padding:15px 17px;margin-bottom:14px">
			<div class="run-top">
				<span class="run-id">{run.id}</span>
				<span class="run-suite">{run.suiteName}</span>
				<span class="env-chip">{ENV_LABEL[run.environment]}</span>
				<span class="run-meta">{run.by} · {run.when}{run.completed ? '' : ' · in progress'}</span>
			</div>
			<ProgressBar counts={run.counts} />
			<div class="run-counts">
				<span class="rc"><span class="res-dot rd-pass"></span> {run.counts.pass} pass</span>
				<span class="rc"><span class="res-dot rd-fail"></span> {run.counts.fail} fail</span>
				{#if run.counts.blocked}<span class="rc"><span class="res-dot rd-blocked"></span> {run.counts.blocked} blocked</span>{/if}
				{#if run.counts.skipped}<span class="rc"><span class="res-dot rd-skipped"></span> {run.counts.skipped} skipped</span>{/if}
				<span class="passrate" style="color:{rateColor(run.passRate)}">{run.passRate === null ? '—' : `${run.passRate}% pass`}</span>
			</div>
		</div>

		{#if data.failingCount}
			<div class="launch-panel" style="margin-bottom:14px">
				<div>
					<div class="lp-t">{data.failingCount} failure{data.failingCount === 1 ? '' : 's'} in this run</div>
					<div class="lp-d">Export them as one Markdown prompt — spec paths, commands, expected vs actual.</div>
				</div>
				<div class="lp-sp"></div>
				<button class="btn btn-primary btn-sm" onclick={() => openFailures({ kind: 'run', runId: run.id })}><Icon name="code" /> Failures → Claude Code</button>
			</div>
		{/if}

		<!-- Automated runner groups -->
		{#each data.groups as g (g.runnerId)}
			<div class="rgroup">
				<div class="rg-hd">
					<KindBadge kind={g.kind} small />
					<span class="rg-n">{g.name}</span>
					<span style="font-size:12px;color:var(--muted)">{g.pass}/{g.fail + g.pass} pass</span>
					{#if g.reportFormat}<span class="rg-fmt">{g.reportFormat}</span>{/if}
				</div>
				<div class="rg-cmd"><span style="color:var(--term-muted)">$ </span>{g.command}</div>
				{#each g.rows as row (row.testCaseId)}
					<div class="exec-row">
						{#if row.status === 'pass'}<Icon name="check" class="tick-ok" />{:else if isFail(row.status)}<Icon name="x" class="tick-fail" />{:else}<span class="res-dot {RESULT_META[row.status].cls}"></span>{/if}
						<div class="xr-b">
							<div class="xr-t">{row.title}</div>
							<div class="xr-m">{row.testCaseId} · {row.specPath ?? 'no spec'}</div>
						</div>
						<span class="xr-dur">{formatDuration(row.durationMs)}</span>
						{#if isFail(row.status)}<button class="btn btn-danger btn-xs" onclick={() => openFailures({ kind: 'case', caseId: row.testCaseId })}>Markdown</button>{/if}
					</div>
					{#if isFail(row.status) && (row.stack || row.message)}
						<div class="err-box">{row.stack || row.message}</div>
						{#if row.artifacts.length}<div class="tagrow" style="margin:0 15px 11px">{#each row.artifacts as a (a)}<span class="artifact"><Icon name="paperclip" /> {a}</span>{/each}</div>{/if}
					{/if}
				{/each}
			</div>
		{/each}

		<!-- Manual / unrun group -->
		{#if data.manualRows.length}
			<div class="rgroup">
				<div class="rg-hd">
					<KindBadge kind="manual" small />
					<span class="rg-n">Manual execution</span>
					<span style="font-size:12px;color:var(--muted)">mark each case</span>
				</div>
				{#each data.manualRows as row (row.testCaseId)}
					<div class="exec-row">
						{#if row.pending}<span class="res-dot rd-none"></span>{:else if row.status === 'pass'}<Icon name="check" class="tick-ok" />{:else if isFail(row.status)}<Icon name="x" class="tick-fail" />{:else}<span class="res-dot {RESULT_META[row.status].cls}"></span>{/if}
						<div class="xr-b">
							<div class="xr-t">{row.title}</div>
							<div class="xr-m">{row.testCaseId} · manual execution</div>
						</div>
						<div class="res-toggle">
							{#each TOGGLE as s (s)}
								<button class:on-pass={!row.pending && row.status === s && s === 'pass'} class:on-fail={!row.pending && row.status === s && s === 'fail'} class:on-blocked={!row.pending && row.status === s && s === 'blocked'} class:on-skipped={!row.pending && row.status === s && s === 'skipped'} onclick={() => mark(row.testCaseId, s)}>{s}</button>
							{/each}
						</div>
						{#if isFail(row.status)}<button class="btn btn-danger btn-xs" onclick={() => openFailures({ kind: 'case', caseId: row.testCaseId })}>Markdown</button>{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if !data.groups.length && !data.manualRows.length}
			<div class="empty"><div class="empty-in"><div class="ei"><Icon name="play" /></div><h3>No results recorded</h3><p>This run has no participating cases.</p></div></div>
		{/if}
	</div>
</div>
