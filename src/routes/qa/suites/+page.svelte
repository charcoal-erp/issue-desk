<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import type { TestSuite } from '$lib/types';
	import { ENV_LABEL, rateColor } from '$lib/checkpoint/meta';
	import { isActive } from '$lib/checkpoint/catalogFilters';
	import { openFailures, openLaunch } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import SuiteTags from '$lib/components/checkpoint/SuiteTags.svelte';
	import SuiteEditor from '$lib/components/checkpoint/SuiteEditor.svelte';

	let { data } = $props();

	const KIND_OPTIONS = [
		{ value: 'unit', label: 'Unit' },
		{ value: 'api', label: 'API' },
		{ value: 'e2e', label: 'E2E' },
		{ value: 'visual', label: 'Visual' },
		{ value: 'shell', label: 'Shell' },
		{ value: 'manual', label: 'Manual' },
		{ value: 'seed', label: 'Seeding' }
	];

	const filterActive = $derived(isActive(data.filter));

	/** Filters live in the URL so a narrowed grid is shareable and Back undoes it. */
	function setParam(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		params.delete('edit');
		params.delete('new');
		goto(`/qa/suites?${params}`, { keepFocus: true, noScroll: true, replaceState: true });
	}

	function onSaved(suite: TestSuite, launch: boolean) {
		goto('/qa/suites').then(() => {
			if (launch) openLaunch(suite.id);
		});
	}
</script>

