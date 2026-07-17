<script lang="ts">
	import { PRIORITIES } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import { relDate } from '$lib/format';
	import { openDrawer } from '$lib/stores/ui.svelte';
	import PriorityMeter from '$lib/components/PriorityMeter.svelte';

	let { data } = $props();

	const issues = $derived(data.issues);
	const open = $derived(issues.filter((i) => i.status === 'open').length);
	const impl = $derived(issues.filter((i) => i.status === 'implemented').length);
	const crit = $derived(issues.filter((i) => i.priority === 'critical' && i.status === 'open').length);
	const bugs = $derived(issues.filter((i) => i.type === 'bug').length);
	const features = $derived(issues.filter((i) => i.type === 'feature').length);

	const appList = $derived(
		data.applications.filter((a) => issues.some((i) => i.appId === a.id))
	);
	const openByApp = $derived(
		new Map(appList.map((a) => [a.id, issues.filter((i) => i.appId === a.id && i.status === 'open').length]))
	);
	const maxApp = $derived(Math.max(...[...openByApp.values()], 1));

	const byPriority = $derived(
		new Map(PRIORITIES.map((p) => [p, issues.filter((i) => i.priority === p).length]))
	);
	const maxPriority = $derived(Math.max(...[...byPriority.values()], 1));

	const recent = $derived(issues.slice(0, 6));

	function userName(id: string): string {
		return data.users.find((u) => u.id === id)?.name ?? id;
	}

	const stats = $derived([
		{ k: 'Total issues', v: issues.length, c: 'var(--accent)', d: `${bugs} bugs · ${features} features` },
		{ k: 'Open', v: open, c: 'var(--open)', d: 'awaiting work' },
		{ k: 'Implemented', v: impl, c: 'var(--impl)', d: 'in verification' },
		{ k: 'Critical & open', v: crit, c: '#B0343A', d: 'need attention now' }
	]);
</script>

<section class="screen screen-dashboard">
	<div class="dash">
		<h1>Metrics</h1>
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
				<div class="panel-head"><h3>Open issues by application</h3></div>
				<div class="panel-body">
					{#each appList as app (app.id)}
						{@const n = openByApp.get(app.id) ?? 0}
						<div class="bar-row">
							<div class="bl"><span class="app-dot" style="background:{app.color}"></span>{app.name}</div>
							<div class="track">
								<div class="fill" style="width:{Math.max((n / maxApp) * 100, 4)}%;background:{app.color}"></div>
							</div>
							<div class="bn">{n}</div>
						</div>
					{/each}
				</div>
			</div>
			<div class="panel">
				<div class="panel-head"><h3>By priority</h3></div>
				<div class="panel-body">
					{#each PRIORITIES as p (p)}
						{@const n = byPriority.get(p) ?? 0}
						<div class="bar-row">
							<div class="bl"><PriorityMeter priority={p} /> {PRIORITY_META[p].label}</div>
							<div class="track">
								<div
									class="fill"
									style="width:{Math.max((n / maxPriority) * 100, 4)}%;background:{PRIORITY_META[p].color}"
								></div>
							</div>
							<div class="bn">{n}</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
		<div class="panel" style="margin-top:16px">
			<div class="panel-head"><h3>Recent activity</h3></div>
			<div class="panel-body">
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
</style>
