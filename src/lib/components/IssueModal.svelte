<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type {
		Application,
		Attachment,
		Category,
		Issue,
		IssueType,
		Priority,
		RefineMode,
		Status
	} from '$lib/types';
	import type { User } from '$lib/types';
	import { PRIORITIES, STATUSES } from '$lib/types';
	import { PRIORITY_META } from '$lib/priority';
	import { STATUS_META } from '$lib/status';
	import { toast } from '$lib/stores/toasts.svelte';
	import { clearDraft, draftAge, draftKey, loadDraft, saveDraft } from '$lib/stores/drafts';
	import {
		closeIssueModal,
		registerIssueModalGuard,
		requestCloseIssueModal
	} from '$lib/stores/ui.svelte';
	import AttachmentDropzone from './AttachmentDropzone.svelte';
	import Icon from './Icon.svelte';
	import PriorityMeter from './PriorityMeter.svelte';

	let {
		mode,
		applications,
		categories,
		users,
		currentUserId
	}: {
		mode: { mode: 'new' } | { mode: 'edit'; issue: Issue };
		applications: Application[];
		categories: Category[];
		users: User[];
		currentUserId: string;
	} = $props();

	const editing = $derived(mode.mode === 'edit' ? mode.issue : null);

	// Draft state, pre-filled when editing.
	let type = $state<IssueType>('bug');
	let appId = $state('');
	let moduleId = $state('');
	let pageText = $state('');
	let formText = $state('');
	let title = $state('');
	let description = $state('');
	let priority = $state<Priority>('high');
	let status = $state<Status>('open');
	let assigneeId = $state('');
	let categoryId = $state('');
	let tags = $state('');
	let attachments = $state<Attachment[]>([]);
	let fieldErrors = $state<Record<string, string>>({});
	let saving = $state(false);

	const draftId = crypto.randomUUID();

	// Only assignable users appear in the assignee list; reporters can be anyone.
	const assignees = $derived(users.filter((u) => u.assignable));

	// ---------- Unsaved-work protection ----------
	// Everything the user can type, as one comparable value. `dirty` is this
	// against the baseline captured when the form opened, so a dismissal only
	// interrupts when there is genuinely something to lose.
	function snapshot(): string {
		return JSON.stringify({
			type,
			appId,
			moduleId,
			pageText,
			formText,
			title,
			description,
			priority,
			status,
			assigneeId,
			categoryId,
			tags,
			attachments
		});
	}

	function restore(fields: Record<string, unknown>): void {
		const s = (v: unknown) => (typeof v === 'string' ? v : '');
		type = (fields.type as IssueType) ?? 'bug';
		appId = s(fields.appId);
		moduleId = s(fields.moduleId);
		pageText = s(fields.pageText);
		formText = s(fields.formText);
		title = s(fields.title);
		description = s(fields.description);
		priority = (fields.priority as Priority) ?? 'high';
		status = (fields.status as Status) ?? 'open';
		assigneeId = s(fields.assigneeId);
		categoryId = s(fields.categoryId);
		tags = s(fields.tags);
		attachments = Array.isArray(fields.attachments) ? (fields.attachments as Attachment[]) : [];
	}

	const key = $derived(draftKey(editing?.id));
	let baseline = $state('');
	let confirming = $state(false);
	let primed = false; // deliberately not reactive — this must run exactly once

	$effect.pre(() => {
		if (primed) return;
		primed = true;
		if (editing) {
			type = editing.type;
			appId = editing.appId;
			moduleId = editing.moduleId ?? '';
			pageText = editing.pagePath ?? editing.pageName ?? '';
			formText = editing.formName ?? '';
			title = editing.title;
			description = editing.description;
			priority = editing.priority;
			status = editing.status;
			assigneeId = editing.assigneeId ?? '';
			categoryId = editing.categoryId ?? '';
			tags = editing.tags.join(', ');
			attachments = [...editing.attachments];
		}
		// A draft always wins over the stored issue — it is the newer edit, and
		// it only exists because the user chose to keep it.
		const draft = loadDraft(draftKey(editing?.id));
		if (draft) {
			restore(draft.fields);
			toast('Draft restored', `Unsaved changes from ${draftAge(draft.savedAt)}.`);
		}
		baseline = snapshot();
	});

	const dirty = $derived(baseline !== '' && snapshot() !== baseline);

	/**
	 * Returns true when it has taken over the close. Registered with the UI
	 * store so Escape, the backdrop, the X and Cancel all route through here.
	 */
	function guardClose(): boolean {
		if (!dirty) return false;
		confirming = true;
		return true;
	}

	$effect(() => {
		registerIssueModalGuard(guardClose);
		return () => registerIssueModalGuard(null);
	});

	function keepDraft(): void {
		saveDraft(key, JSON.parse(snapshot()));
		confirming = false;
		closeIssueModal();
		toast('Draft saved', 'Reopen the form to pick up where you left off.');
	}

	function discardChanges(): void {
		clearDraft(key);
		confirming = false;
		closeIssueModal();
	}

	// ---------- Generative AI: refine + tag suggestions ----------
	const REFINE_MODES: { mode: RefineMode; label: string; blurb: string }[] = [
		{ mode: 'clarify', label: 'Clarify', blurb: 'Remove ambiguity, tighten wording — no new facts.' },
		{
			mode: 'itemize',
			label: 'Rephrase & itemize',
			blurb: 'Fix spelling, make it coherent, split into bullets with bold headers.'
		},
		{ mode: 'repro', label: 'Repro steps', blurb: 'Summary / Steps / Expected / Actual sections.' },
		{ mode: 'structure', label: 'Structure', blurb: 'Headings and bullets; keep every detail.' },
		{ mode: 'concise', label: 'Concise', blurb: 'Cut filler; keep every concrete fact.' },
		{ mode: 'strengthen', label: 'Strengthen', blurb: 'Make it specific and actionable.' },
		{ mode: 'custom', label: 'Custom…', blurb: 'Your own instruction.' }
	];
	let refineOpen = $state(false);
	let refineBusy = $state(false);
	let refineMode = $state<RefineMode>('clarify');
	let customInstruction = $state('');
	let refinePreview = $state<string | null>(null);
	let refineModelLabel = $state('');

	async function runRefine(mode: RefineMode) {
		if (!description.trim()) {
			toast('Nothing to refine', 'Write a description first.');
			return;
		}
		refineMode = mode;
		if (mode === 'custom' && !customInstruction.trim()) return; // wait for the instruction
		refineBusy = true;
		try {
			const res = await fetch('/api/ai/refine', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ description, mode, instruction: customInstruction.trim() || undefined })
			});
			const body = await res.json();
			if (!res.ok) {
				toast('Refine failed', String(body.message ?? res.statusText));
				return; // original description untouched
			}
			refinePreview = body.refined;
			refineModelLabel = body.model ?? '';
		} catch (e) {
			toast('Refine failed', String((e as Error).message ?? e));
		} finally {
			refineBusy = false;
		}
	}

	function applyRefine() {
		if (refinePreview !== null) description = refinePreview;
		refinePreview = null;
		refineOpen = false;
		toast('Description updated', 'Review it, then save the issue to persist.');
	}

	function discardRefine() {
		refinePreview = null;
	}

	let taggingBusy = $state(false);
	let tagSuggestions = $state<{ slug: string; label: string }[] | null>(null);

	async function suggestTags() {
		if (!title.trim() && !description.trim()) {
			toast('Nothing to tag', 'Add a title or description first.');
			return;
		}
		taggingBusy = true;
		try {
			const res = await fetch('/api/ai/extract-tags', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title, description })
			});
			const body = await res.json();
			if (!res.ok) {
				toast('Tag suggestion failed', String(body.message ?? res.statusText));
				return; // existing tags untouched
			}
			tagSuggestions = body.tags ?? [];
			if (tagSuggestions && tagSuggestions.length === 0) toast('No tags suggested', 'Try adding more detail.');
		} catch (e) {
			toast('Tag suggestion failed', String((e as Error).message ?? e));
		} finally {
			taggingBusy = false;
		}
	}

	function currentTagSet(): string[] {
		return tags
			.split(',')
			.map((t) => t.trim().toLowerCase())
			.filter(Boolean);
	}

	function addTag(slug: string) {
		const set = currentTagSet();
		if (!set.includes(slug.toLowerCase())) {
			tags = [...set, slug].join(', ');
		}
		if (tagSuggestions) tagSuggestions = tagSuggestions.filter((t) => t.slug !== slug);
	}

	function addAllTags() {
		for (const t of tagSuggestions ?? []) addTag(t.slug);
		tagSuggestions = [];
	}

	const app = $derived(applications.find((a) => a.id === appId));

	const nextIdPreview = $derived(
		editing ? editing.id : appId ? ((page.data.nextIds as Record<string, string>)?.[appId] ?? '—') : '—'
	);

	function onAppChange() {
		moduleId = '';
	}
