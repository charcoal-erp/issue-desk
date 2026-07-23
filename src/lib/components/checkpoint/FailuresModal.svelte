<script lang="ts">
	import { cpUi, closeFailures } from '$lib/stores/checkpoint-ui.svelte';
	import { toast } from '$lib/stores/toasts.svelte';
	import { writeClipboard } from '$lib/clipboard';
	import Icon from '../Icon.svelte';

	type ScopeKind = 'all' | 'run' | 'suite' | 'case' | 'filter';

	let scopeKind = $state<ScopeKind>('all');
	let runId = $state<string | null>(null);
	let suiteId = $state<string | null>(null);
	let suiteName = $state<string | null>(null);
	let caseId = $state<string | null>(null);
	let filterQuery = $state<string | null>(null);
	let format = $state<'md' | 'json'>('md');
	let content = $state('');
	let loading = $state(false);
	let copied = $state(false);

	// Adopt the incoming scope each time the modal opens.
	$effect(() => {
		const f = cpUi.failures;
		if (!f) return;
		scopeKind = f.kind;
		runId = f.kind === 'run' ? f.runId : null;
		suiteId = f.kind === 'suite' ? f.suiteId : null;
		suiteName = f.kind === 'suite' ? (f.suiteName ?? null) : null;
		caseId = f.kind === 'case' ? f.caseId : null;
		filterQuery = f.kind === 'filter' ? f.query : null;
	});

	// Refetch whenever the modal is open and scope / format changes.
	$effect(() => {
		if (cpUi.failures) load(scopeKind, format);
	});

	async function load(scope: ScopeKind, fmt: 'md' | 'json') {
		loading = true;
		copied = false;
		const p = new URLSearchParams({ scope, format: fmt });
		if (scope === 'run' && runId) p.set('runId', runId);
		if (scope === 'suite' && suiteId) p.set('suiteId', suiteId);
		if (scope === 'case' && caseId) p.set('caseId', caseId);
		if (scope === 'filter' && filterQuery) p.set('filter', filterQuery);
		try {
			const res = await fetch(`/qa/api/export/failures?${p}`);
			content = await res.text();
		} catch {
			content = '# Could not generate the export.';
		}
		loading = false;
	}

	async function copy() {
		if (await writeClipboard(content)) {
			copied = true;
			toast('Copied', 'Paste into Claude Code');
		} else {
			toast('Copy failed', 'Select the text and copy manually');
		}
	}

	const fileName = $derived(`test-failures.${format}`);
	const failureCount = $derived(
		format === 'json'
			? (() => {
					try {
						return JSON.parse(content).failures?.length ?? 0;
					} catch {
						return 0;
					}
				})()
			: (content.match(/^## \d+\. /gm)?.length ?? 0)
	);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && cpUi.failures) closeFailures();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if cpUi.failures}
	<div class="cp-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) closeFailures(); }}>
		<div class="cp-modal wide" role="dialog" aria-modal="true">
			<div class="modal-head">
				<div class="mh-icon" style="background:var(--fail-soft);color:#C0343A"><Icon name="code" /></div>
				<div>
					<h2>Test failures → Claude Code</h2>
					<div class="mh-sub">Every failure with its command, error, expected behaviour and runner output — as one prompt</div>
				</div>
				<button class="x" onclick={closeFailures} aria-label="Close"><Icon name="x" /></button>
			</div>

			<div class="modal-body">
				<div class="scope-row">
					<button class="scope-chip" class:on={scopeKind === 'all'} onclick={() => (scopeKind = 'all')}>All failing cases</button>
					{#if runId}<button class="scope-chip" class:on={scopeKind === 'run'} onclick={() => (scopeKind = 'run')}>This run</button>{/if}
					{#if suiteId}<button class="scope-chip" class:on={scopeKind === 'suite'} onclick={() => (scopeKind = 'suite')}>{suiteName ?? suiteId} — last run</button>{/if}
					{#if filterQuery !== null}<button class="scope-chip" class:on={scopeKind === 'filter'} onclick={() => (scopeKind = 'filter')}>Current case filter</button>{/if}
					{#if caseId}<button class="scope-chip" class:on={scopeKind === 'case'} onclick={() => (scopeKind = 'case')}>Single case {caseId}</button>{/if}
				</div>

				<div class="exp-toggle">
					<button class:on={format === 'md'} onclick={() => (format = 'md')}>Markdown prompt</button>
					<button class:on={format === 'json'} onclick={() => (format = 'json')}>JSON</button>
				</div>

				<div class="exp-code">
					<div class="exp-code-bar">
						<Icon name="file" /><span class="ec-t">{fileName}</span>
						<span class="ec-n">{loading ? 'generating…' : `${failureCount} failure${failureCount === 1 ? '' : 's'}`}</span>
					</div>
					<pre>{content}</pre>
				</div>
			</div>

			<div class="modal-foot">
				<div class="ff">Paste into Claude Code — it has the spec path, the reproduce command and the expected result for each failure, plus the console output of every runner that failed.</div>
				<button class="btn btn-ghost" onclick={closeFailures}>Close</button>
				<button class="btn btn-dark" onclick={copy}><Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy prompt'}</button>
			</div>
		</div>
	</div>
{/if}
