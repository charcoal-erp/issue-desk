<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { Issue, Status } from '$lib/types';
	import { STATUSES } from '$lib/types';
	import { STATUS_META } from '$lib/status';
	import { priorityRank } from '$lib/priority';
	import { postAction } from '$lib/actions';
	import { toast } from '$lib/stores/toasts.svelte';
	import { openDrawer } from '$lib/stores/ui.svelte';
	import BoardCard from '$lib/components/BoardCard.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	let dragTarget = $state<Status | null>(null);

	const appColor = $derived(new Map(data.applications.map((a) => [a.id, a.color] as const)));

	function column(status: Status): Issue[] {
		return data.rows
			.filter((i) => i.status === status)
			.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
	}

	async function onDrop(e: DragEvent, status: Status) {
		e.preventDefault();
		dragTarget = null;
		const id = e.dataTransfer?.getData('text/issue-id');
		if (!id) return;
		const issue = data.rows.find((i) => i.id === id);
		if (!issue || issue.status === status) return;
		const result = await postAction('changeStatus', { id, status });
		if (result.type === 'success') {
			await invalidateAll();
			toast(`${id} → ${STATUS_META[status].label}`, 'Status updated');
		} else {
			toast('Could not update status', '');
		}
	}
</script>

<section class="screen screen-board">
	<div style="flex:1;display:flex;flex-direction:column;min-width:0">
		<div class="board-head">
			<h1>Board</h1>
			<span class="count">{data.total} {data.total === 1 ? 'issue' : 'issues'}</span>
			<div style="flex:1"></div>
			<a class="btn btn-ghost btn-sm" href="/issues">
				<Icon name="rows" />
				Table view
			</a>
		</div>
		<div class="board">
			{#each STATUSES as status (status)}
				{@const items = column(status)}
				<div
					class="bcol"
					class:drop-target={dragTarget === status}
					role="list"
					ondragover={(e) => {
						e.preventDefault();
						dragTarget = status;
					}}
					ondragleave={() => (dragTarget = null)}
					ondrop={(e) => onDrop(e, status)}
				>
					<div class="bcol-head">
						<span class="dot" style="background:{STATUS_META[status].color}"></span>
						<span class="t">{STATUS_META[status].label}</span>
						<span class="c">{items.length}</span>
					</div>
					<div class="bcol-body">
						{#each items as issue (issue.id)}
							<BoardCard
								{issue}
								users={data.users}
								appColor={appColor.get(issue.appId)}
								onOpen={(i) => openDrawer(i)}
							/>
						{:else}
							<div class="bcol-empty">Nothing here</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.bcol.drop-target {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-soft);
	}
</style>
