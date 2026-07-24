<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { ResultStatus, TestCase, TestCaseStatus, TestKind } from '$lib/types';
	import { TEST_CASE_STATUSES, TEST_KINDS } from '$lib/types';
	import { RESULT_META, TEST_KIND_META } from '$lib/checkpoint/meta';
	import { CASE_STATUS_META } from '$lib/checkpoint/meta';
	import { openFailures } from '$lib/stores/checkpoint-ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import PipMeter from '$lib/components/checkpoint/PipMeter.svelte';
	import ResultDot from '$lib/components/checkpoint/ResultDot.svelte';
	import CaseDrawer from '$lib/components/checkpoint/CaseDrawer.svelte';
	import CaseFormModal from '$lib/components/checkpoint/CaseFormModal.svelte';
	import CaseImportModal from '$lib/components/checkpoint/CaseImportModal.svelte';

	let { data } = $props();

	let showForm = $state(false);
	let formCase = $state<TestCase | null>(null);
	let showImport = $state(false);

	const RESULT_FILTERS: Array<{ key: ResultStatus | 'none'; label: string }> = [
		{ key: 'pass', label: 'Passing' },
		{ key: 'fail', label: 'Failing' },
		{ key: 'blocked', label: 'Blocked' },
		{ key: 'skipped', label: 'Skipped' },
		{ key: 'none', label: 'Not run' }
	];

	function params(): URLSearchParams {
		return new URLSearchParams(page.url.search);
	}
	function go(p: URLSearchParams) {
		goto(`/cases?${p}`, { keepFocus: true, noScroll: true });
	}
	function setApp(id: string) {
		const p = params();
		p.delete('case');
		if (data.filter.appId === id) p.delete('app');
		else p.set('app', id);
		go(p);
	}
	function toggleMulti(key: string, val: string) {
		const p = params();
		p.delete('case');
		const vals = p.getAll(key);
		p.delete(key);
		const next = vals.includes(val) ? vals.filter((v) => v !== val) : [...vals, val];
		for (const v of next) p.append(key, v);
		go(p);
	}
	function resetAll() {
		goto('/cases', { keepFocus: true, noScroll: true });
	}
	function openCase(id: string) {
		const p = params();
		p.set('case', id);
		goto(`/cases?${p}`, { noScroll: true });
	}
	function closeDrawer() {
		const p = params();
		p.delete('case');
		goto(`/cases?${p}`, { noScroll: true });
	}
	function newCase() {
		formCase = null;
		showForm = true;
	}
	function editCase(c: TestCase) {
		closeDrawer();
		formCase = c;
		showForm = true;
	}

	const kindActive = (k: TestKind) => data.filter.kind?.includes(k) ?? false;
	const statusActive = (s: TestCaseStatus) => data.filter.status?.includes(s) ?? false;
	const resultActive = (r: ResultStatus | 'none') => data.filter.lastResult?.includes(r) ?? false;
</script>

