<script lang="ts">
	import type { TestCase } from '$lib/types';
	import { CASE_STATUS_META, REPORT_FORMAT_LABEL, RESULT_META, formatDuration, matchStrategyLabel } from '$lib/checkpoint/meta';
	import { openFailures } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '../Icon.svelte';
	import KindBadge from './KindBadge.svelte';
	import ResultDot from './ResultDot.svelte';
	import PipMeter from './PipMeter.svelte';

	interface Drawer {
		case: TestCase;
		last: {
			status: import('$lib/types').ResultStatus;
			message: string | null;
			stack: string | null;
			artifacts: string[];
			durationMs: number | null;
			runId: string;
		} | null;
		runner: {
			name: string;
			language: string;
			command: string;
			workingDir: string;
			reportFormat: import('$lib/types').ReportFormat;
			matchStrategy: import('$lib/types').MatchStrategy;
		} | null;
		parentTitle: string | null;
		suites: Array<{ id: string; name: string }>;
		filedIssues: string[];
	}

	let { drawer, onClose, onEdit }: { drawer: Drawer; onClose: () => void; onEdit: (c: TestCase) => void } =
		$props();

	const c = $derived(drawer.case);
	const failing = $derived(drawer.last?.status === 'fail' || drawer.last?.status === 'blocked');

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="cp-drawer-backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div class="cp-drawer" role="dialog" aria-modal="true">
		<div class="dr-hd">
			<div class="dr-top">
				<span class="dr-tag">{c.id}</span>
				<span class="cs-badge {CASE_STATUS_META[c.status].cls}">{CASE_STATUS_META[c.status].label}</span>
				<KindBadge kind={c.kind} />
				<button class="x" onclick={onClose} aria-label="Close"><Icon name="x" /></button>
			</div>
			<h2>{c.title}</h2>
		</div>

		<div class="dr-body">
			{#if c.parentIssueId}
				<div class="xlink-note">
					<Icon name="link" />
					<div>
						Parent issue <a class="parent-chip" href="/desk/issues/{c.parentIssueId}" style="margin:0 3px">{c.parentIssueId}</a>
						{drawer.parentTitle ? `— ${drawer.parentTitle}. ` : '. '}This test exists to verify that issue; it is tracked in IssueDesk.
					</div>
				</div>
			{/if}

			<div class="dr-meta">
				<div class="row"><div class="rk">Application</div><div class="rv">{c.appName}</div></div>
				<div class="row">
					<div class="rk">Target</div>
					<div class="rv">
						<span class="tag">{c.target.moduleName}</span>
						{#if c.target.pageName}<span class="tag">{c.target.pageName}</span>{/if}
						{#if c.target.formName}<span class="tag">{c.target.formName}</span>{/if}
					</div>
				</div>
				<div class="row"><div class="rk">Priority</div><div class="rv"><PipMeter priority={c.priority} /></div></div>
				<div class="row">
					<div class="rk">Last result</div>
					<div class="rv">
						<ResultDot status={drawer.last?.status ?? 'none'} />
						{drawer.last ? RESULT_META[drawer.last.status].label : 'Not run'}
						{#if drawer.last?.durationMs != null}<span style="color:var(--muted)">· {formatDuration(drawer.last.durationMs)}</span>{/if}
					</div>
				</div>
				<div class="row">
					<div class="rk">In suites</div>
					<div class="rv">
						{#if drawer.suites.length}
							{#each drawer.suites as s (s.id)}<span class="tag">{s.name}</span>{/each}
						{:else}<span style="color:var(--faint)">none</span>{/if}
					</div>
				</div>
				{#if drawer.filedIssues.length}
					<div class="row">
						<div class="rk">Filed bugs</div>
						<div class="rv">
							{#each drawer.filedIssues as id (id)}<a class="issue-chip" href="/desk/issues/{id}">{id}</a>{/each}
						</div>
					</div>
				{/if}
			</div>

			{#if failing && drawer.last}
				<div class="dr-sec-t">Last failure</div>
				<div class="err-box" style="margin:0 0 12px">{drawer.last.stack || drawer.last.message || 'No output captured.'}</div>
				{#if drawer.last.artifacts.length}
					<div class="tagrow" style="margin-bottom:20px">
						{#each drawer.last.artifacts as a (a)}<span class="artifact"><Icon name="paperclip" /> {a}</span>{/each}
					</div>
				{/if}
			{/if}

			<div class="dr-sec-t">Execution</div>
			{#if drawer.runner && c.kind !== 'manual'}
				<div class="dr-meta">
					<div class="row"><div class="rk">Runner</div><div class="rv">{drawer.runner.name} <span style="color:var(--muted)">({drawer.runner.language})</span></div></div>
					<div class="row"><div class="rk">Command</div><div class="rv" style="font-family:var(--font-mono);font-size:11.5px">{drawer.runner.command}</div></div>
					{#if c.specPath}<div class="row"><div class="rk">Spec file</div><div class="rv" style="font-family:var(--font-mono);font-size:11.5px">{c.specPath}</div></div>{/if}
					{#if c.externalTestId}<div class="row"><div class="rk">Test id</div><div class="rv" style="font-family:var(--font-mono);font-size:11.5px">{c.externalTestId}</div></div>{/if}
					<div class="row"><div class="rk">Reports as</div><div class="rv"><span class="tag">{REPORT_FORMAT_LABEL[drawer.runner.reportFormat]}</span> → matched by {matchStrategyLabel(drawer.runner.matchStrategy)}</div></div>
				</div>
			{:else}
				<div class="manual-note">Manual case — a person executes the steps in a run and marks the result. No command, no report file.</div>
			{/if}

			{#if c.preconditions}
				<div class="dr-sec-t">Preconditions</div>
				<div class="pre-box">{c.preconditions}</div>
			{/if}

			{#if c.steps.length}
				<div class="dr-sec-t">Steps</div>
				<table class="steps-tbl">
					<thead><tr><th class="stepn">#</th><th>Action</th><th>Expected</th></tr></thead>
					<tbody>
						{#each c.steps as s, i (i)}
							<tr><td class="stepn">{i + 1}</td><td>{s.action}</td><td class="exp">{s.expected}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		<div class="dr-foot">
			<button class="btn btn-ghost" onclick={() => onEdit(c)}><Icon name="edit" /> Edit</button>
			{#if c.kind !== 'manual'}
				<button class="btn btn-ghost" onclick={() => toast('Single-test run queued', 'Runs execute from the Runs screen')}><Icon name="play" /> Run this test</button>
			{/if}
			{#if failing}
				<button class="btn btn-danger" style="margin-left:auto" onclick={() => openFailures({ kind: 'case', caseId: c.id })}><Icon name="markdown" /> Failure → Markdown</button>
			{/if}
		</div>
	</div>
</div>
