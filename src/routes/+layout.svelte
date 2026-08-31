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
	import ImageLightbox from '$lib/components/ImageLightbox.svelte';
	import {
		closeDrawer,
		closeExport,
		closeLightbox,
		openNewIssue,
		requestCloseIssueModal,
		ui
	} from '$lib/stores/ui.svelte';

	let { data, children } = $props();

	let topbar = $state<TopBar | undefined>();

	const NAV = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/issues', label: 'Issues', icon: 'rows' },
		{ href: '/board', label: 'Board', icon: 'board' },
		{ href: '/backlog', label: 'Backlog', icon: 'layers' }
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	/**
	 * The one <title> in the app, derived from the route so it follows a
	 * client-side navigation. Two <title> elements (one here, one per page) would
	 * leave the browser showing whichever came first in the document.
	 */
	const SECTIONS: Array<{ href: string; label: string }> = [
		...NAV,
		{ href: '/admin', label: 'Configuration' }
	];

	const pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		const product = data.settings?.productName ?? 'IssueDesk';
		if (path.startsWith('/login')) return `Sign in · ${product}`;
		// A single issue names itself, so a pinned tab says which one it is.
		const issue = page.data.issue as { id: string; title: string } | undefined;
		if (issue?.id) return `${issue.id} · ${issue.title} · ${product}`;
		const section = SECTIONS.filter((s) => s.href !== '/').find((s) => path.startsWith(s.href));
		if (section) return `${section.label} · ${product}`;
		if (path === '/') return `Dashboard · ${product}`;
		return product;
	});

	// The sign-in screen is the one route that renders without a session, so it
	// gets none of the chrome that assumes one.
	const chromeless = $derived(!data.currentUser);

	function onKeydown(e: KeyboardEvent) {
		const el = document.activeElement;
		const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT';
		if (e.key === '/' && !typing) {
			e.preventDefault();
			topbar?.focusSearch();
		}
		if (e.key === 'Escape') {
			// The preview sits on top of the modal — dismiss it alone, or Escape
			// would discard the half-filled issue form behind it.
			if (ui.lightbox) {
				closeLightbox();
				return;
			}
			// Escape on a dirty issue form asks before discarding — the modal's
			// guard decides whether this actually closes anything.
			requestCloseIssueModal();
			closeDrawer();
			closeExport();
		}
		if (e.key === 'n' && !typing && !ui.issueModal) {
			openNewIssue();
		}
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:document onkeydown={onKeydown} />

{#if chromeless}
	{@render children()}
{:else}
	<div class="app">
		<TopBar bind:this={topbar} user={data.currentUser!} />
		<div class="body">
			<nav class="nav">
				{#each NAV as item (item.href)}
					<a class="nav-item" class:active={isActive(item.href)} href={item.href}>
						<Icon name={item.icon} />
						<span>{item.label}</span>
					</a>
				{/each}
				{#if data.currentUser?.admin}
					<div class="nav-sep"></div>
					<a class="nav-item" class:active={isActive('/admin')} href="/admin">
						<Icon name="gear" />
						<span>Config</span>
					</a>
				{/if}
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
			categories={data.categories}
			users={data.users}
			currentUserId={data.currentUserId}
		/>
	{/if}

	{#if ui.drawerIssue}
		<IssueDetailDrawer
			issue={ui.drawerIssue}
			users={data.users}
			applications={data.applications}
		/>
	{/if}

	{#if ui.exportOpen}
		<ExportPanel applications={data.applications} />
	{/if}

	{#if ui.lightbox}
		<ImageLightbox />
	{/if}
{/if}

<ToastHost />
