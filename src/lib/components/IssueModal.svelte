<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { Application, Attachment, Issue, IssueType, Priority, Status } from '$lib/types';
	import type { User } from '$lib/types';
	import { PRIORITIES, STATUSES } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import { toast } from '$lib/stores/toasts.svelte';
	import { closeIssueModal } from '$lib/stores/ui.svelte';
	import AttachmentDropzone from './AttachmentDropzone.svelte';
	import Icon from './Icon.svelte';
	import PriorityMeter from './PriorityMeter.svelte';

	let {
		mode,
		applications,
		users,
		currentUserId
	}: {
		mode: { mode: 'new' } | { mode: 'edit'; issue: Issue };
		applications: Application[];
		users: User[];
		currentUserId: string;
	} = $props();

	const editing = $derived(mode.mode === 'edit' ? mode.issue : null);

	// Draft state, pre-filled when editing.
	let type = $state<IssueType>('bug');
	let appId = $state('');
	let moduleId = $state('');
	let pageId = $state('');
	let formId = $state('');
	let title = $state('');
	let description = $state('');
	let priority = $state<Priority>('high');
	let status = $state<Status>('open');
	let assigneeId = $state('');
	let tags = $state('');
	let attachments = $state<Attachment[]>([]);
	let fieldErrors = $state<Record<string, string>>({});
	let saving = $state(false);

	const draftId = crypto.randomUUID();

	$effect.pre(() => {
		if (editing) {
			type = editing.type;
			appId = editing.appId;
			moduleId = editing.moduleId;
			pageId = editing.pageId ?? '';
			formId = editing.formId ?? '';
			title = editing.title;
			description = editing.description;
			priority = editing.priority;
			status = editing.status;
			assigneeId = editing.assigneeId ?? '';
			tags = editing.tags.join(', ');
			attachments = [...editing.attachments];
		}
	});

	const app = $derived(applications.find((a) => a.id === appId));
	const module_ = $derived(app?.modules.find((m) => m.id === moduleId));
	const pageRef = $derived(module_?.pages.find((p) => p.id === pageId));

	const nextIdPreview = $derived(
		editing ? editing.id : appId ? ((page.data.nextIds as Record<string, string>)?.[appId] ?? '—') : '—'
	);

	function onAppChange() {
		moduleId = '';
		pageId = '';
		formId = '';
	}
	function onModuleChange() {
		pageId = '';
		formId = '';
	}
	function onPageChange() {
		formId = '';
	}
</script>

<div
	class="backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) closeIssueModal();
	}}
