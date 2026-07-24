<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { TEST_KINDS, type TestRunner } from '$lib/types';
	import { TEST_KIND_META } from '$lib/checkpoint/meta';
	import { isActive } from '$lib/checkpoint/catalogFilters';
	import { toast } from '$lib/stores/toasts.svelte';
	import { runnerTone } from '$lib/checkpoint/tone';
	import Icon from '$lib/components/Icon.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import RunnerFormModal from '$lib/components/checkpoint/RunnerFormModal.svelte';

	let { data } = $props();
	let showForm = $state(false);
	let formRunner = $state<TestRunner | null>(null);

	const filterActive = $derived(isActive(data.filter));

	/** Filters live in the URL so a narrowed grid is shareable and Back undoes it. */
	function setParam(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`/runners?${params}`, { keepFocus: true, noScroll: true, replaceState: true });
	}

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
		<span class="count">
			{data.runners.length === data.total ? `${data.total} runners` : `${data.runners.length} of ${data.total} runners`}
		</span>
		<div class="toolbar-spacer"></div>
		<button class="btn btn-primary" onclick={newRunner}><Icon name="plus" /> New runner</button>
	</div>

	<div class="filter-bar">
		<div class="fb-search">
			<Icon name="search" />
			<input
				class="inp inp-sm"
				placeholder="Name, id or command…"
				value={data.filter.q}
				oninput={(e) => setParam('q', e.currentTarget.value)}
			/>
		</div>
		<select class="sel sel-sm" value={data.filter.kind} onchange={(e) => setParam('kind', e.currentTarget.value)}>
			<option value="">Any type</option>
			{#each TEST_KINDS as k (k)}
				{#if data.kindCounts[k]}<option value={k}>{TEST_KIND_META[k].label} ({data.kindCounts[k]})</option>{/if}
			{/each}
		</select>
		<select class="sel sel-sm" value={data.filter.lang} onchange={(e) => setParam('lang', e.currentTarget.value)}>
			<option value="">Any language</option>
			{#each Object.entries(data.langCounts).sort() as [lang, n] (lang)}<option value={lang}>{lang} ({n})</option>{/each}
		</select>
		<select class="sel sel-sm" value={data.filter.health} onchange={(e) => setParam('health', e.currentTarget.value)}>
			<option value="">Any health</option>
			<option value="healthy">Healthy</option>
			<option value="flaky">Flaky</option>
			<option value="failing">Failing</option>
			<option value="unknown">Never run</option>
		</select>
		<select class="sel sel-sm" value={data.filter.enabled} onchange={(e) => setParam('enabled', e.currentTarget.value)}>
			<option value="">Enabled &amp; disabled</option>
			<option value="on">Enabled only</option>
			<option value="off">Disabled only ({data.disabledTotal})</option>
		</select>
		<div class="fb-spacer"></div>
		{#if filterActive}
			<a class="btn btn-ghost btn-sm" href="/runners"><Icon name="x" /> Reset</a>
		{/if}
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
					{#if filterActive}
						<h3>No runners match this filter</h3>
						<p>{data.total} runner{data.total === 1 ? '' : 's'} defined — clear the filter to see them.</p>
						<a class="btn btn-primary" style="margin-top:14px" href="/runners"><Icon name="x" /> Reset filter</a>
					{:else}
						<h3>No runners yet</h3>
						<p>A runner is the single place that knows how a class of test is invoked and how its report is read. Define one to start recording automated results.</p>
						<button class="btn btn-primary" style="margin-top:14px" onclick={newRunner}><Icon name="plus" /> New runner</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showForm}
	<RunnerFormModal editRunner={formRunner} onClose={() => (showForm = false)} />
{/if}
