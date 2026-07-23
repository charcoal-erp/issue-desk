<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ResultStatus } from '$lib/types';
	import { ENV_LABEL, RESULT_META, formatDuration, rateColor } from '$lib/checkpoint/meta';
	import { openFailures } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import ProgressBar from '$lib/components/checkpoint/ProgressBar.svelte';

	let { data } = $props();
	const run = $derived(data.run);
	const TOGGLE: ResultStatus[] = ['pass', 'fail', 'blocked', 'skipped'];

	// Automated dispatch continues on the server after the launch returns, so a
	// running run refreshes itself; results appear per invocation as they land.
	$effect(() => {
		if (run.state !== 'running') return;
		const timer = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	let completing = $state(false);
	async function closeRun() {
		completing = true;
		try {
			const res = await fetch(`/qa/runs/${run.id}?/completeRun`, {
				method: 'POST',
				headers: { 'x-sveltekit-action': 'true' },
				body: new FormData()
			});
			const r = deserialize(await res.text());
			if (r.type === 'success') {
				await invalidateAll();
				toast('Run closed', 'Recorded as complete with the results it has');
			} else {
				toast('Could not close the run', 'Try again');
			}
		} finally {
			completing = false;
		}
	}

	async function post(action: string, caseId: string, extra: Record<string, string> = {}) {
		const body = new FormData();
		body.set('caseId', caseId);
		for (const [k, v] of Object.entries(extra)) body.set(k, v);
		const res = await fetch(`/qa/runs/${run.id}?/${action}`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body
		});
		return deserialize(await res.text());
	}
	async function mark(caseId: string, status: ResultStatus) {
		await post('recordResult', caseId, { status });
		await invalidateAll();
	}
	async function fileBug(caseId: string) {
		const r = await post('createBugFromResult', caseId);
		if (r.type === 'success') {
			toast(`Filed ${(r.data as { issueId?: string })?.issueId ?? 'bug'}`, 'Opened in IssueDesk');
			await invalidateAll();
		} else {
			toast('Could not file bug', 'Try again');
		}
	}
	const isFail = (s: ResultStatus) => s === 'fail' || s === 'blocked';
</script>

{#snippet rowActions(row: { status: ResultStatus; testCaseId: string; issueId: string | null })}
	{#if isFail(row.status)}
		{#if row.issueId}
			<a class="issue-chip" href="/desk/issues/{row.issueId}">{row.issueId}</a>
		{:else}
			<button class="btn btn-ghost btn-xs" onclick={() => fileBug(row.testCaseId)}><Icon name="bug" /> File bug</button>
		{/if}
		<button class="btn btn-danger btn-xs" onclick={() => openFailures({ kind: 'case', caseId: row.testCaseId })}>Markdown</button>
	{/if}
{/snippet}

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
				<span class="run-meta">
					{run.by} · {run.when}{run.state === 'running'
						? ' · running'
						: run.state === 'awaiting-manual'
							? ' · awaiting manual results'
							: run.state === 'interrupted'
								? ' · interrupted'
								: ''}
				</span>
				{#if run.state === 'running'}<span class="live-dot" title="Runners are executing"></span>{/if}
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

		{#if run.state === 'interrupted'}
			<div class="launch-panel" style="margin-bottom:14px">
				<div>
					<div class="lp-t">This run was interrupted</div>
					<div class="lp-d">
						The server restarted while runners were executing, so no dispatch is in flight. The
						results below are what completed; close the run to record it as history, or launch it again.
					</div>
				</div>
				<div class="lp-sp"></div>
				<button class="btn btn-primary btn-sm" onclick={closeRun} disabled={completing}>
					<Icon name="check" /> Close run
				</button>
			</div>
		{/if}

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
						{@render rowActions(row)}
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
						{@render rowActions(row)}
					</div>
				{/each}
			</div>
		{/if}

		{#if !data.groups.length && !data.manualRows.length}
			<div class="empty"><div class="empty-in"><div class="ei"><Icon name="play" /></div><h3>No results recorded</h3><p>This run has no participating cases.</p></div></div>
		{/if}
	</div>
</div>

<style>
	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ws, #0E9F9F);
		animation: cp-pulse 1.4s ease-in-out infinite;
		flex: 0 0 8px;
	}
	@keyframes cp-pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.live-dot {
			animation: none;
			opacity: 0.8;
		}
	}
</style>
