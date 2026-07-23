<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { Application, SuiteEnvironment, TestKind, TestSuite } from '$lib/types';
	import { SUITE_ENVIRONMENTS } from '$lib/types';
	import { ENV_LABEL, TEST_KIND_META } from '$lib/checkpoint/meta';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '../Icon.svelte';
	import KindBadge from './KindBadge.svelte';

	interface CaseRef {
		id: string;
		appId: string;
		appCode: string;
		title: string;
		kind: TestKind;
		runnerId: string | null;
	}
	interface Editor {
		suite: {
			id: string;
			name: string;
			description: string;
			appId: string;
			defaultEnv: SuiteEnvironment;
			tags: string[];
			caseIds: string[];
		} | null;
		allCases: CaseRef[];
		runners: Array<{ id: string; name: string; kind: TestKind; command: string; enabled: boolean }>;
		nextId: string | null;
	}

	let {
		applications,
		editor,
		onCancel,
		onSaved
	}: {
		applications: Application[];
		editor: Editor;
		onCancel: () => void;
		onSaved: (suite: TestSuite, launch: boolean) => void;
	} = $props();

	const s = untrack(() => editor.suite);
	let name = $state(s?.name ?? '');
	let description = $state(s?.description ?? '');
	let appId = $state(s?.appId ?? untrack(() => applications[0]?.id) ?? '');
	let defaultEnv = $state<SuiteEnvironment>(s?.defaultEnv ?? 'local');
	let tags = $state(s?.tags.join(', ') ?? '');
	let caseIds = $state<string[]>(s ? [...s.caseIds] : []);
	let libApp = $state('all');
	let libType = $state<'all' | TestKind>('all');
	let wantLaunch = $state(false);
	let saving = $state(false);

	const caseById = $derived(new Map(editor.allCases.map((c) => [c.id, c])));
	const membership = $derived(caseIds.map((id) => caseById.get(id)).filter(Boolean) as CaseRef[]);
	const library = $derived(
		editor.allCases.filter(
			(c) =>
				!caseIds.includes(c.id) &&
				(libApp === 'all' || c.appId === libApp) &&
				(libType === 'all' || c.kind === libType)
		)
	);
	// Mirrors resolveRunner() in src/lib/server/checkpoint/launch.ts — a case's
	// own runner when it is enabled and of the right kind, else the first
	// enabled runner of that kind. Membership changes live here, so the grouping
	// has to be derived client-side.
	function runnerFor(c: CaseRef) {
		if (c.runnerId) {
			const own = editor.runners.find((r) => r.id === c.runnerId);
			if (own?.enabled && own.kind === c.kind) return own;
		}
		return editor.runners.find((r) => r.kind === c.kind && r.enabled) ?? null;
	}

	/** One row per runner this suite will invoke — several per kind is normal. */
	const invokes = $derived.by(() => {
		const rows = new Map<string, { key: string; kind: TestKind; count: number; runner: { id: string; name: string; command: string } | null }>();
		for (const c of membership) {
			const runner = c.kind === 'manual' ? null : runnerFor(c);
			const key = runner ? runner.id : `none:${c.kind}`;
			const row = rows.get(key);
			if (row) row.count += 1;
			else rows.set(key, { key, kind: c.kind, count: 1, runner });
		}
		return [...rows.values()];
	});
	const appLetters = $derived([...new Set(editor.allCases.map((c) => c.appCode))]);

	function add(id: string) {
		caseIds = [...caseIds, id];
	}
	function remove(id: string) {
		caseIds = caseIds.filter((x) => x !== id);
	}
	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= caseIds.length) return;
		const next = [...caseIds];
		[next[i], next[j]] = [next[j], next[i]];
		caseIds = next;
	}
</script>

