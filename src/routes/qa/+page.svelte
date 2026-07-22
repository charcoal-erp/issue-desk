<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
</script>

<div class="qa-stub">
	<span class="qa-stub-icon"><Icon name="task" /></span>
	<h1>Checkpoint</h1>
	<p>
		Test management for the Inflection Zone platform — cases, suites, runners and runs — is being
		wired up here. The workspace shell and switching are live; the screens land next.
	</p>
	<a class="qa-stub-link" href="/desk">← Back to IssueDesk</a>
</div>

<style>
	.qa-stub {
		max-width: 460px;
		margin: 12vh auto 0;
		text-align: center;
		padding: 0 20px;
	}
	.qa-stub-icon {
		width: 60px;
		height: 60px;
		border-radius: 16px;
		background: linear-gradient(140deg, #0d9488, #3fbfb0);
		display: grid;
		place-items: center;
		margin: 0 auto 18px;
		box-shadow: 0 8px 20px rgba(13, 148, 136, 0.3);
	}
	.qa-stub-icon :global(svg) {
		width: 28px;
		height: 28px;
		color: #fff;
	}
	.qa-stub h1 {
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0 0 10px;
		color: var(--ink);
	}
	.qa-stub p {
		color: var(--muted);
		font-size: 14px;
		line-height: 1.6;
		margin: 0 0 20px;
	}
	.qa-stub-link {
		color: #0b7a70;
		font-weight: 600;
		font-size: 13px;
		text-decoration: none;
	}
	.qa-stub-link:hover {
		text-decoration: underline;
	}
</style>