{#if data.editor}
	<div class="table-area">
		<div class="toolbar">
			<h1>{data.editor.suite ? 'Edit suite' : 'New suite'}</h1>
			<div class="toolbar-spacer"></div>
			<a class="btn btn-ghost" href="/qa/suites"><Icon name="arrow-right" class="flip" /> All suites</a>
		</div>
		<SuiteEditor
			applications={data.applications}
			editor={data.editor}
			onCancel={() => goto('/qa/suites')}
			{onSaved}
		/>
	</div>
{:else}
	<div class="table-area">
		<div class="toolbar">
			<h1>Test Suites</h1>
			<span class="count">
				{data.cards.length === data.total ? `${data.total} suites` : `${data.cards.length} of ${data.total} suites`}
			</span>
			<div class="toolbar-spacer"></div>
			<a class="btn btn-primary" href="/qa/suites?new=1"><Icon name="plus" /> New suite</a>
		</div>

		<div class="filter-bar">
			<div class="fb-search">
				<Icon name="search" />
				<input
					class="inp inp-sm"
					placeholder="Name, id or tag…"
					value={data.filter.q}
					oninput={(e) => setParam('q', e.currentTarget.value)}
				/>
			</div>
			<select class="sel sel-sm" value={data.filter.kind} onchange={(e) => setParam('kind', e.currentTarget.value)}>
				<option value="">Any type</option>
				{#each KIND_OPTIONS as k (k.value)}
					{#if data.kindCounts[k.value]}<option value={k.value}>{k.label} ({data.kindCounts[k.value]})</option>{/if}
				{/each}
			</select>
			<select class="sel sel-sm" value={data.filter.env} onchange={(e) => setParam('env', e.currentTarget.value)}>
				<option value="">Any environment</option>
				{#each data.envs as e (e)}<option value={e}>{ENV_LABEL[e]}</option>{/each}
			</select>
			<select class="sel sel-sm" value={data.filter.state} onchange={(e) => setParam('state', e.currentTarget.value)}>
				<option value="">Any last run</option>
				<option value="failing">Failing or blocked ({data.failingTotal})</option>
				<option value="passing">Last run clean</option>
				<option value="never">Never run</option>
			</select>
			<div class="fb-spacer"></div>
			{#if filterActive}
				<a class="btn btn-ghost btn-sm" href="/qa/suites"><Icon name="x" /> Reset</a>
			{/if}
		</div>

		<div class="scroll">
			{#if data.cards.length}
				<div class="suite-grid">
					{#each data.cards as s (s.id)}
						<div class="suite-card tone-card" data-tone={s.tone}>
							<a class="suite-hd" href="/qa/suites?edit={s.id}" title={s.description || s.name}>
								<div class="sh-top">
									<span class="suite-id">{s.id}</span>
									<span class="suite-app">{s.appName}</span>
									<span class="env-chip" style="margin-left:auto">{ENV_LABEL[s.defaultEnv]}</span>
								</div>
								<div class="suite-name">{s.name}</div>
								{#if s.tags.length}<div class="suite-tagrow"><SuiteTags tags={s.tags} compact max={2} /></div>{/if}
							</a>
							<div class="suite-bd">
								<div class="suite-kinds">
									{#each s.kinds as k (k)}<KindBadge kind={k} small />{/each}
									{#if !s.kinds.length}<span style="color:var(--faint);font-size:12px">no cases yet</span>{/if}
								</div>
								<div class="suite-nums">
									<div class="sn"><span class="v">{s.total}</span><span class="k">cases</span></div>
									<div class="sn"><span class="v" style="color:var(--k-manual)">{s.manual}</span><span class="k">manual</span></div>
									<div class="sn"><span class="v" style="color:var(--k-e2e)">{s.automated}</span><span class="k">automated</span></div>
									<div style="margin-left:auto;text-align:right">
										<div class="v" style="font-family:var(--font-display);font-weight:600;font-size:17px;color:{rateColor(s.lastPassRate)}">
											{s.lastPassRate === null ? '—' : `${s.lastPassRate}%`}
										</div>
										<span class="k" style="font-size:10px;color:var(--muted)">last run</span>
									</div>
								</div>

								<!-- The last run's actual numbers. A percentage tells you how it went;
								     "3 failed" tells you what to do about it. -->
								{#if s.lastRun}
									<a class="lastrun" href="/qa/runs/{s.lastRun.runId}" title="Open {s.lastRun.runId}">
										<span class="lr-pill lr-pass" class:zero={!s.lastRun.pass}>{s.lastRun.pass} passed</span>
										<span class="lr-pill lr-fail" class:zero={!s.lastRun.fail}>{s.lastRun.fail} failed</span>
										{#if s.lastRun.blocked}<span class="lr-pill lr-blocked">{s.lastRun.blocked} blocked</span>{/if}
										{#if s.lastRun.skipped}<span class="lr-pill lr-skipped">{s.lastRun.skipped} skipped</span>{/if}
										<span class="lr-when">{s.lastRun.when} ago</span>
									</a>
								{:else}
									<div class="lastrun empty-run">Never run</div>
								{/if}
							</div>
							<div class="suite-foot">
								<button class="btn btn-primary btn-sm" onclick={() => openLaunch(s.id)}><Icon name="play" /> Launch</button>
								{#if s.lastRun && s.lastRun.fail + s.lastRun.blocked > 0}
									<!-- The whole point of seeing a failure count here: turn it into a
									     prompt without hunting for the run first. Counts blocked as well
									     as failed, because the export does — a button that promises
									     three and hands over four is one you stop trusting. -->
									<button
										class="btn btn-danger btn-sm"
										title="Build a Claude Code prompt from this suite's {s.lastRun.fail} failing and {s.lastRun.blocked} blocked case{s.lastRun.fail + s.lastRun.blocked === 1 ? '' : 's'} — with the runner output"
										onclick={() => openFailures({ kind: 'suite', suiteId: s.id, suiteName: s.name })}
									>
										<Icon name="code" /> Fix {s.lastRun.fail + s.lastRun.blocked}
									</button>
								{/if}
								<!-- Launch and Fix keep their labels; the rest are icons with
								     tooltips, or the row wraps and strands the delete button on a
								     line of its own. Edit is the whole card header as well. -->
								<a class="btn btn-ghost btn-sm" href="/qa/runs?suite={s.id}" aria-label="Run history" title="This suite's run history — archive or clean up its runs">
									<Icon name="play" />{#if s.runCount}<span class="foot-n">{s.runCount}{#if s.archivedRuns}·{s.archivedRuns}★{/if}</span>{/if}
								</a>
								<a class="btn btn-ghost btn-sm" href="/qa/suites?edit={s.id}" aria-label="Edit suite" title="Edit suite"><Icon name="edit" /></a>
								<form method="POST" action="?/duplicateSuite" use:enhance={() => async ({ result }) => { if (result.type === 'success') { toast('Suite duplicated'); await invalidateAll(); } }}>
									<button class="btn btn-ghost btn-sm" aria-label="Duplicate suite" title="Duplicate suite"><Icon name="copy" /></button>
									<input type="hidden" name="id" value={s.id} />
								</form>
								<!-- Deliberately not pushed to the right edge with margin-left:auto.
								     On the narrowest card the row is ~18px over and wraps, and an
								     auto margin turns that into a delete button stranded alone on a
								     second line. Packed left, a wrapped row reads as a continuation —
								     and it stays that way however wide the run count grows. -->
								<form method="POST" action="?/deleteSuite" use:enhance={() => async ({ result }) => { if (result.type === 'success') { toast('Suite deleted'); await invalidateAll(); } }}>
									<input type="hidden" name="id" value={s.id} />
									<button class="btn btn-ghost btn-sm" aria-label="Delete suite" title="Delete suite"><Icon name="trash" /></button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty">
					<div class="empty-in">
						<div class="ei"><Icon name="layers" /></div>
						{#if filterActive}
							<h3>No suites match this filter</h3>
							<p>{data.total} suite{data.total === 1 ? '' : 's'} in the catalogue — clear the filter to see them.</p>
							<a class="btn btn-primary" style="margin-top:14px" href="/qa/suites"><Icon name="x" /> Reset filter</a>
						{:else}
							<h3>No suites yet</h3>
							<p>Group cases into a suite to run them together — mix API, e2e, visual and manual under one pass rate.</p>
							<a class="btn btn-primary" style="margin-top:14px" href="/qa/suites?new=1"><Icon name="plus" /> New suite</a>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(.btn .flip) {
		transform: rotate(180deg);
	}
	.foot-n {
		margin-left: 5px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--faint);
	}
</style>