>
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title">
		<div class="modal-head">
			<div class="mh-icon"><Icon name="task" /></div>
			<div>
				<h2 id="issue-modal-title">{editing ? `Edit ${editing.id}` : 'New issue'}</h2>
				<div class="mh-sub">
					{editing ? `${editing.appName} / ${editing.moduleName}` : 'Capture a bug or feature request'}
				</div>
			</div>
			<button class="x" onclick={closeIssueModal} aria-label="Close"><Icon name="x" /></button>
		</div>
		<form
			method="POST"
			action={editing ? '/?/updateIssue' : '/?/createIssue'}
			use:enhance={() => {
				saving = true;
				return async ({ result }) => {
					saving = false;
					if (result.type === 'success') {
						const issue = result.data?.issue as Issue | undefined;
						closeIssueModal();
						await invalidateAll();
						if (editing) {
							toast(`Saved ${issue?.id ?? ''}`.trim(), `Changes written to ${issue?.appCode.toLowerCase()} module file.`);
						} else if (issue) {
							toast(`Created ${issue.id}`, `${issue.seq} → data/issues/${issue.appId}/${issue.moduleId}.json`);
						}
					} else if (result.type === 'failure') {
						fieldErrors = (result.data?.fieldErrors as Record<string, string>) ?? {};
						if (fieldErrors.form) toast('Could not save', fieldErrors.form);
						else toast('Missing required fields', 'App, module and title are required.');
					}
				};
			}}
		>
			{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
			<input type="hidden" name="type" value={type} />
			<input type="hidden" name="priority" value={priority} />
			<input type="hidden" name="status" value={status} />
			<input type="hidden" name="draftId" value={draftId} />
			<input type="hidden" name="attachments" value={JSON.stringify(attachments)} />

			<div class="modal-body">
				<div class="form-grid">
					<div class="field full">
						<label for="f-type">Type</label>
						<div class="type-picker" id="f-type">
							<button type="button" class="type-opt" class:on={type === 'bug'} onclick={() => (type = 'bug')}>
								<Icon name="bug" />
								Bug
							</button>
							<button
								type="button"
								class="type-opt"
								class:on={type === 'feature'}
								onclick={() => (type = 'feature')}
							>
								<Icon name="feature" />
								Feature
							</button>
						</div>
					</div>

					<div class="field">
						<label for="f-app">Application <span class="req">*</span></label>
						<select class="sel" id="f-app" name="appId" bind:value={appId} onchange={onAppChange}>
							<option value="">Select application…</option>
							{#each applications as a (a.id)}
								<option value={a.id}>{a.name}</option>
							{/each}
						</select>
						{#if fieldErrors.appId}<span class="err">{fieldErrors.appId}</span>{/if}
					</div>
					<div class="field">
						<label for="f-module">Module <span class="req">*</span></label>
						<select
							class="sel"
							id="f-module"
							name="moduleId"
							bind:value={moduleId}
							onchange={onModuleChange}
							disabled={!app}
						>
							<option value="">{app ? 'Select module…' : 'Select module…'}</option>
							{#each app?.modules ?? [] as m (m.id)}
								<option value={m.id}>{m.name}</option>
							{/each}
						</select>
						{#if fieldErrors.moduleId}<span class="err">{fieldErrors.moduleId}</span>{/if}
					</div>
					<div class="field">
						<label for="f-page">Page</label>
						<select
							class="sel"
							id="f-page"
							name="pageId"
							bind:value={pageId}
							onchange={onPageChange}
							disabled={!module_}
						>
							<option value="">{module_ ? 'Select page…' : '—'}</option>
							{#each module_?.pages ?? [] as p (p.id)}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="f-form">Form</label>
						<select
							class="sel"
							id="f-form"
							name="formId"
							bind:value={formId}
							disabled={!pageRef || !pageRef.forms.length}
						>
							<option value="">{pageRef?.forms.length ? 'Select form…' : '—'}</option>
							{#each pageRef?.forms ?? [] as f (f.id)}
								<option value={f.id}>{f.name}</option>
							{/each}
						</select>
					</div>

					<div class="field full">
						<label for="f-title">Title <span class="req">*</span></label>
						<input
							class="inp"
							id="f-title"
							name="title"
							bind:value={title}
							placeholder="Short, specific summary — e.g. “Login fails with a valid OTP”"
						/>
						{#if fieldErrors.title}<span class="err">{fieldErrors.title}</span>{/if}
					</div>

					<div class="field full">
						<label for="f-desc">Description <span class="hint">· Markdown supported</span></label>
						<textarea
							class="ta"
							id="f-desc"
							name="description"
							bind:value={description}
							placeholder={'What happens, what you expected, and steps to reproduce…\n\n1. Go to /login\n2. Enter a valid OTP\n3. …'}
						></textarea>
					</div>

					<div class="field">
						<label for="f-prio">Priority <span class="req">*</span></label>
						<div class="prio-picker" id="f-prio">
							{#each PRIORITIES as p (p)}
								<button type="button" class="prio-opt" class:on={priority === p} onclick={() => (priority = p)}>
									<PriorityMeter priority={p} variant="pm" />
									<span class="pl">{PRIORITY_META[p].label}</span>
								</button>
							{/each}
						</div>
					</div>
					<div class="field">
						<label for="f-status">Status</label>
						<div class="status-picker" id="f-status">
							{#each STATUSES as s, i (s)}
								<button
									type="button"
									class="status-opt {['s-open', 's-impl', 's-done'][i]}"
									class:on={status === s}
									onclick={() => (status = s)}
								>
									<span class="dot" style="background:{STATUS_META[s].color}"></span>
									{s === 'open' ? 'Open' : s === 'implemented' ? 'Impl.' : 'Done'}
								</button>
							{/each}
						</div>
					</div>

					<div class="field">
						<label for="f-assignee">Assignee</label>
						<select class="sel" id="f-assignee" name="assigneeId" bind:value={assigneeId}>
							<option value="">Unassigned</option>
							{#each users as u (u.id)}
								<option value={u.id}>{u.name}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="f-tags">Tags <span class="hint">· comma-separated</span></label>
						<input class="inp" id="f-tags" name="tags" bind:value={tags} placeholder="auth, regression" />
					</div>

					<div class="field full">
						<label for="f-dz">Attachments <span class="hint">· PNG, JPG, WEBP, GIF, PDF · max 15 MB each</span></label>
						<AttachmentDropzone
							bind:attachments
							{appId}
							issueId={editing ? editing.id : 'pending'}
							{draftId}
						/>
					</div>
				</div>
			</div>
			<div class="modal-foot">
				<div class="ff">
					A per-app ID is assigned on create — e.g.
					<span style="font-family:var(--font-mono);color:var(--muted)">{nextIdPreview}</span>
				</div>
				<button type="button" class="btn btn-ghost" onclick={closeIssueModal}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{editing ? 'Save changes' : 'Create issue'}
				</button>
			</div>
		</form>
	</div>
</div>
