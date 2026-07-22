<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import type { TestSuite } from '$lib/types';
	import { ENV_LABEL, rateColor } from '$lib/checkpoint/meta';
	import { openLaunch } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import SuiteEditor from '$lib/components/checkpoint/SuiteEditor.svelte';

	let { data } = $props();

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
			<span class="count">{data.cards.length} suite{data.cards.length === 1 ? '' : 's'}</span>
			<div class="toolbar-spacer"></div>
			<a class="btn btn-primary" href="/qa/suites?new=1"><Icon name="plus" /> New suite</a>
		</div>

		<div class="scroll">
			{#if data.cards.length}
				<div class="suite-grid">
					{#each data.cards as s (s.id)}
						<div class="suite-card">
							<a class="suite-hd" href="/qa/suites?edit={s.id}">
								<div class="sh-top">
									<span class="suite-id">{s.id}</span>
									<span class="tag">{s.appName}</span>
									<span class="env-chip" style="margin-left:auto">{ENV_LABEL[s.defaultEnv]}</span>
								</div>
								<div class="suite-name">{s.name}</div>
								{#if s.description}<div class="suite-desc">{s.description}</div>{/if}
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
							</div>
							<div class="suite-foot">
								<button class="btn btn-primary btn-sm" onclick={() => openLaunch(s.id)}><Icon name="play" /> Launch</button>
								<a class="btn btn-ghost btn-sm" href="/qa/suites?edit={s.id}"><Icon name="edit" /> Edit</a>
								<form method="POST" action="?/duplicateSuite" use:enhance={() => async ({ result }) => { if (result.type === 'success') { toast('Suite duplicated'); await invalidateAll(); } }}>
									<input type="hidden" name="id" value={s.id} />
									<button class="btn btn-ghost btn-sm"><Icon name="copy" /> Duplicate</button>
								</form>
								<form style="margin-left:auto" method="POST" action="?/deleteSuite" use:enhance={() => async ({ result }) => { if (result.type === 'success') { toast('Suite deleted'); await invalidateAll(); } }}>
									<input type="hidden" name="id" value={s.id} />
									<button class="btn btn-ghost btn-sm" aria-label="Delete suite"><Icon name="trash" /></button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty">
					<div class="empty-in">
						<div class="ei"><Icon name="layers" /></div>
						<h3>No suites yet</h3>
						<p>Group cases into a suite to run them together — mix API, e2e, visual and manual under one pass rate.</p>
						<a class="btn btn-primary" style="margin-top:14px" href="/qa/suites?new=1"><Icon name="plus" /> New suite</a>
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
</style>
