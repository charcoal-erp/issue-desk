<script lang="ts">
	import type {
		Application,
		Category,
		IssueFilter,
		IssueType,
		Priority,
		Source,
		Status
	} from '$lib/types';
	import { PRIORITIES, STATUSES } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import { SOURCE_META, SOURCE_ORDER } from '$lib/source';
	import { DATE_PRESETS, activePreset, presetRange, type DatePresetId } from '$lib/dates';
	import type { FilterCounts } from '$lib/counts';
	import Icon from './Icon.svelte';
	import PriorityMeter from './PriorityMeter.svelte';

	let {
		applications,
		categories,
		counts,
		filter,
		hideStatus = false,
		onChange
	}: {
		applications: Application[];
		categories: Category[];
		counts: FilterCounts;
		filter: IssueFilter;
		/** For a view that already *is* one status — the backlog page. */
		hideStatus?: boolean;
		onChange: (patch: Partial<IssueFilter>) => void;
	} = $props();

	// Only apps that actually have issues appear in the rail (mockup behaviour).
	const appList = $derived(applications.filter((a) => (counts.byApp[a.id] ?? 0) > 0));

	// Modules belong to an application, so the picker only makes sense once one
	// is chosen — otherwise two apps' "General" modules would sit side by side.
	const selectedApp = $derived(applications.find((a) => a.id === filter.appId));
	const moduleList = $derived(
		(selectedApp?.modules ?? []).map((m) => ({
			...m,
			count: counts.byModule[`${selectedApp!.id}/${m.id}`] ?? 0
		}))
	);

	const preset = $derived(activePreset(filter));

	function toggleStatus(s: Status) {
		const set = new Set(filter.status ?? []);
		if (set.has(s)) set.delete(s);
		else set.add(s);
		onChange({ status: [...set] });
	}

	function togglePriority(p: Priority) {
		const set = new Set(filter.priority ?? []);
		if (set.has(p)) set.delete(p);
		else set.add(p);
		onChange({ priority: [...set] });
	}

	function toggleSource(s: Source) {
		const set = new Set(filter.source ?? []);
		if (set.has(s)) set.delete(s);
		else set.add(s);
		onChange({ source: [...set] });
	}

	function setType(t: IssueType | undefined) {
		onChange({ type: t });
	}

	function applyPreset(id: DatePresetId) {
		if (preset === id) {
			onChange({ updatedFrom: undefined, updatedTo: undefined });
			return;
		}
		const range = presetRange(id);
		onChange({ updatedFrom: range.updatedFrom, updatedTo: range.updatedTo });
	}
</script>

