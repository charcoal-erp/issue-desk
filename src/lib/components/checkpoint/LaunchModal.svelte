<script lang="ts">
	import { goto } from '$app/navigation';
	import type { ReportFormat, SuiteEnvironment, TestKind } from '$lib/types';
	import { SUITE_ENVIRONMENTS } from '$lib/types';
	import { ENV_LABEL, TEST_KIND_META } from '$lib/checkpoint/meta';
	import { cpUi, closeLaunch } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '../Icon.svelte';
	import KindBadge from './KindBadge.svelte';

	interface SuiteRef {
		id: string;
		appName: string;
		name: string;
		defaultEnv: SuiteEnvironment;
		caseCount: number;
		kinds: TestKind[];
		kindCounts: Record<string, number>;
	}
	interface RunnerRef {
		id: string;
		name: string;
		kind: TestKind;
		command: string;
		workingDir: string;
		reportFormat: ReportFormat;
		reportPath: string;
		enabled: boolean;
	}

	let { suites, runners }: { suites: SuiteRef[]; runners: RunnerRef[] } = $props();

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

	function runnerFor(kind: TestKind): RunnerRef | undefined {
		return runners.find((r) => r.kind === kind && r.enabled);
	}
	function toggleKind(k: TestKind) {
		selectedKinds = selectedKinds.includes(k) ? selectedKinds.filter((x) => x !== k) : [...selectedKinds, k];
	}

	const plan = $derived.by(() => {
		if (!suite) return [];
		const lines: string[] = [];
		for (const kind of suite.kinds) {
			if (!selectedKinds.includes(kind)) continue;
			const n = suite.kindCounts[kind] ?? 0;
			if (kind === 'manual') {
				lines.push(`# ${n} manual case(s) → checklist for the runner`);
				continue;
			}
			const r = runnerFor(kind);
			if (!r) {
				lines.push(`# ${kind}: no runner configured → ${n} case(s) skipped`);
				continue;
			}
			const cd = r.workingDir && r.workingDir !== '.' ? `cd ${r.workingDir} && ` : '';
			lines.push(`$ ${cd}${r.command.replace(/\$ENV\b/g, environment)}`);
			lines.push(`  → parse ${r.reportPath} (${r.reportFormat}) → ${n} case(s)`);
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
			if (!res.ok) throw new Error(await res.text());
			const { runId } = await res.json();
			closeLaunch();
			await goto(`/qa/runs/${runId}`);
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
						<div class="field">
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label>Runners in this launch <span class="hint">· untick to skip a kind of test</span></label>
							{#each suite.kinds as kind (kind)}
								{@const r = runnerFor(kind)}
								<button type="button" class="health-row" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line-2)" onclick={() => toggleKind(kind)}>
									<span class="box chk-box {selectedKinds.includes(kind) ? 'on' : ''}" style="width:16px;height:16px;border-radius:5px;border:1.5px solid {selectedKinds.includes(kind) ? 'var(--ws)' : '#CBD3DE'};background:{selectedKinds.includes(kind) ? 'var(--ws)' : '#fff'};display:grid;place-items:center;flex:0 0 16px">
										{#if selectedKinds.includes(kind)}<Icon name="check-sm" class="chk-tick" />{/if}
									</span>
									<div class="hr-b">
										<div class="hr-n"><KindBadge {kind} small /> {kind === 'manual' ? 'Manual execution' : (r?.name ?? 'No runner configured')}</div>
										<div class="hr-m">{kind === 'manual' ? 'a person marks each case in the run' : (r?.command ?? '—')}</div>
									</div>
									<div class="hr-s"><b>{suite.kindCounts[kind] ?? 0}</b>case{(suite.kindCounts[kind] ?? 0) === 1 ? '' : 's'}</div>
								</button>
							{/each}
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
	.health-row :global(.chk-tick) {
		width: 11px;
		height: 11px;
		color: #fff;
	}
</style>
