<script lang="ts">
	import type { Application, IssueFilter, IssueType, Priority, Status } from '$lib/types';
	import { PRIORITIES, STATUSES } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import type { FilterCounts } from '../../routes/+page.server';
	import Icon from './Icon.svelte';
	import PriorityMeter from './PriorityMeter.svelte';

	let {
		applications,
		counts,
		filter,
		onChange
	}: {
		applications: Application[];
		counts: FilterCounts;
		filter: IssueFilter;
		onChange: (patch: Partial<IssueFilter>) => void;
	} = $props();

	// Only apps that actually have issues appear in the rail (mockup behaviour).
	const appList = $derived(applications.filter((a) => (counts.byApp[a.id] ?? 0) > 0));

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

	function setType(t: IssueType | undefined) {
		onChange({ type: t });
	}
</script>

<aside class="filters">
	<div class="f-block">
		<div class="f-title">
			Applications <button class="clear" onclick={() => onChange({ appId: undefined })}>Reset</button>
		</div>
		<div>
			<button class="app-item" class:active={!filter.appId} onclick={() => onChange({ appId: undefined })}>
				<span class="app-dot" style="background:var(--muted)"></span>
				<span class="an">All applications</span>
				<span class="ac">{counts.total}</span>
			</button>
			{#each appList as app (app.id)}
				<button
					class="app-item"
					class:active={filter.appId === app.id}
					onclick={() => onChange({ appId: app.id })}
				>
					<span class="app-dot" style="background:{app.color}"></span>
					<span class="an">{app.name}</span>
					<span class="ac">{counts.byApp[app.id] ?? 0}</span>
				</button>
			{/each}
		</div>
	</div>

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
		<div class="f-title">Type</div>
		<div class="seg">
			<button class:on={!filter.type} onclick={() => setType(undefined)}>All</button>
			<button class:on={filter.type === 'bug'} onclick={() => setType('bug')}>Bugs</button>
			<button class:on={filter.type === 'feature'} onclick={() => setType('feature')}>Features</button>
		</div>
	</div>
</aside>