<div class="editor">
	<div class="ed-grid">
		<div class="card" style="padding:16px">
			<div class="sec-title">Suite details</div>
			<div class="field">
				<label for="se-name">Name</label>
				<input id="se-name" class="inp" name="name" bind:value={name} placeholder="Billing release" form="suite-form" />
			</div>
			<div class="field">
				<label for="se-desc">Description</label>
				<textarea id="se-desc" class="inp" name="description" bind:value={description} placeholder="What this suite guarantees" form="suite-form"></textarea>
			</div>
			<div class="grid2">
				<div class="field">
					<label for="se-app">Application</label>
					<select id="se-app" class="sel" name="appId" bind:value={appId} form="suite-form">
						{#each applications as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="se-env">Default environment</label>
					<select id="se-env" class="sel" name="defaultEnv" bind:value={defaultEnv} form="suite-form">
						{#each SUITE_ENVIRONMENTS as e (e)}<option value={e}>{ENV_LABEL[e]}</option>{/each}
					</select>
				</div>
			</div>
			<div class="field">
				<label for="se-tags">Tags <span class="hint">· comma-separated</span></label>
				<input id="se-tags" class="inp" name="tags" bind:value={tags} placeholder="release, billing" form="suite-form" />
			</div>
		</div>

		<div class="card" style="padding:16px">
			<div class="sec-title">Runners this suite will invoke</div>
			{#if invokes.length}
				<div class="panel-bd tight" style="padding:0">
					{#each invokes as row (row.key)}
						<div class="health-row">
							<span class="hdot {row.runner || row.kind === 'manual' ? 'h-ok' : 'h-idle'}"></span>
							<div class="hr-b">
								<div class="hr-n"><KindBadge kind={row.kind} small /> {row.runner?.name ?? (row.kind === 'manual' ? 'Manual execution' : 'No runner defined')}</div>
								<div class="hr-m">{row.kind === 'manual' ? 'a person marks each case in the run' : (row.runner?.command ?? '—')}</div>
							</div>
							<div class="hr-s"><b>{row.count}</b>case{row.count === 1 ? '' : 's'}</div>
						</div>
					{/each}
				</div>
			{:else}
				<p style="color:var(--muted);font-size:12.5px">Add cases to see which runners this suite will invoke.</p>
			{/if}
		</div>
	</div>

	<div class="ed-grid">
		<!-- Library -->
		<div class="picker">
			<div class="picker-hd">Case library <span class="pk-n">{library.length} available</span></div>
			<div class="pk-filter">
				<button class="pk-chip" class:on={libApp === 'all'} onclick={() => (libApp = 'all')}>All apps</button>
				{#each appLetters as code (code)}
					{@const appId2 = editor.allCases.find((c) => c.appCode === code)?.appId ?? ''}
					<button class="pk-chip" class:on={libApp === appId2} onclick={() => (libApp = appId2)}>{code}</button>
				{/each}
			</div>
			<div class="pk-filter">
				<button class="pk-chip" class:on={libType === 'all'} onclick={() => (libType = 'all')}>All types</button>
				{#each Object.keys(TEST_KIND_META) as k (k)}
					<button class="pk-chip" class:on={libType === k} onclick={() => (libType = k as TestKind)}>{TEST_KIND_META[k as TestKind].label}</button>
				{/each}
			</div>
			<div class="picker-body">
				{#each library as c (c.id)}
					<div class="pk-row">
						<span class="pk-id">{c.id}</span>
						<span class="pk-t">{c.title}</span>
						<KindBadge kind={c.kind} small />
						<button class="mini-btn" onclick={() => add(c.id)} aria-label="Add"><Icon name="plus" /></button>
					</div>
				{:else}
					<div class="pk-row" style="color:var(--faint);justify-content:center">No more cases match this filter.</div>
				{/each}
			</div>
		</div>

		<!-- In this suite -->
		<div class="picker">
			<div class="picker-hd">In this suite <span class="pk-n">{membership.length} selected · runs in order</span></div>
			<div class="picker-body">
				{#each membership as c, i (c.id)}
					<div class="pk-row">
						<span class="pk-ord">{i + 1}</span>
						<span class="pk-id">{c.id}</span>
						<span class="pk-t">{c.title}</span>
						<KindBadge kind={c.kind} small />
						<button class="mini-btn" disabled={i === 0} onclick={() => move(i, -1)} aria-label="Up"><Icon name="arrow-up" /></button>
						<button class="mini-btn" disabled={i === membership.length - 1} onclick={() => move(i, 1)} aria-label="Down"><Icon name="arrow-down" /></button>
						<button class="mini-btn danger" onclick={() => remove(c.id)} aria-label="Remove"><Icon name="x" /></button>
					</div>
				{:else}
					<div class="pk-row" style="color:var(--faint);justify-content:center">Empty — add cases from the library on the left.</div>
				{/each}
			</div>
		</div>
	</div>

	<form
		id="suite-form"
		method="POST"
		action="/qa/suites?/upsertSuite"
		use:enhance={() => {
			saving = true;
			return async ({ result }) => {
				saving = false;
				if (result.type === 'success') {
					const suite = result.data?.suite as TestSuite;
					toast(editor.suite ? `Saved ${suite.id}` : `Created ${suite.id}`);
					await invalidateAll();
					onSaved(suite, wantLaunch);
				} else if (result.type === 'failure') {
					const fe = (result.data as { fieldErrors?: Record<string, string> })?.fieldErrors;
					toast('Could not save', fe?.form ?? fe?.name ?? 'Check the form');
				}
			};
		}}
	>
		{#if editor.suite}<input type="hidden" name="id" value={editor.suite.id} />{/if}
		<input type="hidden" name="caseIds" value={JSON.stringify(caseIds)} />

		<div class="launch-panel" style="margin-top:4px">
			<div>
				<div class="lp-t">{editor.suite ? 'Ready to launch' : 'Save, then launch'}</div>
				<div class="lp-d">{membership.length} case{membership.length === 1 ? '' : 's'} across {invokes.length} runner{invokes.length === 1 ? '' : 's'} · default env {ENV_LABEL[defaultEnv]}</div>
			</div>
			<div class="lp-sp"></div>
			<button type="button" class="btn btn-ghost btn-sm" onclick={onCancel}>Cancel</button>
			<button type="submit" class="btn btn-primary btn-sm" disabled={saving} onclick={() => (wantLaunch = false)}>
				<Icon name="check" /> Save suite
			</button>
			<button type="submit" class="btn btn-dark btn-sm" disabled={saving || !membership.length} onclick={() => (wantLaunch = true)}>
				<Icon name="play" /> Save &amp; launch
			</button>
		</div>
	</form>
</div>
