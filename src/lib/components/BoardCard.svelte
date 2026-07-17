<script lang="ts">
	import type { Issue, User } from '$lib/types';
	import { STATUS_META } from '$lib/status';
	import Avatar from './Avatar.svelte';
	import AppChip from './AppChip.svelte';
	import PriorityMeter from './PriorityMeter.svelte';

	let {
		issue,
		users,
		appColor,
		onOpen
	}: {
		issue: Issue;
		users: User[];
		appColor?: string;
		onOpen: (issue: Issue) => void;
	} = $props();

	const assignee = $derived(users.find((u) => u.id === issue.assigneeId));
</script>

<div
	class="bcard"
	style="border-left-color:{STATUS_META[issue.status].color}"
	role="button"
	tabindex="0"
	draggable="true"
	ondragstart={(e) => e.dataTransfer?.setData('text/issue-id', issue.id)}
	onclick={() => onOpen(issue)}
	onkeydown={(e) => e.key === 'Enter' && onOpen(issue)}
>
	<div class="bc-top">
		<span class="bc-id">{issue.id}</span>
		<PriorityMeter priority={issue.priority} />
	</div>
	<div class="bc-title">{issue.title}</div>
	<div class="bc-foot">
		<AppChip name={issue.appName} color={appColor} />
		<span class="sp"></span>
		<Avatar user={assignee} />
	</div>
</div>