<aside class="filters">
	<div class="f-block">
		<div class="f-title">
			Applications <button class="clear" onclick={() => onChange({ appId: undefined, moduleId: undefined })}>Reset</button>
		</div>
		<div>
			<button
				class="app-item"
				class:active={!filter.appId}
				onclick={() => onChange({ appId: undefined, moduleId: undefined })}
			>
				<span class="app-dot" style="background:var(--muted)"></span>
				<span class="an">All applications</span>
				<span class="ac">{counts.total}</span>
			</button>
			{#each appList as app (app.id)}
				<button
					class="app-item"
					class:active={filter.appId === app.id}
					onclick={() => onChange({ appId: app.id, moduleId: undefined })}
				>
					<span class="app-dot" style="background:{app.color}"></span>
					<span class="an">{app.name}</span>
					<span class="ac">{counts.byApp[app.id] ?? 0}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if selectedApp && moduleList.length}
		<div class="f-block">
			<div class="f-title">
				Module <button class="clear" onclick={() => onChange({ moduleId: undefined })}>Reset</button>
			</div>
			<div class="scroller">
				<button
					class="app-item"
					class:active={!filter.moduleId}
					onclick={() => onChange({ moduleId: undefined })}
				>
					<span class="app-dot" style="background:var(--muted)"></span>
					<span class="an">All modules</span>
					<span class="ac">{counts.byApp[selectedApp.id] ?? 0}</span>
				</button>
				{#each moduleList as m (m.id)}
					<button
						class="app-item"
						class:active={filter.moduleId === m.id}
						onclick={() => onChange({ moduleId: m.id })}
					>
						<span class="app-dot" style="background:var(--faint)"></span>
						<span class="an">{m.name}</span>
						<span class="ac">{m.count}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="f-block">
		<div class="f-title">Type</div>
		<div class="seg">
			<button class:on={!filter.type} onclick={() => setType(undefined)}>All</button>
			<button class:on={filter.type === 'bug'} onclick={() => setType('bug')}>Bugs</button>
			<button class:on={filter.type === 'feature'} onclick={() => setType('feature')}>Features</button>
		</div>
	</div>

	{#if !hideStatus}
		<div class="f-block">
			<div class="f-title">Status</div>
			<div>
				{#each STATUSES as s (s)}
					<button class="chk" class:on={filter.status?.includes(s)} onclick={() => toggleStatus(s)}>
						<span class="box"><Icon name="check-bold" /></span>
						<span class="status-dot" style="background:{STATUS_META[s].color}"></span>
						<span class="cl">{STATUS_META[s].label}</span>
						<span class="cn">{counts.byStatus[s] ?? 0}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="f-block">
		<div class="f-title">Priority</div>
		<div>
			{#each PRIORITIES as p (p)}
				<button class="chk" class:on={filter.priority?.includes(p)} onclick={() => togglePriority(p)}>
					<span class="box"><Icon name="check-bold" /></span>
					<PriorityMeter priority={p} variant="pips" />
					<span class="cl">{PRIORITY_META[p].label}</span>
					<span class="cn">{counts.byPriority[p] ?? 0}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="f-block">
		<div class="f-title">Source</div>
		<div>
			{#each SOURCE_ORDER as s (s)}
				<button
					class="chk"
					class:on={filter.source?.includes(s)}
					onclick={() => toggleSource(s)}
					title={SOURCE_META[s].description}
				>
					<span class="box"><Icon name="check-bold" /></span>
					<span class="status-dot" style="background:{SOURCE_META[s].color}"></span>
					<span class="cl">{SOURCE_META[s].label}</span>
					<span class="cn">{counts.bySource[s] ?? 0}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="f-block">
		<div class="f-title">
			Updated
			{#if filter.updatedFrom || filter.updatedTo}
				<button class="clear" onclick={() => onChange({ updatedFrom: undefined, updatedTo: undefined })}>
					Reset
				</button>
			{/if}
		</div>
		<div class="tag-cloud">
			{#each DATE_PRESETS as p (p.id)}
				<button class="tag-pill" class:on={preset === p.id} onclick={() => applyPreset(p.id)}>
					{p.label}
				</button>
			{/each}
		</div>
		<div class="date-range">
			<label>
				<span>From</span>
				<input
					type="date"
					value={filter.updatedFrom ?? ''}
					onchange={(e) => onChange({ updatedFrom: e.currentTarget.value || undefined })}
				/>
			</label>
			<label>
				<span>To</span>
				<input
					type="date"
					value={filter.updatedTo ?? ''}
					onchange={(e) => onChange({ updatedTo: e.currentTarget.value || undefined })}
				/>
			</label>
		</div>
	</div>

	{#if counts.topTags.length}
		<div class="f-block">
			<div class="f-title">
				Tags <button class="clear" onclick={() => onChange({ tag: undefined })}>Reset</button>
			</div>
			<div class="tag-cloud">
				{#each counts.topTags as t (t.tag)}
					<button
						class="tag-pill"
						class:on={filter.tag === t.tag}
						onclick={() => onChange({ tag: filter.tag === t.tag ? undefined : t.tag })}
					>
						{t.tag}<span class="tc">{t.count}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if categories.length}
		<div class="f-block">
			<div class="f-title">
				Category
				<button class="clear" onclick={() => onChange({ categoryId: undefined })}>Reset</button>
			</div>
			<div>
				<button
					class="app-item"
					class:active={!filter.categoryId}
					onclick={() => onChange({ categoryId: undefined })}
				>
					<span class="app-dot" style="background:var(--muted)"></span>
					<span class="an">All categories</span>
					<span class="ac">{counts.total}</span>
				</button>
				{#each categories as c (c.id)}
					<button
						class="app-item"
						class:active={filter.categoryId === c.id}
						onclick={() => onChange({ categoryId: c.id })}
						title={c.description}
					>
						<span class="app-dot" style="background:{c.color ?? 'var(--faint)'}"></span>
						<span class="an">{c.name}</span>
						<span class="ac">{counts.byCategory[c.id] ?? 0}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</aside>

<style>
	/* A long module list shouldn't push the rest of the rail out of reach. */
	.scroller {
		max-height: 230px;
		overflow-y: auto;
	}
	.tag-cloud {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.tag-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11.5px;
		padding: 4px 9px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink-2);
		cursor: pointer;
	}
	.tag-pill:hover {
		border-color: var(--accent-soft);
		background: var(--accent-soft-2);
	}
	.tag-pill.on {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
	.tag-pill .tc {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--faint);
	}
	.tag-pill.on .tc {
		color: rgba(255, 255, 255, 0.8);
	}
	.date-range {
		display: grid;
		gap: 8px;
		margin-top: 10px;
	}
	.date-range label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11.5px;
		color: var(--muted);
	}
	.date-range label span {
		width: 34px;
		flex: none;
	}
	.date-range input {
		flex: 1;
		min-width: 0;
		font-size: 11.5px;
		padding: 5px 8px;
		border: 1px solid var(--line);
		border-radius: var(--radius-xs);
		background: var(--surface);
		color: var(--ink-2);
		font-family: var(--font-body);
	}
</style>
