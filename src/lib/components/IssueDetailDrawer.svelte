<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import type { Application, Issue, User } from '$lib/types';
	import { STATUS_ORDER, STATUS_META } from '$lib/status';
	import { PRIORITY_META } from '$lib/priority';
	import { fmtDate } from '$lib/format';
	import { postAction } from '$lib/actions';
	import { singleIssueMarkdown } from '$lib/export/copyIssue';
	import { toast } from '$lib/stores/toasts.svelte';
	import { closeDrawer, openEditIssue, ui } from '$lib/stores/ui.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import PriorityMeter from './PriorityMeter.svelte';
	import StatusBadge from './StatusBadge.svelte';

	let {
		issue,
		users,
		applications
	}: {
		issue: Issue;
		users: User[];
		applications: Application[];
	} = $props();

	const reporter = $derived(users.find((u) => u.id === issue.reporterId));
	const assignee = $derived(users.find((u) => u.id === issue.assigneeId));
	const appColor = $derived(applications.find((a) => a.id === issue.appId)?.color);
	const descHtml = $derived(
		DOMPurify.sanitize(marked.parse(issue.description, { async: false }))
	);

	function userName(id: string): string {
		return users.find((u) => u.id === id)?.name ?? id;
	}

	async function advanceStatus() {
		const next = STATUS_ORDER[(STATUS_ORDER.indexOf(issue.status) + 1) % STATUS_ORDER.length];
		const result = await postAction('changeStatus', { id: issue.id, status: next });
		if (result.type === 'success') {
			const updated = result.data?.issue as Issue | undefined;
			if (updated) ui.drawerIssue = updated;
			await invalidateAll();
			toast(`${issue.id} → ${STATUS_META[next].label}`, 'Status updated');
		} else {
			toast('Could not update status', '');
		}
	}

	async function copyIssue() {
		try {
			await navigator.clipboard.writeText(singleIssueMarkdown(issue, users, location.origin));
			toast(`Copied ${issue.id}`, 'Single-issue prompt ready for Claude Code');
		} catch {
			toast('Copy failed', 'Select the text and copy manually');
		}
	}

	function esc(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function activityText(kind: string, from?: string, to?: string, by?: string): string {
		switch (kind) {
			case 'status':
				return `Status moved to <b>${STATUS_META[to as keyof typeof STATUS_META]?.label ?? to}</b>`;
			case 'priority':
				return `Priority changed to <b>${PRIORITY_META[to as keyof typeof PRIORITY_META]?.label ?? to}</b>`;
			case 'assignee':
				return to ? `Assigned to <b>${esc(userName(to))}</b>` : 'Unassigned';
			case 'edit':
				return `<b>${esc(userName(by ?? ''))}</b> edited this issue`;
			case 'attachment':
				return `Attachment <b>${esc(from ?? '')}</b> removed`;
			default:
				return `<b>${esc(userName(by ?? ''))}</b> updated this issue`;
		}
	}
</script>

<div
	class="drawer-backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) closeDrawer();
	}}
>
	<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
		<div class="dr-head">
			<div class="dr-top">
				<span class="dr-id">{issue.id}</span>
				<span class="type-tag {issue.type === 'bug' ? 'type-bug' : 'type-feature'}">{issue.type}</span>
				<StatusBadge status={issue.status} />
				<button class="x" onclick={closeDrawer} aria-label="Close"><Icon name="x" /></button>
			</div>
			<h2 id="drawer-title">{issue.title}</h2>
		</div>
		<div class="dr-body">
			<div class="dr-quick">
				<button class="btn btn-ghost btn-sm" onclick={() => openEditIssue(issue)}>
					<Icon name="edit" />Edit
				</button>
				<button class="btn btn-ghost btn-sm" onclick={advanceStatus}>
					<Icon name="refresh" />Advance status
				</button>
				<button class="btn btn-primary btn-sm" onclick={copyIssue}>
					<Icon name="copy" />Copy for Claude Code
				</button>
			</div>
			<div class="dr-meta">
				<div class="row">
					<span class="rk">Application</span>
					<span class="rv"><span class="app-dot" style="background:{appColor}"></span>{issue.appName}</span>
				</div>
				<div class="row"><span class="rk">Module</span><span class="rv">{issue.moduleName}</span></div>
				<div class="row">
					<span class="rk">Page / Form</span>
					<span class="rv">
						<span style="font-family:var(--font-mono);font-size:12px">{issue.pagePath || '—'}</span
						>{issue.formName ? ' · ' + issue.formName : ''}
					</span>
				</div>
				<div class="row">
					<span class="rk">Priority</span>
					<span class="rv"><PriorityMeter priority={issue.priority} /> {PRIORITY_META[issue.priority].label}</span>
				</div>
				<div class="row">
					<span class="rk">Reporter</span>
					<span class="rv"><Avatar user={reporter} /> {reporter?.name ?? issue.reporterId}</span>
				</div>
				<div class="row">
					<span class="rk">Assignee</span>
					<span class="rv">
						{#if assignee}
							<Avatar user={assignee} /> {assignee.name}
						{:else}
							<span style="color:var(--faint)">Unassigned</span>
						{/if}
					</span>
				</div>
				<div class="row">
					<span class="rk">Tags</span>
					<span class="rv">
						{#each issue.tags as tag (tag)}
							<span class="mod-tag">{tag}</span>
						{:else}
							—
						{/each}
					</span>
				</div>
			</div>
			<div class="dr-sec-t">Description</div>
			<!-- eslint-disable-next-line svelte/no-at-html-tags — sanitised via DOMPurify -->
			<div class="dr-desc">{@html descHtml}</div>
			{#if issue.attachments.length}
				<div class="dr-sec-t">Attachments · public URLs</div>
				<div class="gallery">
					{#each issue.attachments as att (att.id)}
						<a class="gal-item" href={att.url} target="_blank" rel="noopener">
							<div class="gal-thumb {att.kind === 'image' ? 'img' : 'pdf'}">
								{#if att.kind === 'image'}
									<img src={att.url} alt={att.filename} loading="lazy" />
								{:else}
									<Icon name="file-lt" />
								{/if}
							</div>
							<div class="gal-name">{att.filename}</div>
						</a>
					{/each}
				</div>
			{/if}
			<div class="dr-sec-t">Activity</div>
			<div class="timeline">
				{#each issue.activity as entry (entry.id)}
					{#if entry.kind === 'created'}
						<div class="tl-item">
							<div class="tl-txt"><b>{userName(entry.by)}</b> created this issue</div>
							<div class="tl-time">{fmtDate(entry.at)} · via IssueDesk</div>
						</div>
					{:else if entry.kind === 'comment'}
						<div class="tl-item muted">
							<div class="tl-txt"><b>{userName(entry.by)}</b>: {entry.message}</div>
							<div class="tl-time">{fmtDate(entry.at)}</div>
						</div>
					{:else}
						<div class="tl-item muted">
							<!-- eslint-disable-next-line svelte/no-at-html-tags — built from known labels -->
							<div class="tl-txt">{@html activityText(entry.kind, entry.from, entry.to, entry.by)}</div>
							<div class="tl-time">{fmtDate(entry.at)}</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
		<div class="dr-foot">
			<div style="flex:1"></div>
			<button class="btn btn-ghost btn-sm" onclick={closeDrawer}>Close</button>
		</div>
	</div>
</div>
