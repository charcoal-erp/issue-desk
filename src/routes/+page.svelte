<script lang="ts">
	import { PRIORITIES } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META, STATUS_ORDER } from '$lib/status';
	import { relDate } from '$lib/format';
	import { openDrawer } from '$lib/stores/ui.svelte';
	import PriorityMeter from '$lib/components/PriorityMeter.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	const total = $derived(data.total);
	const recent = $derived(data.issues.slice(0, 6));

	const maxApp = $derived(Math.max(...data.openByApp.map((a) => a.open), 1));
	const maxPriority = $derived(Math.max(...PRIORITIES.map((p) => data.byPriority[p]), 1));
	const maxStatus = $derived(Math.max(...STATUS_ORDER.map((s) => data.byStatus[s]), 1));
	const maxTag = $derived(Math.max(...data.topTags.map((t) => t.count), 1));
	const maxAssignee = $derived(Math.max(...data.assigneeLoad.map((a) => a.open), 1));
	const maxTrend = $derived(
		Math.max(...data.trend.map((t) => Math.max(t.created, t.resolved)), 1)
	);

	function userName(id: string): string {
		return data.users.find((u) => u.id === id)?.name ?? id;
	}

	const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
	const days = (n: number | null) => (n === null ? '—' : `${Math.round(n)}d`);

	const stats = $derived([
		{ k: 'Total issues', v: String(total), c: 'var(--accent)', d: `${data.bugs} bugs · ${data.features} features` },
		{ k: 'Open', v: String(data.byStatus.open), c: 'var(--open)', d: 'awaiting work' },
		{ k: 'In-progress', v: String(data.byStatus['in-progress']), c: 'var(--inprog)', d: 'being worked on' },
		{ k: 'To be verified', v: String(data.byStatus['to-be-verified']), c: 'var(--verify)', d: 'ready to check' },
		{ k: 'Critical & open', v: String(data.criticalOpen), c: '#B0343A', d: 'need attention now' },
		{ k: 'Resolution rate', v: pct(data.resolutionRate), c: 'var(--done)', d: 'complete ÷ total' },
		{ k: 'Avg open age', v: days(data.avgOpenAgeDays), c: 'var(--rejected)', d: 'mean age of open issues' }
	]);
</script>

