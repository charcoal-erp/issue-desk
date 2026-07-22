<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	const pass = $derived(data.qa.passRate);
</script>

<svelte:head>
	<title>Inflection Zone · Quality</title>
</svelte:head>

<main class="launcher">
	<div class="lc-inner">
		<header class="lc-head">
			<div class="lc-brand">
				<span class="lc-brand-mark"><Icon name="dashboard" /></span>
				<span class="lc-brand-name">Inflection Zone <span class="dot">·</span> Quality</span>
			</div>
			<p class="lc-lede">
				One codebase and repo, <b>two focused workspaces</b>. Pick where to work — they stay
				entirely separate, and you can switch anytime from the top bar.
			</p>
		</header>

		<div class="lc-cards">
			<!-- IssueDesk -->
			<a class="lc-card desk" href="/desk">
				<span class="lc-accent"></span>
				<span class="lc-icon"><Icon name="bug" /></span>
				<h2>IssueDesk</h2>
				<p class="lc-desc">
					Track bugs and feature requests across every product, with export straight into a Claude
					Code session.
				</p>
				<div class="lc-stats">
					<div class="lc-stat"><span class="v">{data.desk.open}</span><span class="k">Open</span></div>
					<div class="lc-stat"><span class="v">{data.desk.issues}</span><span class="k">Issues</span></div>
					<div class="lc-stat"><span class="v">{data.desk.apps}</span><span class="k">Apps</span></div>
				</div>
				<span class="lc-btn">Open IssueDesk <Icon name="arrow-right" /></span>
			</a>

			<!-- Checkpoint -->
			<a class="lc-card qa" href="/qa">
				<span class="lc-accent"></span>
				<span class="lc-icon"><Icon name="task" /></span>
				<h2>Checkpoint</h2>
				<p class="lc-desc">
					Author test cases, group them into suites, and run manual or automated runs — failures
					file a bug next door.
				</p>
				<div class="lc-stats">
					<div class="lc-stat"><span class="v">{data.qa.cases}</span><span class="k">Cases</span></div>
					<div class="lc-stat"><span class="v">{data.qa.suites}</span><span class="k">Suites</span></div>
					<div class="lc-stat">
						<span class="v">{pass === null ? '—' : `${pass}%`}</span><span class="k">Pass</span>
					</div>
				</div>
				<span class="lc-btn">Open Checkpoint <Icon name="arrow-right" /></span>
			</a>
		</div>

		<footer class="lc-foot">
			One repo · one backend · one deploy — two separate interfaces that never mix content.
		</footer>
	</div>
</main>

<style>
	.launcher {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 40px 20px;
		background: var(--paper);
	}
	.lc-inner {
		width: 100%;
		max-width: 760px;
	}
	.lc-head {
		text-align: center;
		margin-bottom: 26px;
	}
	.lc-brand {
		display: inline-flex;
		align-items: center;
		gap: 11px;
		margin-bottom: 14px;
	}
	.lc-brand-mark {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: linear-gradient(140deg, var(--accent), #8a7bff);
		display: grid;
		place-items: center;
		box-shadow: 0 3px 10px rgba(91, 75, 255, 0.35);
	}
	.lc-brand-mark :global(svg) {
		width: 18px;
		height: 18px;
		color: #fff;
	}
	.lc-brand-name {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.lc-brand-name .dot {
		color: var(--faint);
	}
	.lc-lede {
		max-width: 540px;
		margin: 0 auto;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.6;
	}
	.lc-lede b {
		color: var(--ink-2);
	}
	.lc-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 22px;
	}
	.lc-card {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 26px 24px 22px;
		box-shadow: var(--shadow-md);
		text-decoration: none;
		overflow: hidden;
		transition:
			transform 0.16s,
			box-shadow 0.16s;
	}
	.lc-card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-lg);
	}
	.lc-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 5px;
	}
	.lc-card.desk .lc-accent {
		background: var(--accent);
	}
	.lc-card.qa .lc-accent {
		background: #0d9488;
	}
	.lc-icon {
		width: 52px;
		height: 52px;
		border-radius: 14px;
		display: grid;
		place-items: center;
		margin-bottom: 16px;
	}
	.lc-icon :global(svg) {
		width: 26px;
		height: 26px;
		color: #fff;
	}
	.lc-card.desk .lc-icon {
		background: linear-gradient(140deg, var(--accent), #8a7bff);
		box-shadow: 0 6px 16px rgba(91, 75, 255, 0.3);
	}
	.lc-card.qa .lc-icon {
		background: linear-gradient(140deg, #0d9488, #3fbfb0);
		box-shadow: 0 6px 16px rgba(13, 148, 136, 0.3);
	}
	.lc-card h2 {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		color: var(--ink);
	}
	.lc-desc {
		color: var(--muted);
		font-size: 13.5px;
		line-height: 1.55;
		margin: 0 0 18px;
		flex: 1;
	}
	.lc-stats {
		display: flex;
		gap: 26px;
		padding: 16px 0;
		border-top: 1px solid var(--line-2);
		border-bottom: 1px solid var(--line-2);
		margin-bottom: 18px;
	}
	.lc-stat {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.lc-stat .v {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.02em;
	}
	.lc-card.desk .lc-stat .v {
		color: var(--accent);
	}
	.lc-card.qa .lc-stat .v {
		color: #0d9488;
	}
	.lc-stat .k {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--faint);
		font-weight: 600;
	}
	.lc-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 44px;
		border-radius: 10px;
		font-weight: 600;
		font-size: 14px;
		color: #fff;
	}
	.lc-btn :global(svg) {
		width: 16px;
		height: 16px;
	}
	.lc-card.desk .lc-btn {
		background: var(--accent);
		box-shadow: 0 4px 12px rgba(91, 75, 255, 0.32);
	}
	.lc-card.desk:hover .lc-btn {
		background: var(--accent-ink);
	}
	.lc-card.qa .lc-btn {
		background: #0d9488;
		box-shadow: 0 4px 12px rgba(13, 148, 136, 0.32);
	}
	.lc-card.qa:hover .lc-btn {
		background: #0b7a70;
	}
	.lc-foot {
		text-align: center;
		margin-top: 26px;
		font-size: 12px;
		color: var(--faint);
	}
	@media (max-width: 700px) {
		.lc-cards {
			grid-template-columns: 1fr;
		}
	}
</style>