</script>

<div
	class="backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) requestCloseIssueModal();
	}}
>
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title">
		<div class="modal-head">
			<div class="mh-icon"><Icon name="task" /></div>
			<div>
				<h2 id="issue-modal-title">{editing ? `Edit ${editing.id}` : 'New issue'}</h2>
				<div class="mh-sub">
					{editing
						? `${editing.appName}${editing.moduleName ? ` / ${editing.moduleName}` : ''}`
						: 'Capture a bug or feature request'}
				</div>
			</div>
			<button class="x" onclick={requestCloseIssueModal} aria-label="Close"><Icon name="x" /></button>
		</div>
		<form
			method="POST"
			action={editing ? '/issues?/updateIssue' : '/issues?/createIssue'}
			use:enhance={() => {
				saving = true;
				return async ({ result }) => {
					saving = false;
					if (result.type === 'success') {
						const issue = result.data?.issue as Issue | undefined;
						clearDraft(key); // the work is persisted; the draft is now noise
						closeIssueModal();
						await invalidateAll();
						if (editing) {
							toast(`Saved ${issue?.id ?? ''}`.trim(), `Changes written to ${issue?.appCode.toLowerCase()} module file.`);
						} else if (issue) {
							toast(`Created ${issue.id}`, `${issue.seq} → data/issues/${issue.appId}/${issue.moduleId ?? 'unassigned'}.json`);
						}
					} else if (result.type === 'failure') {
						fieldErrors = (result.data?.fieldErrors as Record<string, string>) ?? {};
						if (fieldErrors.form) toast('Could not save', fieldErrors.form);
						else toast('Missing required fields', 'Application and title are required.');
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
						<label for="f-module">Module <span class="hint">· optional</span></label>
						<select class="sel" id="f-module" name="moduleId" bind:value={moduleId} disabled={!app}>
							<!-- Blank is a real answer: an issue often arrives before anyone
							     knows which module owns it, and a wrong guess is worse. -->
							<option value="">All modules / not sure yet</option>
							{#each app?.modules ?? [] as m (m.id)}
								<option value={m.id}>{m.name}</option>
							{/each}
						</select>
						{#if fieldErrors.moduleId}<span class="err">{fieldErrors.moduleId}</span>{/if}
					</div>
					<div class="field">
						<label for="f-page">Page <span class="hint">· free text</span></label>
						<input
							class="inp"
							id="f-page"
							name="page"
							bind:value={pageText}
							placeholder="e.g. /login or Login screen"
						/>
					</div>
					<div class="field">
						<label for="f-form">Form <span class="hint">· free text</span></label>
						<input
							class="inp"
							id="f-form"
							name="form"
							bind:value={formText}
							placeholder="e.g. OTP Verification"
						/>
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
						<label for="f-desc">
							Description <span class="hint">· Markdown supported</span>
							<button
								type="button"
								class="ai-btn"
								onclick={() => (refineOpen = !refineOpen)}
								aria-expanded={refineOpen}
							>
								<Icon name="sparkle" />Refine with AI
							</button>
						</label>

						{#if refineOpen}
							<div class="ai-panel">
								<div class="ai-modes">
									{#each REFINE_MODES as m (m.mode)}
										<button
											type="button"
											class="ai-mode"
											class:on={refineMode === m.mode}
											title={m.blurb}
											disabled={refineBusy}
											onclick={() => runRefine(m.mode)}
										>
											{m.label}
										</button>
									{/each}
								</div>
								{#if refineMode === 'custom'}
									<div class="ai-custom">
										<input
											class="inp"
											placeholder="e.g. rewrite for a non-technical stakeholder"
											bind:value={customInstruction}
										/>
										<button class="btn btn-primary btn-sm" type="button" disabled={refineBusy || !customInstruction.trim()} onclick={() => runRefine('custom')}>
											{refineBusy ? 'Refining…' : 'Refine'}
										</button>
									</div>
								{/if}
								{#if refineBusy}
									<div class="ai-status">Refining with Claude…</div>
								{/if}
								{#if refinePreview !== null}
									<div class="ai-preview">
										<div class="ai-preview-head">
											Suggested rewrite {#if refineModelLabel}<span class="ai-model">· {refineModelLabel}</span>{/if}
										</div>
										<pre class="ai-preview-body">{refinePreview}</pre>
										<div class="ai-preview-actions">
											<button class="btn btn-primary btn-sm" type="button" onclick={applyRefine}>Apply</button>
											<button class="btn btn-ghost btn-sm" type="button" onclick={discardRefine}>Discard</button>
										</div>
									</div>
								{/if}
							</div>
						{/if}

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
							{#each STATUSES as s (s)}
								<button
									type="button"
									class="status-opt {STATUS_META[s].pickerClass}"
									class:on={status === s}
									onclick={() => (status = s)}
								>
									<span class="dot" style="background:{STATUS_META[s].color}"></span>
									{STATUS_META[s].shortLabel}
								</button>
							{/each}
						</div>
					</div>

					<div class="field">
						<label for="f-assignee">Assignee</label>
						<select class="sel" id="f-assignee" name="assigneeId" bind:value={assigneeId}>
							<option value="">Unassigned</option>
							{#each assignees as u (u.id)}
								<option value={u.id}>{u.name}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="f-category">
							Category <span class="hint">· what it's about</span>
						</label>
						<select class="sel" id="f-category" name="categoryId" bind:value={categoryId}>
							<option value="">Uncategorised</option>
							{#each categories as c (c.id)}
								<option value={c.id} title={c.description}>{c.name}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="f-tags">
							Tags <span class="hint">· comma-separated</span>
							<button type="button" class="ai-btn" disabled={taggingBusy} onclick={suggestTags}>
								<Icon name="sparkle" />{taggingBusy ? 'Suggesting…' : 'Suggest'}
							</button>
						</label>
						<input class="inp" id="f-tags" name="tags" bind:value={tags} placeholder="auth, regression" />
						{#if tagSuggestions && tagSuggestions.length}
							<div class="tag-suggest">
								{#each tagSuggestions as t (t.slug)}
									<button type="button" class="tag-sug" onclick={() => addTag(t.slug)}>
										<Icon name="plus" />{t.label}
									</button>
								{/each}
								<button type="button" class="tag-sug all" onclick={addAllTags}>Add all</button>
							</div>
						{/if}
					</div>

					<div class="field full">
						<label for="f-dz">Attachments <span class="hint">· PNG, JPG, WEBP, GIF, PDF, HTML, ZIP, DOC, DOCX · max 15 MB each</span></label>
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
					<button type="button" class="btn btn-ghost" onclick={requestCloseIssueModal}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{editing ? 'Save changes' : 'Create issue'}
				</button>
			</div>
		</form>

		{#if confirming}
			<!-- Sits inside the dialog rather than over the page: the half-typed
			     issue stays visible behind it, so the choice is made in context. -->
			<div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
				<div class="confirm-card">
					<h3 id="discard-title">Keep your changes?</h3>
					<p>
						{editing ? `Your edits to ${editing.id} haven't been saved.` : "This issue hasn't been created yet."}
						Save it as a draft and it will be waiting when you reopen the form.
					</p>
					<div class="confirm-actions">
						<button type="button" class="btn btn-ghost danger" onclick={discardChanges}>
							Discard changes
						</button>
						<div class="ff"></div>
						<button type="button" class="btn btn-ghost" onclick={() => (confirming = false)}>
							Keep editing
						</button>
						<button type="button" class="btn btn-primary" onclick={keepDraft}>Save draft</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.confirm {
		position: absolute;
		inset: 0;
		background: rgba(16, 23, 38, 0.34);
		backdrop-filter: blur(2px);
		border-radius: 16px;
		display: grid;
		place-items: center;
		padding: 20px;
		z-index: 2;
	}
	.confirm-card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 20px 22px;
		max-width: 420px;
	}
	.confirm-card h3 {
		font-family: var(--font-display);
		font-size: 16px;
		margin: 0 0 6px;
	}
	.confirm-card p {
		margin: 0 0 16px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--muted);
	}
	.confirm-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.confirm-actions .ff {
		flex: 1;
	}
	.danger {
		color: var(--open);
	}
	.ai-btn {
		float: right;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11.5px;
		font-weight: 600;
		color: var(--accent-ink);
		background: var(--accent-soft-2);
		border: 1px solid var(--accent-soft);
		border-radius: 999px;
		padding: 2px 9px;
		cursor: pointer;
	}
	.ai-btn:hover:not(:disabled) {
		background: var(--accent-soft);
	}
	.ai-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.ai-btn :global(svg) {
		width: 13px;
		height: 13px;
	}
	.ai-panel {
		border: 1px solid var(--accent-soft);
		background: var(--accent-soft-2);
		border-radius: 10px;
		padding: 10px;
		margin: 6px 0 8px;
	}
	.ai-modes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.ai-mode {
		font-size: 12px;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--accent-soft);
		background: #fff;
		cursor: pointer;
	}
	.ai-mode.on {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}
	.ai-mode:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.ai-custom {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
	.ai-status {
		font-size: 12px;
		color: var(--muted);
		margin-top: 8px;
	}
	.ai-preview {
		margin-top: 10px;
		background: #fff;
		border: 1px solid var(--accent-soft);
		border-radius: 8px;
		overflow: hidden;
	}
	.ai-preview-head {
		font-size: 11.5px;
		font-weight: 600;
		color: var(--muted);
		padding: 8px 10px;
		border-bottom: 1px solid var(--accent-soft);
	}
	.ai-model {
		font-weight: 400;
		color: var(--faint);
		font-family: var(--font-mono);
	}
	.ai-preview-body {
		margin: 0;
		padding: 10px;
		max-height: 220px;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 12.5px;
		font-family: inherit;
		line-height: 1.5;
	}
	.ai-preview-actions {
		display: flex;
		gap: 8px;
		padding: 8px 10px;
		border-top: 1px solid var(--accent-soft);
	}
	.tag-suggest {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}
	.tag-sug {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 12px;
		padding: 3px 9px;
		border-radius: 999px;
		border: 1px dashed var(--accent-soft);
		background: #fff;
		color: var(--accent-ink);
		cursor: pointer;
	}
	.tag-sug:hover {
		background: var(--accent-soft-2);
	}
	.tag-sug.all {
		border-style: solid;
		font-weight: 600;
	}
	.tag-sug :global(svg) {
		width: 12px;
		height: 12px;
	}
</style>
