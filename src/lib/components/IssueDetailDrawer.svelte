<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import type { Application, Issue, User } from '$lib/types';
	import { STATUS_ORDER, STATUS_META } from '$lib/status';
	import { SOURCE_META } from '$lib/source';
	import { PRIORITY_META } from '$lib/priority';
	import { fmtDate, fmtDateTime, fmtWhen } from '$lib/format';
	import { postAction } from '$lib/actions';
	import { singleIssueMarkdown } from '$lib/export/copyIssue';
	import { toast } from '$lib/stores/toasts.svelte';
	import { closeDrawer, openEditIssue, openLightbox, ui } from '$lib/stores/ui.svelte';
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

	// Comments live in the same activity log as everything else; they just get
	// their own section, with the body rendered as Markdown the way the
	// description is. The timeline below then shows only what happened *to* the
	// issue, so nothing appears twice.
	const comments = $derived(
		issue.activity
			.filter((a) => a.kind === 'comment' && a.message)
			.map((a) => ({
				id: a.id,
				by: a.by,
				at: a.at,
				html: DOMPurify.sanitize(marked.parse(a.message!, { async: false }))
			}))
	);
	const history = $derived(issue.activity.filter((a) => a.kind !== 'comment'));

	let draft = $state('');
	let posting = $state(false);

	async function postComment() {
		const message = draft.trim();
		if (!message || posting) return;
		posting = true;
		try {
			const result = await postAction('comment', { id: issue.id, message });
			if (result.type === 'success') {
				const updated = result.data?.issue as Issue | undefined;
				if (updated) ui.drawerIssue = updated;
				draft = '';
				await invalidateAll();
				toast('Comment added', `Posted on ${issue.id}.`);
			} else {
				toast('Could not add comment', 'Nothing was saved — try again.');
			}
		} finally {
			posting = false;
		}
	}

	function composerKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			postComment();
			return;
		}
		// Escape leaves the composer rather than closing the drawer out from
		// under a half-written comment; a second press closes as usual.
		if (e.key === 'Escape' && draft.trim()) {
			e.stopPropagation();
			(e.currentTarget as HTMLTextAreaElement).blur();
		}
	}

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
			{#if issue.testCaseId}
				{#if page.data.checkpointUrl}
					<a class="test-origin" href="{page.data.checkpointUrl}/cases?case={issue.testCaseId}">
						<Icon name="task" />
						<span>Filed from test <b>{issue.testCaseId}</b>{issue.runId ? ` · run ${issue.runId}` : ''} — open in Checkpoint</span>
					</a>
				{:else}
					<span class="test-origin static">
						<Icon name="task" />
						<span>Filed from test <b>{issue.testCaseId}</b>{issue.runId ? ` · run ${issue.runId}` : ''}</span>
					</span>
				{/if}
			{/if}
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
				<div class="row"><span class="rk">Module</span><span class="rv">{issue.moduleName ?? '—'}</span></div>
				<div class="row">
					<span class="rk">Source</span>
					<span class="rv" title={SOURCE_META[issue.source].description}>
						<span class="app-dot" style="background:{SOURCE_META[issue.source].color}"></span
						>{SOURCE_META[issue.source].label}
					</span>
				</div>
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
					<span class="rk">Reported</span>
					<span class="rv" title={fmtDateTime(issue.createdAt)}>
						{fmtWhen(issue.createdAt)}
						<span style="color:var(--faint);font-size:12px">· {fmtDateTime(issue.createdAt)}</span>
					</span>
				</div>
				<div class="row">
					<span class="rk">Last modified</span>
					<span class="rv" title={fmtDateTime(issue.updatedAt)}>
						{fmtWhen(issue.updatedAt)}
						<span style="color:var(--faint);font-size:12px">· {fmtDateTime(issue.updatedAt)}</span>
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
						{#if att.kind === 'image'}
							<button
								type="button"
								class="gal-item"
								onclick={() => openLightbox(issue.attachments, att)}
							>
								<div class="gal-thumb img">
									<img src={att.url} alt={att.filename} loading="lazy" />
								</div>
								<div class="gal-name">{att.filename}</div>
							</button>
						{:else}
							<a class="gal-item" href={att.url} target="_blank" rel="noopener">
								<div class="gal-thumb pdf"><Icon name="file-lt" /></div>
								<div class="gal-name">{att.filename}</div>
							</a>
						{/if}
					{/each}
				</div>
			{/if}
			<div class="dr-sec-t">Comments{comments.length ? ` · ${comments.length}` : ''}</div>
			<div class="cm-list">
				{#each comments as c (c.id)}
					<article class="cm">
						<div class="cm-head">
							<Avatar user={users.find((u) => u.id === c.by)} size={22} />
							<b>{userName(c.by)}</b>
							<span class="cm-when" title={fmtDateTime(c.at)}>{fmtWhen(c.at)}</span>
						</div>
						<!-- eslint-disable-next-line svelte/no-at-html-tags — sanitised via DOMPurify -->
						<div class="cm-body">{@html c.html}</div>
					</article>
				{:else}
					<p class="cm-none">No comments yet — add the first one.</p>
				{/each}
			</div>
			<form
				class="cm-new"
				onsubmit={(e) => {
					e.preventDefault();
					postComment();
				}}
			>
				<textarea
					class="ta"
					bind:value={draft}
					onkeydown={composerKeydown}
					placeholder="Add a comment…"
					aria-label="Add a comment"
				></textarea>
				<div class="cm-actions">
					<span class="cm-hint">Markdown supported · Ctrl + Enter to post</span>
					<button class="btn btn-primary btn-sm" type="submit" disabled={posting || !draft.trim()}>
						{posting ? 'Posting…' : 'Comment'}
					</button>
				</div>
			</form>

			<div class="dr-sec-t">Activity</div>
			<div class="timeline">
				{#each history as entry (entry.id)}
					{#if entry.kind === 'created'}
						<div class="tl-item">
							<div class="tl-txt"><b>{userName(entry.by)}</b> created this issue</div>
							<div class="tl-time">{fmtDate(entry.at)} · via IssueDesk</div>
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

<style>
	.cm-list {
		margin-bottom: 14px;
	}
	.cm {
		border: 1px solid var(--line);
		border-radius: 11px;
		background: var(--surface-2);
		padding: 11px 13px;
		margin-bottom: 10px;
	}
	.cm-head {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12.5px;
		color: var(--ink);
		margin-bottom: 6px;
	}
	.cm-when {
		margin-left: auto;
		font-size: 11px;
		color: var(--faint);
		font-weight: 400;
	}
	.cm-none {
		margin: 0 0 4px;
		font-size: 12.5px;
		color: var(--faint);
	}
	.cm-new {
		margin-bottom: 24px;
	}
	.cm-new .ta {
		min-height: 74px;
	}
	.cm-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
	}
	.cm-hint {
		flex: 1;
		font-size: 11px;
		color: var(--faint);
	}
	.test-origin {
		display: flex;
		align-items: center;
		gap: 9px;
		background: #e0f5f3;
		border: 1px solid #b8e6e1;
		border-radius: 11px;
		padding: 10px 13px;
		margin-bottom: 16px;
		font-size: 12.5px;
		color: #0b6a62;
		text-decoration: none;
	}
	.test-origin :global(svg) {
		width: 15px;
		height: 15px;
		flex: 0 0 15px;
	}
	.test-origin b {
		font-family: var(--font-mono);
	}
	.test-origin:hover {
		border-color: #0d9488;
	}
</style>
