<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import ToastHost from '$lib/components/ToastHost.svelte';
	import IssueModal from '$lib/components/IssueModal.svelte';
	import IssueDetailDrawer from '$lib/components/IssueDetailDrawer.svelte';
	import ExportPanel from '$lib/components/ExportPanel.svelte';
	import { closeDrawer, closeExport, closeIssueModal, openNewIssue, ui } from '$lib/stores/ui.svelte';

	let { data, children } = $props();

	let topbar = $state<TopBar | undefined>();

	const NAV = [
		{ href: '/', label: 'Issues', icon: 'rows' },
		{ href: '/board', label: 'Board', icon: 'board' },
		{ href: '/metrics', label: 'Metrics', icon: 'dashboard' }
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	function onKeydown(e: KeyboardEvent) {
		const el = document.activeElement;
		const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT';
		if (e.key === '/' && !typing) {
			e.preventDefault();
			topbar?.focusSearch();
		}
		if (e.key === 'Escape') {
			closeIssueModal();
			closeDrawer();
			closeExport();
		}
		if (e.key === 'n' && !typing && !ui.issueModal) {
			openNewIssue();
		}
	}
</script>

<svelte:head>
	<title>IssueDesk — bug &amp; feature tracker</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:document onkeydown={onKeydown} />

<div class="app">
	<TopBar bind:this={topbar} users={data.users} currentUserId={data.currentUserId} />
	<div class="body">
		<nav class="nav">
			{#each NAV as item (item.href)}
				<a class="nav-item" class:active={isActive(item.href)} href={item.href}>
					<Icon name={item.icon} />
					<span>{item.label}</span>
				</a>
			{/each}
			<div class="nav-sep"></div>
			<a class="nav-item" class:active={isActive('/admin')} href="/admin">
				<Icon name="gear" />
				<span>Config</span>
			</a>
		</nav>
		<div class="workspace">
			{@render children()}
		</div>
	</div>
</div>

{#if ui.issueModal}
	<IssueModal
		mode={ui.issueModal}
		applications={data.applications}
		users={data.users}
		currentUserId={data.currentUserId}
	/>
{/if}

{#if ui.drawerIssue}
	<IssueDetailDrawer issue={ui.drawerIssue} users={data.users} applications={data.applications} />
{/if}

{#if ui.exportOpen}
	<ExportPanel applications={data.applications} />
{/if}

<ToastHost />
