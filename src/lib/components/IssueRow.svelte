<script lang="ts">
	import type { Issue, User } from '$lib/types';
	import { columns } from '$lib/stores/columns.svelte';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import { fmtDateTime, fmtWhen } from '$lib/format';
	import Avatar from './Avatar.svelte';
	import AppChip from './AppChip.svelte';
	import Icon from './Icon.svelte';
	import PriorityMeter from './PriorityMeter.svelte';
	import StatusBadge from './StatusBadge.svelte';

	let {
		issue,
		users,
		appColor,
		onOpen,
		onEdit,
		onCopy
	}: {
		issue: Issue;
		users: User[];
		appColor?: string;
		onOpen: (issue: Issue) => void;
		onEdit: (issue: Issue) => void;
		onCopy: (issue: Issue) => void;
	} = $props();

	const assignee = $derived(users.find((u) => u.id === issue.assigneeId));
	const reporter = $derived(users.find((u) => u.id === issue.reporterId));

	// Cells are written in the same order as COLUMNS and gated on the same flags
	// as the headers; `visible` is read straight from the store rather than
	// threaded through as a prop, because it is one setting for the whole table.
	const visible = $derived(columns.visible);
</script>

<tr onclick={() => onOpen(issue)}>
	<td class="rail"><i style="background:{STATUS_META[issue.status].color}"></i></td>
	<td class="id-cell">{issue.id}</td>
	<td class="title-cell">
		<div class="t">{issue.title}</div>
		<div class="m">
			<span class="type-tag {issue.type === 'bug' ? 'type-bug' : 'type-feature'}">{issue.type}</span>
			<span class="path">{issue.pagePath || ''}{issue.formName ? ' · ' + issue.formName : ''}</span>
		</div>
	</td>
	{#if visible.app}
		<td>
			<AppChip name={issue.appName} color={appColor} />
			<div class="module-txt">{issue.moduleName ?? '—'}</div>
		</td>
	{/if}
	{#if visible.priority}
		<td>
			<span class="prio">
				<PriorityMeter priority={issue.priority} />
				<span class="lbl">{PRIORITY_META[issue.priority].label}</span>
			</span>
		</td>
	{/if}
	{#if visible.status}
		<td><StatusBadge status={issue.status} /></td>
	{/if}
	{#if visible.assignee}
		<td>
			<div class="assignee-cell">
				<Avatar user={assignee} />
				<span class="nm">{assignee ? assignee.name.split(' ')[0] : '—'}</span>
			</div>
		</td>
	{/if}
	{#if visible.reporter}
		<td>
			<div class="assignee-cell" title={reporter ? reporter.name : issue.reporterId}>
				<Avatar user={reporter} />
				<span class="nm">{reporter ? reporter.name.split(' ')[0] : issue.reporterId}</span>
			</div>
		</td>
	{/if}
	{#if visible.files}
		<td class="att-cell">
			{#if issue.attachments.length}
				<span class="att-pill"><Icon name="paperclip" />{issue.attachments.length}</span>
			{:else}
				<span class="att-none">—</span>
			{/if}
		</td>
	{/if}
	{#if visible.created}
		<td class="upd" title="Reported {fmtDateTime(issue.createdAt)}">{fmtWhen(issue.createdAt)}</td>
	{/if}
	{#if visible.updated}
		<td class="upd" title="Last modified {fmtDateTime(issue.updatedAt)}">{fmtWhen(issue.updatedAt)}</td>
	{/if}
	<td onclick={(e) => e.stopPropagation()}>
		<div class="row-actions">
			<button title="Edit" onclick={() => onEdit(issue)}><Icon name="edit" /></button>
			<button title="Copy for Claude Code" onclick={() => onCopy(issue)}><Icon name="copy" /></button>
		</div>
	</td>
</tr>
