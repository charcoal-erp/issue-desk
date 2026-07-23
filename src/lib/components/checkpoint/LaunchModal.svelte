<script lang="ts">
	import { goto } from '$app/navigation';
	import type { ReportFormat, SuiteEnvironment, TestKind } from '$lib/types';
	import { SUITE_ENVIRONMENTS } from '$lib/types';
	import { ENV_LABEL, TEST_KIND_META } from '$lib/checkpoint/meta';
	import { cpUi, closeLaunch } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '../Icon.svelte';
	import KindBadge from './KindBadge.svelte';
	import SuiteTags from './SuiteTags.svelte';

	interface GroupRef {
		runnerId: string;
		name: string;
		kind: TestKind;
		command: string;
		workingDir: string;
		reportFormat: ReportFormat;
		reportPath: string;
		count: number;
	}
	interface SuiteRef {
		id: string;
		appName: string;
		name: string;
		description?: string;
		tags: string[];
		defaultEnv: SuiteEnvironment;
		caseCount: number;
		kinds: TestKind[];
		kindCounts: Record<string, number>;
		/** One entry per runner this suite will invoke — resolved server-side. */
		groups: GroupRef[];
		unrunnable: { kind: TestKind; count: number }[];
		manualCount: number;
	}
	// Runner details reach the modal through each suite's server-resolved
	// groups, so the modal needs no separate runner catalogue.
	let { suites }: { suites: SuiteRef[] } = $props();

	let suiteId = $state('');
	let environment = $state<SuiteEnvironment>('local');
	let selectedKinds = $state<TestKind[]>([]);
	let starting = $state(false);

	// Preselect when the modal opens.
	$effect(() => {
		if (cpUi.launch) suiteId = cpUi.launch.suiteId ?? suites[0]?.id ?? '';
	});
	const suite = $derived(suites.find((s) => s.id === suiteId));
	// Reset env + participating kinds whenever the suite changes.
	$effect(() => {
		if (suite) {
			environment = suite.defaultEnv;
			selectedKinds = [...suite.kinds];
		}
	});

	function toggleKind(k: TestKind) {
		selectedKinds = selectedKinds.includes(k) ? selectedKinds.filter((x) => x !== k) : [...selectedKinds, k];
	}

	/** The runners that will actually be invoked, filtered by the ticked kinds. */
	const activeGroups = $derived(
		(suite?.groups ?? []).filter((g) => selectedKinds.includes(g.kind))
	);

	const plan = $derived.by(() => {
		if (!suite) return [];
		const lines: string[] = [];
		for (const g of activeGroups) {
			const cd = g.workingDir && g.workingDir !== '.' ? `cd ${g.workingDir} && ` : '';
			lines.push(`$ ${cd}${g.command.replace(/\$ENV\b/g, environment)}`);
			lines.push(`  → parse ${g.reportPath || 'stdout'} (${g.reportFormat}) → ${g.count} case(s)`);
		}
		for (const u of suite.unrunnable) {
			if (selectedKinds.includes(u.kind)) {
				lines.push(`# ${u.kind}: no runner configured → ${u.count} case(s) skipped`);
			}
		}
		if (suite.manualCount && selectedKinds.includes('manual')) {
			lines.push(`# ${suite.manualCount} manual case(s) → checklist for the tester`);
		}
		if (activeGroups.length > 1) {
			lines.push(`# ${activeGroups.length} runners execute in order, one at a time`);
		}
		return lines;
	});

	async function start() {
		if (!suite) return;
		starting = true;
		try {
			const res = await fetch('/qa/runs/launch', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ suiteId, environment, kinds: selectedKinds })
			});
			if (!res.ok) {
				// SvelteKit's error() replies with JSON; fall back to raw text.
				const body = await res.text();
				let message = body;
				try {
					message = JSON.parse(body).message ?? body;
				} catch {
					/* not JSON — use the text */
				}
				toast(res.status === 409 ? 'Another run is in flight' : 'Launch failed', message);
				return;
			}
			const { runId, running } = await res.json();
			closeLaunch();
			await goto(`/qa/runs/${runId}`);
			if (running) toast('Run started', 'Runners are executing — results appear as they land');
		} catch (e) {
			toast('Launch failed', (e as Error).message);
		} finally {
			starting = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && cpUi.launch) closeLaunch();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if cpUi.launch}
	<div class="cp-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) closeLaunch(); }}>
		<div class="cp-modal wide" role="dialog" aria-modal="true">
			<div class="modal-head">
				<div class="mh-icon"><Icon name="play" /></div>
				<div>
					<h2>Launch a run</h2>
					<div class="mh-sub">Pick a suite, an environment, and which runners take part</div>
				</div>
				<button class="x" onclick={closeLaunch} aria-label="Close"><Icon name="x" /></button>
			</div>

			<div class="modal-body">
				{#if !suites.length}
					<p style="color:var(--muted)">No suites yet — create a suite first, then launch it.</p>
				{:else}
					<div class="grid2">
						<div class="field">
							<label for="lm-suite">Suite</label>
							<select id="lm-suite" class="sel" bind:value={suiteId}>
								{#each suites as s (s.id)}<option value={s.id}>{s.appName} · {s.name} — {s.caseCount} cases</option>{/each}
							</select>
						</div>
						<div class="field">
							<label for="lm-env">Environment</label>
							<select id="lm-env" class="sel" bind:value={environment}>
								{#each SUITE_ENVIRONMENTS as e (e)}<option value={e}>{ENV_LABEL[e]}</option>{/each}
							</select>
						</div>
					</div>

					{#if suite}
						{#if suite.tags.length}
							<div class="field">
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label>
									Before you start
									{#if suite.tags.some((t) => t.startsWith('destructive:'))}
										<span class="hint" style="color:#a52019">· this suite destroys data</span>
									{/if}
								</label>
								<SuiteTags tags={suite.tags} />
								{#if suite.description}<div class="lm-desc">{suite.description}</div>{/if}
							</div>
						{/if}

						<div class="field">
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label>Runners in this launch <span class="hint">· untick to skip a kind of test</span></label>
							{#each suite.groups as g (g.runnerId)}
								{@const on = selectedKinds.includes(g.kind)}
								<button type="button" class="health-row" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2)" onclick={() => toggleKind(g.kind)}>
									<span class="box chk-box {on ? 'on' : ''}" style="width:16px;height:16px;border-radius:5px;border:1.5px solid {on ? 'var(--ws)' : '#CBD3DE'};background:{on ? 'var(--ws)' : '#fff'};display:grid;place-items:center;flex:0 0 16px">
										{#if on}<Icon name="check-sm" class="chk-tick" />{/if}
									</span>
									<div class="hr-b">
										<div class="hr-n"><KindBadge kind={g.kind} small /> {g.name}</div>
										<div class="hr-m">{g.command}</div>
									</div>
									<div class="hr-s"><b>{g.count}</b>case{g.count === 1 ? '' : 's'}</div>
								</button>
							{/each}
							{#each suite.unrunnable as u (u.kind)}
								{@const on = selectedKinds.includes(u.kind)}
								<button type="button" class="health-row" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2)" onclick={() => toggleKind(u.kind)}>
									<span class="box chk-box" style="width:16px;height:16px;border-radius:5px;border:1.5px solid {on ? 'var(--ws)' : '#CBD3DE'};background:{on ? 'var(--ws)' : '#fff'};display:grid;place-items:center;flex:0 0 16px">
										{#if on}<Icon name="check-sm" class="chk-tick" />{/if}
									</span>
									<div class="hr-b">
										<div class="hr-n"><KindBadge kind={u.kind} small /> No runner configured</div>
										<div class="hr-m">these cases will be recorded as skipped</div>
									</div>
									<div class="hr-s"><b>{u.count}</b>case{u.count === 1 ? '' : 's'}</div>
								</button>
							{/each}
							{#if suite.manualCount}
								{@const on = selectedKinds.includes('manual')}
								<button type="button" class="health-row" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2)" onclick={() => toggleKind('manual')}>
									<span class="box chk-box {on ? 'on' : ''}" style="width:16px;height:16px;border-radius:5px;border:1.5px solid {on ? 'var(--ws)' : '#CBD3DE'};background:{on ? 'var(--ws)' : '#fff'};display:grid;place-items:center;flex:0 0 16px">
										{#if on}<Icon name="check-sm" class="chk-tick" />{/if}
									</span>
									<div class="hr-b">
										<div class="hr-n"><KindBadge kind="manual" small /> Manual execution</div>
										<div class="hr-m">a person marks each case in the run</div>
									</div>
									<div class="hr-s"><b>{suite.manualCount}</b>case{suite.manualCount === 1 ? '' : 's'}</div>
								</button>
							{/if}
						</div>

						<div class="field">
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label>What will happen</label>
							<div class="exp-code">
								<div class="exp-code-bar"><span class="ec-t">execution plan</span></div>
								<pre>{plan.join('\n') || '# nothing selected'}</pre>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<div class="modal-foot">
				<div class="ff">Automated runners execute their command; manual cases become a checklist in the same run.</div>
				<button class="btn btn-ghost" onclick={closeLaunch}>Cancel</button>
				<button class="btn btn-primary" onclick={start} disabled={starting || !suite || !selectedKinds.length}>
					<Icon name="play" /> Start run
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.lm-desc {
		margin-top: 7px;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--muted);
	}
	.health-row :global(.chk-tick) {
		width: 11px;
		height: 11px;
		color: #fff;
	}
</style>
