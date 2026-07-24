<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { Application, Priority, TestCase, TestKind } from '$lib/types';
	import { TEST_KINDS } from '$lib/types';
	import { PRIORITY_META, PRIORITY_ORDER } from '$lib/priority';
	import { REPORT_FORMAT_LABEL, TEST_KIND_META, matchStrategyLabel } from '$lib/checkpoint/meta';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '../Icon.svelte';

	interface RunnerRef {
		id: string;
		name: string;
		kind: TestKind;
		command: string;
		workingDir: string;
		reportFormat: import('$lib/types').ReportFormat;
		reportPath: string;
		matchStrategy: import('$lib/types').MatchStrategy;
	}

	let {
		applications,
		runners,
		suites,
		issues,
		editCase = null,
		nextId,
		onClose
	}: {
		applications: Application[];
		runners: RunnerRef[];
		suites: Array<{ id: string; appId: string; name: string }>;
		issues: Array<{ id: string; title: string; appId: string }>;
		editCase?: TestCase | null;
		nextId: Record<string, string>;
		onClose: () => void;
	} = $props();

	const KIND_ICON: Record<TestKind, string> = {
		unit: 'flask',
		api: 'code',
		e2e: 'monitor',
		visual: 'eye',
		shell: 'terminal',
		manual: 'task'
	};

	// The form seeds once from the case; the modal is re-created per open.
	const seed = untrack(() => editCase);
	let appId = $state(seed?.appId ?? untrack(() => applications[0]?.id) ?? '');
	let moduleId = $state(seed?.target.moduleId ?? '');
	let pageName = $state(seed?.target.pageName ?? '');
	let formArea = $state(seed?.target.formName ?? '');
	let title = $state(seed?.title ?? '');
	let priority = $state<Priority>(seed?.priority ?? 'medium');
	let parentIssueId = $state(seed?.parentIssueId ?? '');
	let kind = $state<TestKind>(seed?.kind ?? 'manual');
	let runnerId = $state(seed?.runnerId ?? '');
	let specPath = $state(seed?.specPath ?? '');
	let externalTestId = $state(seed?.externalTestId ?? '');
	let preconditions = $state(seed?.preconditions ?? '');
	let steps = $state(
		seed?.steps.length ? seed.steps.map((s) => ({ ...s })) : [{ action: '', expected: '' }]
	);
	let suiteIds = $state<string[]>(seed ? [...seed.suiteIds] : []);
	let saving = $state(false);
	let errors = $state<Record<string, string>>({});

	const app = $derived(applications.find((a) => a.id === appId));
	const modules = $derived(app?.modules ?? []);
	const appIssues = $derived(issues.filter((i) => i.appId === appId));
	const appSuites = $derived(suites.filter((s) => s.appId === appId));
	const kindRunners = $derived(runners.filter((r) => r.kind === kind));
	const runner = $derived(runners.find((r) => r.id === runnerId));
	const isManual = $derived(kind === 'manual');

	$effect(() => {
		if (!modules.some((m) => m.id === moduleId)) moduleId = modules[0]?.id ?? '';
	});
	$effect(() => {
		if (!isManual && !kindRunners.some((r) => r.id === runnerId)) runnerId = kindRunners[0]?.id ?? '';
	});

	const cleanSteps = $derived(steps.filter((s) => s.action.trim() || s.expected.trim()));
	const runnerHint = $derived(
		runner
			? `Runs \`${runner.command}\` in \`${runner.workingDir || '.'}\`, reads \`${runner.reportPath}\` (${REPORT_FORMAT_LABEL[runner.reportFormat]}), matched by ${matchStrategyLabel(runner.matchStrategy)}.`
			: 'Select a runner to see what will run.'
	);

	function addStep() {
		steps = [...steps, { action: '', expected: '' }];
	}
	function removeStep(i: number) {
		steps = steps.filter((_, idx) => idx !== i);
		if (!steps.length) steps = [{ action: '', expected: '' }];
	}
	function toggleSuite(id: string) {
		suiteIds = suiteIds.includes(id) ? suiteIds.filter((x) => x !== id) : [...suiteIds, id];
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="cp-backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div class="cp-modal wide" role="dialog" aria-modal="true">
		<div class="modal-head">
			<div class="mh-icon"><Icon name="task" /></div>
			<div>
				<h2>{editCase ? 'Edit test case' : 'New test case'}</h2>
				<div class="mh-sub">
					{editCase
						? `${editCase.id} — ${editCase.appName}`
						: 'Define what is tested, how it runs, and the issue it belongs to'}
				</div>
			</div>
			<button class="x" onclick={onClose} aria-label="Close"><Icon name="x" /></button>
		</div>

		<form
			method="POST"
			action="/cases?/upsertCase"
			use:enhance={() => {
				saving = true;
				return async ({ result }) => {
					saving = false;
					if (result.type === 'success') {
						const saved = result.data?.case as TestCase | undefined;
						toast(editCase ? `Saved ${saved?.id ?? editCase.id}` : `Created ${saved?.id ?? 'case'}`);
						await invalidateAll();
						onClose();
					} else if (result.type === 'failure') {
						errors = (result.data?.fieldErrors as Record<string, string>) ?? {};
					}
				};
			}}
		>
			{#if editCase}<input type="hidden" name="id" value={editCase.id} />{/if}
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="status" value={editCase?.status ?? 'active'} />
			<input type="hidden" name="tags" value={editCase?.tags.join(',') ?? ''} />
			<input type="hidden" name="steps" value={JSON.stringify(cleanSteps)} />
			<input type="hidden" name="suiteIds" value={JSON.stringify(suiteIds)} />

			<div class="modal-body">
				<div class="field">
					<label for="cf-title">Title <span class="hint">· what must hold true</span></label>
					<input id="cf-title" class="inp" name="title" bind:value={title} placeholder="Tax computed on the discounted subtotal" />
					{#if errors.title}<div class="hint" style="color:var(--fail)">{errors.title}</div>{/if}
				</div>

				<div class="grid2">
					<div class="field">
						<label for="cf-app">Application</label>
						<select id="cf-app" class="sel" name="appId" bind:value={appId}>
							{#each applications as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label for="cf-prio">Priority</label>
						<select id="cf-prio" class="sel" name="priority" bind:value={priority}>
							{#each PRIORITY_ORDER as p (p)}<option value={p}>{PRIORITY_META[p].label}</option>{/each}
						</select>
					</div>
				</div>

				<div class="grid3">
					<div class="field">
						<label for="cf-mod">Module</label>
						<select id="cf-mod" class="sel" name="moduleId" bind:value={moduleId}>
							{#each modules as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
						</select>
						{#if errors.moduleId}<div class="hint" style="color:var(--fail)">{errors.moduleId}</div>{/if}
					</div>
					<div class="field">
						<label for="cf-page">Page</label>
						<input id="cf-page" class="inp" name="page" bind:value={pageName} placeholder="Invoice" />
					</div>
					<div class="field">
						<label for="cf-form">Form / area</label>
						<input id="cf-form" class="inp" name="form" bind:value={formArea} placeholder="Line items" />
					</div>
				</div>

				<div class="field">
					<label for="cf-parent">Parent issue <span class="hint">· the bug or request this test verifies — leave empty for general regression cases</span></label>
					<select id="cf-parent" class="sel" name="parentIssueId" bind:value={parentIssueId}>
						<option value="">— none —</option>
						{#each appIssues as i (i.id)}<option value={i.id}>{i.id} — {i.title}</option>{/each}
					</select>
				</div>

				<div class="field">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label>Test type</label>
					<div class="seg">
						{#each TEST_KINDS as kk (kk)}
							<button type="button" class:on={kind === kk} onclick={() => (kind = kk)}>
								<Icon name={KIND_ICON[kk]} /> {TEST_KIND_META[kk].label}
							</button>
						{/each}
					</div>
				</div>

				{#if isManual}
					<div class="manual-note">
						Manual case — it will appear as a checklist item in any run that includes it. A tester
						marks pass / fail / blocked and can file a bug straight from the failure.
					</div>
				{:else}
					<div class="auto-fields">
						<div class="field">
							<label for="cf-runner">Runner <span class="hint">· defines the command and how results are read back</span></label>
							<select id="cf-runner" class="sel" name="runnerId" bind:value={runnerId}>
								{#if !kindRunners.length}<option value="">No {TEST_KIND_META[kind].label} runner defined yet</option>{/if}
								{#each kindRunners as r (r.id)}<option value={r.id}>{r.name} — {REPORT_FORMAT_LABEL[r.reportFormat]}</option>{/each}
							</select>
						</div>
						<div class="grid2">
							<div class="field">
								<label for="cf-spec">Spec file</label>
								<input id="cf-spec" class="inp" style="font-family:var(--font-mono)" name="specPath" bind:value={specPath} placeholder="tests/api/billing/test_tax.py" />
							</div>
							<div class="field">
								<label for="cf-tid">Test identifier <span class="hint">· how the report names it</span></label>
								<input id="cf-tid" class="inp" style="font-family:var(--font-mono)" name="externalTestId" bind:value={externalTestId} placeholder="test_tax.py::test_discounted" />
							</div>
						</div>
						<div class="hint" style="line-height:1.5">{runnerHint}</div>
					</div>
				{/if}

				<div class="field">
					<label for="cf-pre">Preconditions</label>
					<textarea id="cf-pre" class="inp" name="preconditions" bind:value={preconditions} placeholder="An invoice exists with a discounted line item."></textarea>
				</div>

				<div class="field">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label>Steps <span class="hint">· action and the expected result</span></label>
					{#each steps as step, i (i)}
						<div class="step-edit">
							<span class="se-n">{i + 1}</span>
							<input class="inp" placeholder="Action" bind:value={step.action} />
							<input class="inp" placeholder="Expected result" bind:value={step.expected} />
							<button type="button" class="mini-btn danger" onclick={() => removeStep(i)} aria-label="Remove step"><Icon name="trash" /></button>
						</div>
					{/each}
					<button type="button" class="btn btn-ghost btn-sm" onclick={addStep}><Icon name="plus" /> Add step</button>
				</div>

				{#if appSuites.length}
					<div class="field">
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label>Add to suites</label>
						<div class="tagrow">
							{#each appSuites as s (s.id)}
								<button type="button" class="scope-chip" class:on={suiteIds.includes(s.id)} onclick={() => toggleSuite(s.id)}>
									{s.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if errors.form}<div class="hint" style="color:var(--fail)">{errors.form}</div>{/if}
			</div>

			<div class="modal-foot">
				<div class="ff">
					{#if !editCase}Numbering follows the app — e.g. the next {app?.name ?? ''} case is {nextId[appId] ?? '—'}.{/if}
				</div>
				<button type="button" class="btn btn-ghost" onclick={onClose}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={saving}>
					<Icon name="check" />
					{editCase ? 'Save changes' : 'Create case'}
				</button>
			</div>
		</form>
	</div>
</div>
