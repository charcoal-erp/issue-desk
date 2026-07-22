<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { MatchStrategy, ReportFormat, RunnerLanguage, TestKind, TestRunner } from '$lib/types';
	import { REPORT_FORMATS, RUNNER_LANGUAGES, TEST_KINDS } from '$lib/types';
	import { REPORT_FORMAT_LABEL, TEST_KIND_META } from '$lib/checkpoint/meta';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '../Icon.svelte';

	let { editRunner = null, onClose }: { editRunner?: TestRunner | null; onClose: () => void } = $props();

	const MATCH_BY: MatchStrategy['by'][] = ['nodeid', 'annotation', 'testName', 'snapshotName', 'tapName', 'explicitMap'];
	const seed = untrack(() => editRunner);

	let name = $state(seed?.name ?? '');
	let kind = $state<TestKind>(seed?.kind ?? 'api');
	let language = $state<RunnerLanguage>(seed?.language ?? 'python');
	let command = $state(seed?.command ?? '');
	let workingDir = $state(seed?.workingDir ?? '');
	let reportFormat = $state<ReportFormat>(seed?.reportFormat ?? 'junit-xml');
	let reportPath = $state(seed?.reportPath ?? '');
	let matchBy = $state<MatchStrategy['by']>(seed?.matchStrategy.by ?? 'nodeid');
	let matchTag = $state(seed && seed.matchStrategy.by === 'annotation' ? seed.matchStrategy.tag : '@checkpoint');
	let timeoutSec = $state(seed?.timeoutSec ? String(seed.timeoutSec) : '');
	let envText = $state(seed?.env ? Object.entries(seed.env).map(([k, v]) => `${k}=${v}`).join('\n') : '');
	let enabled = $state(seed?.enabled ?? true);
	let saving = $state(false);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="cp-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
	<div class="cp-modal wide" role="dialog" aria-modal="true">
		<div class="modal-head">
			<div class="mh-icon"><Icon name="terminal" /></div>
			<div>
				<h2>{editRunner ? 'Edit runner' : 'New runner'}</h2>
				<div class="mh-sub">Define a command, working dir, report format and how results map back</div>
			</div>
			<button class="x" onclick={onClose} aria-label="Close"><Icon name="x" /></button>
		</div>

		<form
			method="POST"
			action="/qa/runners?/upsertRunner"
			use:enhance={() => {
				saving = true;
				return async ({ result }) => {
					saving = false;
					if (result.type === 'success') {
						toast(editRunner ? 'Runner saved' : 'Runner created');
						await invalidateAll();
						onClose();
					} else if (result.type === 'failure') {
						const fe = (result.data as { fieldErrors?: Record<string, string> })?.fieldErrors;
						toast('Could not save runner', fe?.form ?? fe?.name ?? 'Check the form');
					}
				};
			}}
		>
			{#if editRunner}<input type="hidden" name="id" value={editRunner.id} />{/if}
			<input type="hidden" name="matchBy" value={matchBy} />
			<input type="hidden" name="enabled" value={enabled ? 'true' : 'false'} />

			<div class="modal-body">
				<div class="field">
					<label for="rf-name">Name</label>
					<input id="rf-name" class="inp" name="name" bind:value={name} placeholder="API contract (pytest)" />
				</div>
				<div class="grid2">
					<div class="field">
						<label for="rf-kind">Kind</label>
						<select id="rf-kind" class="sel" name="kind" bind:value={kind}>
							{#each TEST_KINDS as k (k)}<option value={k}>{TEST_KIND_META[k].label}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label for="rf-lang">Language</label>
						<select id="rf-lang" class="sel" name="language" bind:value={language}>
							{#each RUNNER_LANGUAGES as l (l)}<option value={l}>{l}</option>{/each}
						</select>
					</div>
				</div>
				<div class="field">
					<label for="rf-cmd">Command</label>
					<input id="rf-cmd" class="inp" style="font-family:var(--font-mono)" name="command" bind:value={command} placeholder="pytest tests/api -q --junitxml=reports/api-junit.xml" />
				</div>
				<div class="grid2">
					<div class="field">
						<label for="rf-dir">Working dir</label>
						<input id="rf-dir" class="inp" style="font-family:var(--font-mono)" name="workingDir" bind:value={workingDir} placeholder="services/api" />
					</div>
					<div class="field">
						<label for="rf-timeout">Timeout (sec) <span class="hint">· optional</span></label>
						<input id="rf-timeout" class="inp" name="timeoutSec" bind:value={timeoutSec} placeholder="120" inputmode="numeric" />
					</div>
				</div>
				<div class="grid2">
					<div class="field">
						<label for="rf-fmt">Report format</label>
						<select id="rf-fmt" class="sel" name="reportFormat" bind:value={reportFormat}>
							{#each REPORT_FORMATS as f (f)}<option value={f}>{REPORT_FORMAT_LABEL[f]}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label for="rf-path">Report path</label>
						<input id="rf-path" class="inp" style="font-family:var(--font-mono)" name="reportPath" bind:value={reportPath} placeholder="reports/api-junit.xml or stdout" />
					</div>
				</div>
				<div class="grid2">
					<div class="field">
						<label for="rf-match">Case matched by</label>
						<select id="rf-match" class="sel" bind:value={matchBy}>
							{#each MATCH_BY as m (m)}<option value={m}>{m}</option>{/each}
						</select>
					</div>
					{#if matchBy === 'annotation'}
						<div class="field">
							<label for="rf-tag">Annotation tag</label>
							<input id="rf-tag" class="inp" style="font-family:var(--font-mono)" name="matchTag" bind:value={matchTag} placeholder="@checkpoint" />
						</div>
					{/if}
				</div>
				<div class="field">
					<label for="rf-env">Environment substitutions <span class="hint">· KEY=VALUE per line, optional</span></label>
					<textarea id="rf-env" class="inp" name="env" bind:value={envText} placeholder="BASE_URL=http://localhost:3000"></textarea>
				</div>
				<button type="button" class="chk" style="width:auto;display:inline-flex" onclick={() => (enabled = !enabled)}>
					<span class="box {enabled ? 'on' : ''}" style="background:{enabled ? 'var(--ws)' : '#fff'};border-color:{enabled ? 'var(--ws)' : '#CBD3DE'}">{#if enabled}<Icon name="check-sm" />{/if}</span>
					<span class="cl">Enabled — participates in runs</span>
				</button>
			</div>

			<div class="modal-foot">
				<div class="ff">Runners are numbered globally — e.g. RNR-1.</div>
				<button type="button" class="btn btn-ghost" onclick={onClose}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={saving}><Icon name="check" /> {editRunner ? 'Save changes' : 'Create runner'}</button>
			</div>
		</form>
	</div>
</div>

<style>
	.chk .box :global(svg) {
		width: 11px;
		height: 11px;
		color: #fff;
	}
</style>
