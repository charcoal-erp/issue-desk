import { a0 as escape_html, a3 as attr_style, $ as stringify, a1 as ensure_array_like, Z as attr, X as attr_class, y as derived } from '../../chunks/server.js-CDtqtqwP.js';
import { r as rateColor } from '../../chunks/meta.js-Drcdnnre.js';
import { I as Icon, K as KindBadge } from '../../chunks/KindBadge.js-DqDHG5dw.js';
import { R as ResultDot } from '../../chunks/ResultDot.js-D80U_RhS.js';

//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		const k = derived(() => data.kpis);
		const sparkMax = derived(() => Math.max(1, ...data.recent.map((r) => r.pass + r.fail)));
		function pct(pr) {
			return pr === null ? "—" : `${pr}%`;
		}
		$$renderer.push(`<div class="table-area"><div class="toolbar"><h1>Dashboard</h1> <span class="count">${escape_html(data.subtitle)}</span> <div class="toolbar-spacer"></div> <button class="btn btn-ghost">`);
		Icon($$renderer, { name: "markdown" });
		$$renderer.push(`<!----> Failures → Markdown</button> <button class="btn btn-primary">`);
		Icon($$renderer, { name: "play" });
		$$renderer.push(`<!----> Launch run</button></div> <div class="dash"><div class="kpis"><div class="kpi"><div class="kv"${attr_style(`color:${stringify(rateColor(k().passRatePct))}`)}>${escape_html(pct(k().passRatePct))}</div> <div class="kk">Pass rate (recent)</div> <div class="ks">`);
		if (k().passRateTrendPct === null) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`no prior window`);
		} else if (k().passRateTrendPct >= 0) {
			$$renderer.push("<!--[1-->");
			$$renderer.push(`<span class="trend-up">▲ ${escape_html(k().passRateTrendPct)}%</span> vs last window`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<span class="trend-dn">▼ ${escape_html(Math.abs(k().passRateTrendPct))}%</span> vs last window`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="kpi"><div class="kv"${attr_style(k().failingCases ? "color:var(--fail)" : "")}>${escape_html(k().failingCases)}</div> <div class="kk">Failing cases</div> <div class="ks">across ${escape_html(k().failingAcrossApps)} application${escape_html(k().failingAcrossApps === 1 ? "" : "s")}</div></div> <div class="kpi"><div class="kv">${escape_html(k().totalCases)}</div> <div class="kk">Test cases</div> <div class="ks">${escape_html(k().automatedCases)} automated · ${escape_html(k().manualCases)} manual</div></div> <div class="kpi"><div class="kv">${escape_html(k().runsLast7Days)}</div> <div class="kk">Runs (7 days)</div> <div class="ks">${escape_html(data.suitesCount)} suite${escape_html(data.suitesCount === 1 ? "" : "s")} configured</div></div> <div class="kpi"><div class="kv"${attr_style(k().flakyRunners ? "color:var(--flaky)" : "")}>${escape_html(k().flakyRunners)}</div> <div class="kk">Flaky runners</div> <div class="ks">≥5% flake rate</div></div></div> <div class="dash-grid"><div class="panel"><div class="panel-hd">Recent runs <a class="btn btn-ghost btn-sm ph-act" href="/runs">All runs</a></div> <div class="panel-bd">`);
		if (data.recent.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="spark"><!--[-->`);
			const each_array = ensure_array_like(data.recent);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let r = each_array[$$index];
				const tot = r.pass + r.fail;
				const h = Math.max(6, Math.round(tot / sparkMax() * 74));
				$$renderer.push(`<a class="spark-col"${attr("href", `/runs/${stringify(r.id)}`)}${attr("title", `${stringify(r.id)} — ${stringify(pct(r.passRate))} pass`)}><div class="spark-bar"${attr_style(`height:${stringify(h)}px`)}><div class="sb-p"${attr_style(`flex:${stringify(r.pass)}`)}></div> <div class="sb-f"${attr_style(`flex:${stringify(r.fail)}`)}></div></div> <div class="spark-lb">${escape_html(r.label)}</div></a>`);
			}
			$$renderer.push(`<!--]--></div> <div class="run-counts" style="margin-top:10px"><span class="rc"><span class="res-dot rd-pass"></span> passed</span> <span class="rc"><span class="res-dot rd-fail"></span> failed</span> <span style="margin-left:auto;font-size:11px;color:var(--faint)">click a bar to open the run</span></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<p style="color:var(--muted);font-size:12.5px;padding:8px 2px">No runs yet — launch one to see the trend.</p>`);
		}
		$$renderer.push(`<!--]--></div></div> <div class="panel"><div class="panel-hd">System health <a class="btn btn-ghost btn-sm ph-act" href="/runners">Runners</a></div> <div class="panel-bd tight"><!--[-->`);
		const each_array_1 = ensure_array_like(data.health);
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let h = each_array_1[$$index_1];
			$$renderer.push(`<div class="health-row"><span${attr_class(`hdot h-${stringify(h.status)}`)}></span> <div class="hr-b"><div class="hr-n">${escape_html(h.name)} `);
			KindBadge($$renderer, {
				kind: h.kind,
				small: true
			});
			$$renderer.push(`<!----></div> <div class="hr-m">${escape_html(h.command)}</div> <div class="flake-bar"><div class="flake-fill"${attr_style(`width:${stringify(Math.min(100, h.flakeRatePct * 4))}%`)}></div></div></div> <div class="hr-s"><b>${escape_html(h.avgLabel)}</b>${escape_html(h.flakeRatePct)}% flake · ${escape_html(h.last)}</div></div>`);
		}
		$$renderer.push(`<!--]--> `);
		if (!data.health.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p style="color:var(--muted);font-size:12.5px;padding:8px 6px">No runners configured yet.</p>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div></div> <div class="dash-grid"><div class="panel"><div class="panel-hd">Failing now `);
		if (data.failing.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="btn btn-danger btn-sm ph-act">`);
			Icon($$renderer, { name: "markdown" });
			$$renderer.push(`<!----> Export ${escape_html(data.failing.length)} → Markdown</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <div class="panel-bd tight"><!--[-->`);
		const each_array_2 = ensure_array_like(data.failing);
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let f = each_array_2[$$index_2];
			$$renderer.push(`<a class="fail-row"${attr("href", `/cases?case=${stringify(f.id)}`)}>`);
			ResultDot($$renderer, { status: f.status });
			$$renderer.push(`<!----> <div class="fr-b"><div class="fr-t">${escape_html(f.title)}</div> <div class="fr-m">${escape_html(f.id)} · ${escape_html(f.appCode)} · ${escape_html(f.specPath ?? f.moduleName)}</div></div> `);
			KindBadge($$renderer, {
				kind: f.kind,
				small: true
			});
			$$renderer.push(`<!----> `);
			if (f.parentIssueId) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="parent-chip">${escape_html(f.parentIssueId)}</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></a>`);
		}
		$$renderer.push(`<!--]--> `);
		if (!data.failing.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p style="color:var(--muted);font-size:12.5px;padding:10px 6px">Nothing failing — every case passed its last run.</p>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div> <div class="panel"><div class="panel-hd">Coverage by module</div> <div class="panel-bd tight"><!--[-->`);
		const each_array_3 = ensure_array_like(data.coverage);
		for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
			let c = each_array_3[$$index_3];
			$$renderer.push(`<div class="mini-cov"><span class="mc-n">${escape_html(c.appCode)} · ${escape_html(c.moduleName)}</span> <span class="split-pill k-manual">${escape_html(c.manual)}M</span> <span class="split-pill k-e2e">${escape_html(c.automated)}A</span> <div class="cov-mini-bar"><div class="cov-mini-fill"${attr_style(`width:${stringify(c.latestPassRate ?? 0)}%;background:${stringify(rateColor(c.latestPassRate))}`)}></div></div> <span class="rate-txt"${attr_style(`color:${stringify(rateColor(c.latestPassRate))}`)}>${escape_html(pct(c.latestPassRate))}</span></div>`);
		}
		$$renderer.push(`<!--]--> `);
		if (!data.coverage.length) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p style="color:var(--muted);font-size:12.5px;padding:10px 6px">No active cases yet — author a case to build coverage.</p>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div></div></div></div>`);
	});
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-Cqqg5h8b.js.map
