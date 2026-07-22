<script lang="ts">
	import WorkspaceSwitcher from '$lib/components/WorkspaceSwitcher.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Checkpoint — test management</title>
</svelte:head>

<div class="qa-shell">
	<header class="qa-topbar">
		<a class="qa-brand" href="/qa" aria-label="Checkpoint home">
			<span class="qa-mark"><Icon name="task" /></span>
		</a>
		<WorkspaceSwitcher current="qa" />
	</header>
	<div class="qa-body">
		{@render children()}
	</div>
</div>

<style>
	.qa-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background: var(--paper);
	}
	.qa-topbar {
		height: 58px;
		flex: 0 0 58px;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 0 20px;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}
	.qa-brand {
		text-decoration: none;
	}
	.qa-mark {
		width: 30px;
		height: 30px;
		border-radius: 9px;
		background: linear-gradient(140deg, #0d9488, #3fbfb0);
		display: grid;
		place-items: center;
		box-shadow: 0 3px 10px rgba(13, 148, 136, 0.35);
	}
	.qa-mark :global(svg) {
		width: 17px;
		height: 17px;
		color: #fff;
	}
	.qa-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
</style>
