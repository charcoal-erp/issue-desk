<script lang="ts">
	import '$lib/checkpoint.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import WorkspaceSwitcher from '$lib/components/WorkspaceSwitcher.svelte';
	import LaunchModal from '$lib/components/checkpoint/LaunchModal.svelte';
	import FailuresModal from '$lib/components/checkpoint/FailuresModal.svelte';
	import { openFailures } from '$lib/stores/checkpoint-ui.svelte';

	let { data, children } = $props();

	const NAV = [
		{ href: '/qa', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/qa/cases', label: 'Cases', icon: 'task' },
		{ href: '/qa/suites', label: 'Suites', icon: 'layers' },
		{ href: '/qa/runs', label: 'Runs', icon: 'play' },
		{ href: '/qa/runners', label: 'Runners', icon: 'terminal' }
	];

	function isActive(href: string): boolean {
		return href === '/qa' ? page.url.pathname === '/qa' : page.url.pathname.startsWith(href);
	}

	/**
	 * The box keeps whatever was searched for while you are on the results page,
	 * so refining a query means editing it rather than retyping it; anywhere else
	 * it starts empty.
	 */
	let q = $state(page.url.pathname === '/qa/search' ? (page.url.searchParams.get('q') ?? '') : '');

	function runSearch(e: SubmitEvent) {
		e.preventDefault();
		const term = q.trim();
		if (term) goto(`/qa/search?q=${encodeURIComponent(term)}`);
	}

	const currentUser = $derived(data.users.find((u) => u.id === data.currentUserId) ?? data.users[0]);
	const initials = $derived(
		(currentUser?.name ?? 'QA')
			.split(/\s+/)
			.slice(0, 2)
			.map((s) => s[0])
			.join('')
			.toUpperCase()
	);
	const firstName = $derived((currentUser?.name ?? 'QA').split(/\s+/)[0]);
</script>

<svelte:head>
	<title>Checkpoint — test management</title>
</svelte:head>

<div class="cp">
	<header class="topbar">
		<a class="bm" href="/qa" aria-label="Checkpoint home"><Icon name="task" /></a>
		<WorkspaceSwitcher current="qa" />
		<div class="topbar-spacer"></div>
		<form class="topsearch" onsubmit={runSearch}>
			<Icon name="search" />
			<input
				name="q"
				bind:value={q}
				placeholder="Search cases, suites, runs…"
				aria-label="Search Checkpoint"
				onkeydown={(e) => {
					if (e.key === 'Escape') q = '';
				}}
			/>
		</form>
		<button
			class="icon-btn"
			title="Export failures for Claude Code"
			aria-label="Export failures"
			onclick={() => openFailures({ kind: 'all' })}
		>
			<Icon name="code" />
		</button>
		<span class="user-btn">
			<span class="ua">{initials}</span>
			<span class="un">{firstName}</span>
		</span>
	</header>

	<div class="body">
		<nav class="nav">
			{#each NAV as item (item.href)}
				<a class="nav-item" class:active={isActive(item.href)} href={item.href}>
					<Icon name={item.icon} />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
		<div class="workspace">
			{@render children()}
		</div>
	</div>

	<!-- Inside .cp: every Checkpoint rule is scoped `.cp …`, so a modal rendered
	     as a sibling gets none of them — the runner rows in the launch dialog
	     lost their layout entirely and the kind-badge SVG grew to fill it. Both
	     modals are fixed-position, and .cp sets no transform/filter, so they
	     still cover the viewport from here. -->
	<LaunchModal suites={data.launchSuites} />
	<FailuresModal />
</div>
