<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { TestRunner } from '$lib/types';
	import { toast } from '$lib/stores/toasts.svelte';
	import { runnerTone } from '$lib/checkpoint/tone';
	import Icon from '$lib/components/Icon.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import RunnerFormModal from '$lib/components/checkpoint/RunnerFormModal.svelte';

	let { data } = $props();
	let showForm = $state(false);
	let formRunner = $state<TestRunner | null>(null);

	function newRunner() {
		formRunner = null;
		showForm = true;
	}
	function editRunner(r: TestRunner) {
		formRunner = r;
		showForm = true;
	}
</script>

<div class="table-area">
	<div class="toolbar">
		<h1>Runners</h1>
		<span style="font-size:12.5px;color:var(--muted)">how each kind of test executes &amp; reports</span>
		<div class="toolbar-spacer"></div>
		<button class="btn btn-primary" onclick={newRunner}><Icon name="plus" /> New runner</button>
	</div>

	<div class="scroll">
		{#if data.runners.length}
			<div class="runner-grid">
				{#each data.runners as r (r.id)}
					<div class="runner-card tone-card" data-tone={runnerTone(r.kind)} class:off={!r.enabled}>
						<div class="runner-hd">
							<KindBadge kind={r.kind} small />
							<div class="rn-title">
								<span class="rn-n">{r.name}</span>
								<span class="rn-id">{r.id} · {r.language}</span>
							</div>
							<span style="margin-left:auto"></span>
							{#if !r.enabled}<span class="rn-off">disabled</span>{/if}
							<span class="hdot h-{r.health}" title="Health: {r.health}"></span>
						</div>
						<div class="cmd-box">
							<code class="cmd-text" title={r.command || undefined}><span class="pfx">$ </span>{r.command || '(performed by a person)'}</code>
							{#if r.command}<CopyButton text={r.command} variant="dark" title="Copy the command" />{/if}
						</div>
						<div class="runner-meta">
							<div><div class="rm-k">Working dir</div><div class="rm-v">{r.workingDir || '—'}</div></div>
							<div><div class="rm-k">Report format</div><div class="rm-v">{r.reportFormat}</div></div>
							<div><div class="rm-k">Report path</div><div class="rm-v">{r.reportPath || '—'}</div></div>
							<div><div class="rm-k">Case matched by</div><div class="rm-v">{r.matchLabel}</div></div>
						</div>
						<div class="runner-foot">
							<span class="rf-stat">avg <b>{r.avgLabel}</b></span>
							<span class="rf-stat" class:flaky={r.flakeRatePct >= 5}>flake <b>{r.flakeRatePct}%</b></span>
							<span class="rf-stat">last {r.lastLabel}</span>
							<span style="flex:1"></span>
							{#if r.kind !== 'manual'}
								<button class="btn btn-ghost btn-xs" onclick={() => toast('Run now', 'Ad-hoc single-runner runs land with CI wiring')}><Icon name="play" /> Run now</button>
							{/if}
							<button class="btn btn-ghost btn-xs" onclick={() => editRunner(r)}><Icon name="edit" /> Edit</button>
							<form method="POST" action="?/toggleRunner" use:enhance={() => async ({ result }) => { if (result.type === 'success') await invalidateAll(); }}>
								<input type="hidden" name="id" value={r.id} />
								<input type="hidden" name="enabled" value={r.enabled ? 'false' : 'true'} />
								<button class="btn btn-ghost btn-xs">{r.enabled ? 'Disable' : 'Enable'}</button>
							</form>
							<form method="POST" action="?/deleteRunner" use:enhance={() => async ({ result }) => { if (result.type === 'success') { toast('Runner deleted'); await invalidateAll(); } }}>
								<input type="hidden" name="id" value={r.id} />
								<button class="btn btn-ghost btn-xs" aria-label="Delete runner"><Icon name="trash" /></button>
							</form>
						</div>
					</div>
				{/each}
			</div>

			<div class="sec-title" style="margin-top:26px">Report normalization</div>
			<div class="card" style="padding:16px 18px;font-size:13px;color:var(--ink-2);line-height:1.65;max-width:900px">
				Each runner declares a <b>report format</b> and <b>report path</b>. An adapter parses every
				format into one normalized shape —
				<span class="tag" style="font-family:var(--font-mono)">{'{ caseId, status, durationMs, message, stack, artifacts[] }'}</span>
				— matched back to a case by its <b>test identifier</b>. That is why a single run can span
				pytest, Playwright and a shell script and still yield one pass rate and one failure export.
			</div>
		{:else}
			<div class="empty">
				<div class="empty-in">
					<div class="ei"><Icon name="terminal" /></div>
					<h3>No runners yet</h3>
					<p>A runner is the single place that knows how a class of test is invoked and how its report is read. Define one to start recording automated results.</p>
					<button class="btn btn-primary" style="margin-top:14px" onclick={newRunner}><Icon name="plus" /> New runner</button>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showForm}
	<RunnerFormModal editRunner={formRunner} onClose={() => (showForm = false)} />
{/if}