<section class="screen screen-dashboard">
	<div class="dash">
		<h1>Dashboard</h1>
		<p class="sub">Portfolio-wide snapshot across all applications.</p>

		<div class="stat-grid">
			{#each stats as stat (stat.k)}
				<div class="stat">
					<span class="accent-bar" style="background:{stat.c}"></span>
					<div class="k">{stat.k}</div>
					<div class="v" style="color:{stat.c}">{stat.v}</div>
					<div class="d">{stat.d}</div>
				</div>
			{/each}
		</div>

		<div class="panel-grid">
			<div class="panel">
				<div class="panel-head"><h3>Issues by status</h3></div>
				<div class="panel-body">
					{#if total === 0}
						<div class="empty"><Icon name="rows" /><span>No issues yet</span></div>
					{:else}
						{#each STATUS_ORDER as s (s)}
							{@const n = data.byStatus[s]}
							<div class="bar-row">
								<div class="bl"><span class="status-dot" style="background:{STATUS_META[s].color}"></span>{STATUS_META[s].label}</div>
								<div class="track">
									<div class="fill" style="width:{Math.max((n / maxStatus) * 100, n ? 4 : 0)}%;background:{STATUS_META[s].color}"></div>
								</div>
								<div class="bn">{n}</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<div class="panel">
				<div class="panel-head"><h3>By priority</h3></div>
				<div class="panel-body">
					{#if total === 0}
						<div class="empty"><Icon name="flag" /><span>No issues yet</span></div>
					{:else}
						{#each PRIORITIES as p (p)}
							{@const n = data.byPriority[p]}
							<div class="bar-row">
								<div class="bl"><PriorityMeter priority={p} /> {PRIORITY_META[p].label}</div>
								<div class="track">
									<div class="fill" style="width:{Math.max((n / maxPriority) * 100, n ? 4 : 0)}%;background:{PRIORITY_META[p].color}"></div>
								</div>
								<div class="bn">{n}</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>

		<div class="panel-grid">
			<div class="panel">
				<div class="panel-head"><h3>Open issues by application</h3></div>
				<div class="panel-body">
					{#if data.openByApp.length === 0}
						<div class="empty"><Icon name="board" /><span>No applications with issues yet</span></div>
					{:else}
						{#each data.openByApp as app (app.id)}
							<div class="bar-row">
								<div class="bl"><span class="app-dot" style="background:{app.color}"></span>{app.name}</div>
								<div class="track">
									<div class="fill" style="width:{Math.max((app.open / maxApp) * 100, app.open ? 4 : 0)}%;background:{app.color}"></div>
								</div>
								<div class="bn">{app.open}</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<div class="panel">
				<div class="panel-head"><h3>Open workload by assignee</h3></div>
				<div class="panel-body">
					{#if data.assigneeLoad.length === 0}
						<div class="empty"><Icon name="user" /><span>No assigned open issues</span></div>
					{:else}
						{#each data.assigneeLoad as a (a.id)}
							<div class="bar-row">
								<div class="bl">{a.name}</div>
								<div class="track">
									<div class="fill" style="width:{Math.max((a.open / maxAssignee) * 100, 4)}%;background:var(--accent)"></div>
								</div>
								<div class="bn">{a.open}</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>

		<div class="panel-grid">
			<div class="panel">
				<div class="panel-head"><h3>Created vs. resolved — last 8 weeks</h3></div>
				<div class="panel-body">
					{#if total === 0}
						<div class="empty"><Icon name="dashboard" /><span>No activity yet</span></div>
					{:else}
						<div class="trend">
							{#each data.trend as b (b.label)}
								<div class="trend-col" title="{b.label}: {b.created} created, {b.resolved} resolved">
									<div class="trend-bars">
										<div class="tb tb-created" style="height:{(b.created / maxTrend) * 100}%"></div>
										<div class="tb tb-resolved" style="height:{(b.resolved / maxTrend) * 100}%"></div>
									</div>
									<div class="trend-label">{b.label}</div>
								</div>
							{/each}
						</div>
						<div class="legend">
							<span><i style="background:var(--accent)"></i>Created</span>
							<span><i style="background:var(--done)"></i>Resolved</span>
						</div>
					{/if}
				</div>
			</div>

			<div class="panel">
				<div class="panel-head"><h3>Top tags</h3></div>
				<div class="panel-body">
					{#if data.topTags.length === 0}
						<div class="empty"><Icon name="tag" /><span>No tags yet</span></div>
					{:else}
						<div class="tagcloud">
							{#each data.topTags as t (t.tag)}
								<a class="tagchip" href="/issues?tag={encodeURIComponent(t.tag)}">
									{t.tag}<span class="tagn" style="width:{Math.max((t.count / maxTag) * 44, 8)}px"></span><b>{t.count}</b>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="panel" style="margin-top:16px">
			<div class="panel-head"><h3>Recent activity</h3></div>
			<div class="panel-body">
				{#if recent.length === 0}
					<div class="empty"><Icon name="task" /><span>No issues reported yet</span></div>
				{:else}
					{#each recent as issue (issue.id)}
						<div class="act-item">
							<span class="act-dot" style="background:{STATUS_META[issue.status].color}"></span>
							<div class="ai-body">
								<b>{userName(issue.reporterId)}</b> reported
								<button class="mid" onclick={() => openDrawer(issue)}>{issue.id}</button> — {issue.title}
								<span style="color:var(--faint)">in {issue.appName} / {issue.moduleName}</span>
							</div>
							<div class="ai-time">{relDate(issue.updatedAt)}</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	button.mid {
		padding: 0;
		cursor: pointer;
	}
	button.mid:hover {
		text-decoration: underline;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 28px 12px;
		color: var(--faint);
		font-size: 13px;
	}
	.empty :global(svg) {
		width: 22px;
		height: 22px;
		opacity: 0.5;
	}
	.trend {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		height: 140px;
		padding-top: 8px;
	}
	.trend-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		height: 100%;
	}
	.trend-bars {
		flex: 1;
		width: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 3px;
	}
	.tb {
		width: 42%;
		min-height: 2px;
		border-radius: 3px 3px 0 0;
	}
	.tb-created {
		background: var(--accent);
	}
	.tb-resolved {
		background: var(--done);
	}
	.trend-label {
		font-size: 10.5px;
		color: var(--faint);
		white-space: nowrap;
	}
	.legend {
		display: flex;
		gap: 16px;
		margin-top: 12px;
		font-size: 12px;
		color: var(--muted);
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend i {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		display: inline-block;
	}
	.tagcloud {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.tagchip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--accent-soft-2);
		border: 1px solid var(--border, #e6e6ef);
		border-radius: 999px;
		padding: 4px 10px;
		font-size: 12px;
		color: inherit;
		text-decoration: none;
	}
	.tagchip:hover {
		background: var(--accent-soft);
	}
	.tagchip .tagn {
		height: 4px;
		border-radius: 2px;
		background: var(--accent);
		display: inline-block;
	}
	.tagchip b {
		color: var(--muted);
		font-weight: 600;
	}
</style>
