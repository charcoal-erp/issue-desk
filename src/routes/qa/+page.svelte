<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import KindBadge from '$lib/components/checkpoint/KindBadge.svelte';
	import ResultDot from '$lib/components/checkpoint/ResultDot.svelte';
	import { rateColor } from '$lib/checkpoint/meta';
	import { openFailures, openLaunch } from '$lib/stores/checkpoint-ui.svelte';

	let { data } = $props();

	const k = $derived(data.kpis);
	const sparkMax = $derived(Math.max(1, ...data.recent.map((r) => r.pass + r.fail)));

	function pct(pr: number | null): string {
		return pr === null ? '—' : `${pr}%`;
	}
</script>

<div class="table-area">
	<div class="toolbar">
		<h1>Dashboard</h1>
		<span class="count">{data.subtitle}</span>
		<div class="toolbar-spacer"></div>
		<button class="btn btn-ghost" onclick={() => openFailures({ kind: 'all' })}>
			<Icon name="markdown" /> Failures → Markdown
		</button>
		<button class="btn btn-primary" onclick={() => openLaunch(null)}>
			<Icon name="play" /> Launch run
		</button>
	</div>

	<div class="dash">
		<!-- KPI strip -->
		<div class="kpis">
			<div class="kpi">
				<div class="kv" style="color:{rateColor(k.passRatePct)}">{pct(k.passRatePct)}</div>
				<div class="kk">Pass rate (recent)</div>
				<div class="ks">
					{#if k.passRateTrendPct === null}
						no prior window
					{:else if k.passRateTrendPct >= 0}
						<span class="trend-up">▲ {k.passRateTrendPct}%</span> vs last window
					{:else}
						<span class="trend-dn">▼ {Math.abs(k.passRateTrendPct)}%</span> vs last window
					{/if}
				</div>
			</div>
			<div class="kpi">
				<div class="kv" style={k.failingCases ? 'color:var(--fail)' : ''}>{k.failingCases}</div>
				<div class="kk">Failing cases</div>
				<div class="ks">across {k.failingAcrossApps} application{k.failingAcrossApps === 1 ? '' : 's'}</div>
			</div>
			<div class="kpi">
				<div class="kv">{k.totalCases}</div>
				<div class="kk">Test cases</div>
				<div class="ks">{k.automatedCases} automated · {k.manualCases} manual</div>
			</div>
			<div class="kpi">
				<div class="kv">{k.runsLast7Days}</div>
				<div class="kk">Runs (7 days)</div>
				<div class="ks">{data.suitesCount} suite{data.suitesCount === 1 ? '' : 's'} configured</div>
			</div>
			<div class="kpi">
				<div class="kv" style={k.flakyRunners ? 'color:var(--flaky)' : ''}>{k.flakyRunners}</div>
				<div class="kk">Flaky runners</div>
				<div class="ks">≥5% flake rate</div>
			</div>
		</div>

		<!-- Recent runs + System health -->
		<div class="dash-grid">
			<div class="panel">
				<div class="panel-hd">
					Recent runs
					<a class="btn btn-ghost btn-sm ph-act" href="/qa/runs">All runs</a>
				</div>
				<div class="panel-bd">
					{#if data.recent.length}
						<div class="spark">
							{#each data.recent as r (r.id)}
								{@const tot = r.pass + r.fail}
								{@const h = Math.max(6, Math.round((tot / sparkMax) * 74))}
								<a class="spark-col" href="/qa/runs/{r.id}" title="{r.id} — {pct(r.passRate)} pass">
									<div class="spark-bar" style="height:{h}px">
										<div class="sb-p" style="flex:{r.pass}"></div>
										<div class="sb-f" style="flex:{r.fail}"></div>
									</div>
									<div class="spark-lb">{r.label}</div>
								</a>
							{/each}
						</div>
						<div class="run-counts" style="margin-top:10px">
							<span class="rc"><span class="res-dot rd-pass"></span> passed</span>
							<span class="rc"><span class="res-dot rd-fail"></span> failed</span>
							<span style="margin-left:auto;font-size:11px;color:var(--faint)">click a bar to open the run</span>
						</div>
					{:else}
						<p style="color:var(--muted);font-size:12.5px;padding:8px 2px">No runs yet — launch one to see the trend.</p>
					{/if}
				</div>
			</div>

			<div class="panel">
				<div class="panel-hd">
					System health
					<a class="btn btn-ghost btn-sm ph-act" href="/qa/runners">Runners</a>
				</div>
				<div class="panel-bd tight">
					{#each data.health as h (h.id)}
						<div class="health-row">
							<span class="hdot h-{h.status}"></span>
							<div class="hr-b">
								<div class="hr-n">{h.name} <KindBadge kind={h.kind} small /></div>
								<div class="hr-m">{h.command}</div>
								<div class="flake-bar"><div class="flake-fill" style="width:{Math.min(100, h.flakeRatePct * 4)}%"></div></div>
							</div>
							<div class="hr-s"><b>{h.avgLabel}</b>{h.flakeRatePct}% flake · {h.last}</div>
						</div>
					{/each}
					{#if !data.health.length}
						<p style="color:var(--muted);font-size:12.5px;padding:8px 6px">No runners configured yet.</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Failing now + Coverage -->
		<div class="dash-grid">
			<div class="panel">
				<div class="panel-hd">
					Failing now
					{#if data.failing.length}
						<button class="btn btn-danger btn-sm ph-act" onclick={() => openFailures({ kind: 'all' })}>
							<Icon name="markdown" /> Export {data.failing.length} → Markdown
						</button>
					{/if}
				</div>
				<div class="panel-bd tight">
					{#each data.failing as f (f.id)}
						<a class="fail-row" href="/qa/cases?case={f.id}">
							<ResultDot status={f.status} />
							<div class="fr-b">
								<div class="fr-t">{f.title}</div>
								<div class="fr-m">{f.id} · {f.appCode} · {f.specPath ?? f.moduleName}</div>
							</div>
							<KindBadge kind={f.kind} small />
							{#if f.parentIssueId}<span class="parent-chip">{f.parentIssueId}</span>{/if}
						</a>
					{/each}
					{#if !data.failing.length}
						<p style="color:var(--muted);font-size:12.5px;padding:10px 6px">Nothing failing — every case passed its last run.</p>
					{/if}
				</div>
			</div>

			<div class="panel">
				<div class="panel-hd">Coverage by module</div>
				<div class="panel-bd tight">
					{#each data.coverage as c (c.appId + c.moduleId)}
						<div class="mini-cov">
							<span class="mc-n">{c.appCode} · {c.moduleName}</span>
							<span class="split-pill k-manual">{c.manual}M</span>
							<span class="split-pill k-e2e">{c.automated}A</span>
							<div class="cov-mini-bar">
								<div class="cov-mini-fill" style="width:{c.latestPassRate ?? 0}%;background:{rateColor(c.latestPassRate)}"></div>
							</div>
							<span class="rate-txt" style="color:{rateColor(c.latestPassRate)}">{pct(c.latestPassRate)}</span>
						</div>
					{/each}
					{#if !data.coverage.length}
						<p style="color:var(--muted);font-size:12.5px;padding:10px 6px">No active cases yet — author a case to build coverage.</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
