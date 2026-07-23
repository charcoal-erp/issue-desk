<script lang="ts">
	import '$lib/checkpoint.css';
	import { page } from '$app/state';
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
		<div class="topsearch">
			<Icon name="search" />
			<input placeholder="Search cases, suites, runs…" aria-label="Search Checkpoint" />
		</div>
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
</div>

<LaunchModal suites={data.launchSuites} />
<FailuresModal />
