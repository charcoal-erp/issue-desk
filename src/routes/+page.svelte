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
	const recent = $derived(data.issues.slice(0, 5));

	const maxPriority = $derived(Math.max(...PRIORITIES.map((p) => data.byPriority[p]), 1));
	const maxStatus = $derived(Math.max(...STATUS_ORDER.map((s) => data.byStatus[s]), 1));
	const maxTag = $derived(Math.max(...data.topTags.map((t) => t.count), 1));
	const maxTrend = $derived(
		Math.max(...data.trend.map((t) => Math.max(t.created, t.resolved)), 1)
	);

	// The trend line is laid out in real pixels off the measured panel width
	// rather than a scaled viewBox, so strokes and dots stay the same size
	// whatever width the card ends up at. Width is 0 until the binding lands,
	// which is also what the server renders — so hydration has nothing to fix.
	const PLOT_H = 112;
	const PLOT_TOP = 12;
	const PLOT_BOTTOM = 8;
	const PLOT_LEFT = 22; // gutter for the 0 and max labels

	let plotW = $state(0);

	const trendLine = $derived.by(() => {
		const n = data.trend.length;
		if (!n || plotW <= PLOT_LEFT) return null;
		const step = (plotW - PLOT_LEFT) / n;
		const band = PLOT_H - PLOT_TOP - PLOT_BOTTOM;
		const at = (v: number) => PLOT_TOP + (1 - v / maxTrend) * band;
		// Points sit at column centres, which is where the labels below centre too.
		const series = (pick: (t: (typeof data.trend)[number]) => number) =>
			data.trend.map((t, i) => ({
				x: PLOT_LEFT + step * (i + 0.5),
				y: at(pick(t)),
				v: pick(t),
				label: t.label
			}));
		return {
			created: series((t) => t.created),
			resolved: series((t) => t.resolved),
			grid: [1, 0.5, 0].map((f) => at(maxTrend * f)),
			topY: at(maxTrend),
			zeroY: at(0)
		};
	});

	const polyline = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

	/**
	 * Label every week when the column is wide enough for a date, otherwise every
	 * second one — counted back from the newest week, so the label people look at
	 * first is always the one that survives. Thinning beats letting "Aug 10" wrap
	 * onto two lines while "Jul 6" stays on one, which is what makes an axis look
	 * ragged; every point still carries its own figures on hover.
	 */
	const labelStride = $derived(
		plotW > 0 && (plotW - PLOT_LEFT) / Math.max(data.trend.length, 1) < 42 ? 2 : 1
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

			<div class="panel">
				<div class="panel-head"><h3>Created vs. resolved — last 8 weeks</h3></div>
				<div class="panel-body">
					{#if total === 0}
						<div class="empty"><Icon name="dashboard" /><span>No activity yet</span></div>
					{:else}
						<div class="trend" bind:clientWidth={plotW}>
							<svg
								class="trend-plot"
								width={plotW}
								height={PLOT_H}
								role="img"
								aria-label="Issues created versus resolved over the last {data.trend.length} weeks"
							>
								{#if trendLine}
									{#each trendLine.grid as y, i (i)}
										<line class="grid" x1={PLOT_LEFT} x2={plotW} y1={y} y2={y} />
									{/each}
									<text class="axis-n" x={PLOT_LEFT - 7} y={trendLine.topY}>{maxTrend}</text>
									<text class="axis-n" x={PLOT_LEFT - 7} y={trendLine.zeroY}>0</text>
									<polyline class="ln ln-resolved" points={polyline(trendLine.resolved)} />
									<polyline class="ln ln-created" points={polyline(trendLine.created)} />
									{#each trendLine.resolved as p (p.label)}
										<circle class="dot dot-resolved" cx={p.x} cy={p.y} r="3.2">
											<title>{p.label}: {p.v} resolved</title>
										</circle>
									{/each}
									{#each trendLine.created as p (p.label)}
										<circle class="dot dot-created" cx={p.x} cy={p.y} r="3.2">
											<title>{p.label}: {p.v} created</title>
										</circle>
									{/each}
								{/if}
							</svg>
							<div class="trend-axis" style="padding-left:{PLOT_LEFT}px">
								{#each data.trend as b, i (b.label)}
									<span class="trend-label" title="{b.label}: {b.created} created, {b.resolved} resolved">
										{(data.trend.length - 1 - i) % labelStride === 0 ? b.label : ''}
									</span>
								{/each}
							</div>
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

			<div class="panel">
				<div class="panel-head"><h3>Recent activity</h3></div>
				<div class="panel-body">
					{#if recent.length === 0}
						<div class="empty"><Icon name="task" /><span>No issues reported yet</span></div>
					{:else}
						{#each recent as issue (issue.id)}
							<div class="act-item">
								<span class="act-dot" style="background:{STATUS_META[issue.status].color}"></span>
								<div class="ai-body">
									<div class="ai-line">
										<button class="mid" onclick={() => openDrawer(issue)}>{issue.id}</button>
										<span class="ai-title" title={issue.title}>{issue.title}</span>
									</div>
									<div class="ai-meta">
										{userName(issue.reporterId)} · {issue.appName}{issue.moduleName ? ` / ${issue.moduleName}` : ''} · {relDate(issue.updatedAt)}
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
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
		padding-top: 8px;
	}
	.trend-plot {
		display: block;
	}
	.trend-plot .grid {
		stroke: var(--line-2);
		stroke-width: 1;
	}
	.trend-plot .axis-n {
		font-size: 9.5px;
		fill: var(--faint);
		text-anchor: end;
		dominant-baseline: middle;
	}
	.trend-plot .ln {
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.trend-plot .ln-created {
		stroke: var(--accent);
	}
	.trend-plot .ln-resolved {
		stroke: var(--done);
	}
	/* A ring in the card colour keeps a point readable where the two lines cross. */
	.trend-plot .dot {
		stroke: var(--surface);
		stroke-width: 1.5;
	}
	.trend-plot .dot-created {
		fill: var(--accent);
	}
	.trend-plot .dot-resolved {
		fill: var(--done);
	}
	.trend-axis {
		display: flex;
		margin-top: 5px;
	}
	.trend-label {
		flex: 1;
		min-width: 0;
		font-size: 10.5px;
		color: var(--faint);
		text-align: center;
		/* Never wraps — `labelStride` drops every other date instead when the
		   columns get too narrow for one. */
		white-space: nowrap;
		line-height: 1.25;
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