<section class="table-area" style="flex-direction:row;display:flex">
	<div class="filters">
		<div class="f-block">
			<div class="f-title">Application <button class="clear" onclick={resetAll}>Reset</button></div>
			{#each data.applications as a (a.id)}
				<button class="chk" class:on={data.filter.appId === a.id} onclick={() => setApp(a.id)}>
					<span class="box"><Icon name="check-sm" /></span>
					<span class="cl">{a.name}</span>
					<span class="cn">{data.counts.byApp[a.id] ?? 0}</span>
				</button>
			{/each}
		</div>
		<div class="f-block">
			<div class="f-title">Test type</div>
			{#each TEST_KINDS as k (k)}
				<button class="chk" class:on={kindActive(k)} onclick={() => toggleMulti('kind', k)}>
					<span class="box"><Icon name="check-sm" /></span>
					<span class="cl">{TEST_KIND_META[k].label}</span>
					<span class="cn">{data.counts.byKind[k] ?? 0}</span>
				</button>
			{/each}
		</div>
		<div class="f-block">
			<div class="f-title">Status</div>
			{#each TEST_CASE_STATUSES as s (s)}
				<button class="chk" class:on={statusActive(s)} onclick={() => toggleMulti('status', s)}>
					<span class="box"><Icon name="check-sm" /></span>
					<span class="cl">{CASE_STATUS_META[s].label}</span>
					<span class="cn">{data.counts.byStatus[s] ?? 0}</span>
				</button>
			{/each}
		</div>
		<div class="f-block">
			<div class="f-title">Last result</div>
			{#each RESULT_FILTERS as r (r.key)}
				<button class="chk" class:on={resultActive(r.key)} onclick={() => toggleMulti('result', r.key)}>
					<span class="box"><Icon name="check-sm" /></span>
					<span class="res-dot {r.key === 'none' ? 'rd-none' : RESULT_META[r.key].cls}" style="margin-right:2px"></span>
					<span class="cl">{r.label}</span>
					<span class="cn">{data.counts.byResult[r.key] ?? 0}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="table-area">
		<div class="toolbar">
			<h1>Test Cases</h1>
			<span class="count">{data.total} of {data.counts.byApp ? Object.values(data.counts.byApp).reduce((a, b) => a + b, 0) : data.total} cases</span>
			<div class="toolbar-spacer"></div>
			<button class="btn btn-ghost" onclick={() => openFailures({ kind: 'filter', query: page.url.search.slice(1) })}>
				<Icon name="markdown" /> Failures → Markdown
			</button>
			<button class="btn btn-ghost" onclick={() => (showImport = true)}>
				<Icon name="upload" /> Import
			</button>
			<button class="btn btn-primary" onclick={newCase}><Icon name="plus" /> New case</button>
		</div>

		<div class="scroll">
			{#if data.rows.length}
				<table class="tbl">
					<thead>
						<tr>
							<th>ID</th><th>Title</th><th>Module</th><th>Type</th><th>Priority</th><th>Parent issue</th><th>Last result</th>
						</tr>
					</thead>
					<tbody>
						{#each data.rows as r (r.id)}
							<tr onclick={() => openCase(r.id)}>
								<td class="rid">{r.id}</td>
								<td>
									<div class="rtitle">{r.title}</div>
									<div class="rtarget">{r.specPath ?? `${r.appCode.toLowerCase()} › ${r.moduleName.toLowerCase()}`}</div>
								</td>
								<td><span class="tag">{r.appCode} · {r.moduleName}</span></td>
								<td><KindBadge kind={r.kind} /></td>
								<td><PipMeter priority={r.priority} /></td>
								<td>{#if r.parentIssueId}<span class="parent-chip">{r.parentIssueId}</span>{:else}<span style="color:var(--faint)">—</span>{/if}</td>
								<td>
									<span style="display:inline-flex;align-items:center;gap:7px">
										<ResultDot status={r.lastResult} />
										{r.lastResult === 'none' ? 'Not run' : RESULT_META[r.lastResult].label}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<div class="empty">
					<div class="empty-in">
						<div class="ei"><Icon name="task" /></div>
						<h3>No test cases yet</h3>
						<p>Author a case to define correct behaviour, then group cases into suites and run them.</p>
						<button class="btn btn-primary" style="margin-top:14px" onclick={newCase}><Icon name="plus" /> New case</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>

{#if data.drawer}
	<CaseDrawer drawer={data.drawer} onClose={closeDrawer} onEdit={editCase} />
{/if}

{#if showForm}
	<CaseFormModal
		applications={data.applications}
		runners={data.runners}
		suites={data.suites}
		issues={data.issues}
		editCase={formCase}
		nextId={data.nextCaseIds}
		onClose={() => (showForm = false)}
	/>
{/if}

{#if showImport}
	<CaseImportModal filterQuery={page.url.search.slice(1)} onClose={() => (showImport = false)} />
{/if}
