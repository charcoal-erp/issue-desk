<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { Application, User } from '$lib/types';
	import { toast } from '$lib/stores/toasts.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	let tab = $state<'apps' | 'users'>('apps');
	let editor = $state<
		| null
		| { kind: 'user'; user: User | null }
		| { kind: 'app'; app: Application | null }
	>(null);

	function closeEditor() {
		editor = null;
	}
</script>

<section class="screen screen-admin">
	<div class="admin">
		<h1>Configuration</h1>
		<p class="sub">Reference data that powers the dropdowns. No database — these edit your JSON config files.</p>
		<div class="admin-note">
			<Icon name="warning" />
			<span>
				Saving here writes to <b>data/config/*.json</b>. Files stay human-readable and
				git-committable — you can also edit them by hand and the app re-syncs.
			</span>
		</div>
		<div class="admin-tabs">
			<button class="admin-tab" class:on={tab === 'apps'} onclick={() => (tab = 'apps')}>Applications</button>
			<button class="admin-tab" class:on={tab === 'users'} onclick={() => (tab = 'users')}>Users</button>
		</div>

		{#if tab === 'apps'}
			<div class="admin-panel on">
				<div class="admin-card-head">
					<h3>Applications, modules, pages &amp; forms</h3>
					<button class="btn btn-primary btn-sm" onclick={() => (editor = { kind: 'app', app: null })}>
						<Icon name="plus" />Add application
					</button>
				</div>
				<div class="data-card">
					<table>
						<thead>
							<tr><th>Application</th><th>Code</th><th>Modules</th><th>Open</th><th>Total</th></tr>
						</thead>
						<tbody>
							{#each data.applications as app (app.id)}
								<tr class="rowbtn" onclick={() => (editor = { kind: 'app', app })}>
									<td><AppChip name={app.name} color={app.color} bold /></td>
									<td><span class="code-badge">{app.code}</span></td>
									<td>
										<div class="mod-tags">
											{#each app.modules as m (m.id)}<span class="mod-tag">{m.name}</span>{/each}
										</div>
									</td>
									<td>{data.perApp[app.id]?.open ?? 0}</td>
									<td>{data.perApp[app.id]?.total ?? 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<div class="admin-panel on">
				<div class="admin-card-head">
					<h3>Users</h3>
					<button class="btn btn-primary btn-sm" onclick={() => (editor = { kind: 'user', user: null })}>
						<Icon name="plus" />Add user
					</button>
				</div>
				<div class="data-card">
					<table>
						<thead>
							<tr><th>Name</th><th>ID</th><th>Role</th><th>Assignable</th><th>Reported</th><th>Assigned</th></tr>
						</thead>
						<tbody>
							{#each data.users as user (user.id)}
								<tr class="rowbtn" onclick={() => (editor = { kind: 'user', user })}>
									<td><div class="assignee-cell"><Avatar {user} /><b>{user.name}</b></div></td>
									<td style="font-family:var(--font-mono);font-size:12px;color:var(--muted)">{user.id}</td>
									<td><span class="role-tag">{user.role}</span></td>
									<td>
										{#if user.assignable}<span class="role-tag" style="color:var(--accent-ink)">Yes</span
											>{:else}<span style="color:var(--faint)">—</span>{/if}
									</td>
									<td>{data.perUser[user.id]?.reported ?? 0}</td>
									<td>{data.perUser[user.id]?.assigned ?? 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</section>

{#if editor}
	{@const isUser = editor.kind === 'user'}
	{@const editingUser = editor.kind === 'user' ? editor.user : null}
	{@const editingApp = editor.kind === 'app' ? editor.app : null}
	<div
		class="backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeEditor();
		}}
	>
		<div class="modal" style="max-width:560px" role="dialog" aria-modal="true">
			<div class="modal-head">
				<div class="mh-icon"><Icon name={isUser ? 'user' : 'gear'} /></div>
				<div>
					<h2>
						{isUser
							? editingUser ? `Edit ${editingUser.name}` : 'Add user'
							: editingApp ? `Edit ${editingApp.name}` : 'Add application'}
					</h2>
					<div class="mh-sub">Writes to data/config/{isUser ? 'users' : 'applications'}.json</div>
				</div>
				<button class="x" onclick={closeEditor} aria-label="Close"><Icon name="x" /></button>
			</div>
			<form
				method="POST"
				action={isUser ? '?/upsertUser' : '?/upsertApplication'}
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							closeEditor();
							await invalidateAll();
							toast('Saved', `data/config/${isUser ? 'users' : 'applications'}.json updated`);
						} else if (result.type === 'failure') {
							toast('Could not save', String(result.data?.message ?? ''));
						}
					};
				}}
			>
				<div class="modal-body">
					<div class="form-grid">
						{#if isUser}
							<div class="field">
								<label for="a-id">ID <span class="hint">· slug, permanent</span></label>
								<input class="inp" id="a-id" name="id" value={editingUser?.id ?? ''} readonly={!!editingUser} placeholder="priya" />
							</div>
							<div class="field">
								<label for="a-name">Name</label>
								<input class="inp" id="a-name" name="name" value={editingUser?.name ?? ''} placeholder="Priya Nair" />
							</div>
							<div class="field">
								<label for="a-role">Role</label>
								<input class="inp" id="a-role" name="role" value={editingUser?.role ?? ''} placeholder="QA Lead" />
							</div>
							<div class="field">
								<label for="a-color">Avatar colour <span class="hint">· hex</span></label>
								<input class="inp" id="a-color" name="avatarColor" value={editingUser?.avatarColor ?? '#5B4BFF'} placeholder="#5B4BFF" />
							</div>
							<div class="field full">
								<label class="chkline">
									<input type="checkbox" name="assignable" checked={editingUser?.assignable ?? false} />
									Assignable <span class="hint">· appears in the assignee dropdown</span>
								</label>
							</div>
						{:else}
							<div class="field">
								<label for="a-id">ID <span class="hint">· slug, permanent</span></label>
								<input class="inp" id="a-id" name="id" value={editingApp?.id ?? ''} readonly={!!editingApp} placeholder="charcoal-erp" />
							</div>
							<div class="field">
								<label for="a-code">Code <span class="hint">· used in issue IDs</span></label>
								<input class="inp" id="a-code" name="code" value={editingApp?.code ?? ''} readonly={!!editingApp} placeholder="CHR" />
							</div>
							<div class="field">
								<label for="a-name">Name</label>
								<input class="inp" id="a-name" name="name" value={editingApp?.name ?? ''} placeholder="Charcoal ERP" />
							</div>
							<div class="field">
								<label for="a-color">Colour <span class="hint">· hex</span></label>
								<input class="inp" id="a-color" name="color" value={editingApp?.color ?? '#5B4BFF'} placeholder="#5B4BFF" />
							</div>
							<div class="field full">
								<label for="a-modules">Modules <span class="hint">· JSON: modules → pages → forms</span></label>
								<textarea class="ta" id="a-modules" name="modules" style="font-family:var(--font-mono);font-size:12px"
									>{JSON.stringify(editingApp?.modules ?? [], null, 2)}</textarea
								>
							</div>
						{/if}
					</div>
				</div>
				<div class="modal-foot">
					<div class="ff"></div>
					<button type="button" class="btn btn-ghost" onclick={closeEditor}>Cancel</button>
					<button type="submit" class="btn btn-primary">Save</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.rowbtn {
		cursor: pointer;
	}
	.rowbtn:hover {
		background: var(--accent-soft-2);
	}
	.chkline {
		flex-direction: row !important;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.chkline input {
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
	}
</style>
