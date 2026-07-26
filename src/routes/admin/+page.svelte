<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { Application, User } from '$lib/types';
	import { toast } from '$lib/stores/toasts.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	let tab = $state<'apps' | 'users' | 'data' | 'keys'>('apps');
	let editor = $state<
		| null
		| { kind: 'user'; user: User | null }
		| { kind: 'app'; app: Application | null }
	>(null);

	function closeEditor() {
		editor = null;
	}

	let importInput = $state<HTMLInputElement | null>(null);
	let importing = $state(false);
	let exporting = $state(false);
	let apiKey = $state('');
	let savingKey = $state(false);
	let testingKey = $state(false);

	async function runExport() {
		exporting = true;
		try {
			const res = await fetch('/api/data/export');
			if (!res.ok) {
				toast('Export failed', res.statusText);
				return;
			}
			const skipped = Number(res.headers.get('x-export-skipped') ?? '0');
			const blob = await res.blob();
			const disposition = res.headers.get('content-disposition') ?? '';
			const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'issuedesk-data.zip';
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = name;
			a.click();
			URL.revokeObjectURL(url);
			if (skipped > 0) {
				toast(
					'Export complete — with exclusions',
					`${skipped} item(s) could not be read and were excluded. See "skipped" in the archive's manifest.json.`
				);
			} else {
				toast('Export complete', 'Full snapshot downloaded.');
			}
		} catch (e) {
			toast('Export failed', String((e as Error).message ?? e));
		} finally {
			exporting = false;
		}
	}

	async function runImport() {
		const file = importInput?.files?.[0];
		if (!file) {
			toast('No file selected', 'Choose an export zip first.');
			return;
		}
		if (
			!confirm(
				`Replace ALL IssueDesk data (issues, config, attachments) with the contents of "${file.name}"?\n\n` +
					'The current data is kept in data/.backups/pre-import-… — Checkpoint data is not touched.'
			)
		)
			return;
		importing = true;
		try {
			const body = new FormData();
			body.append('file', file);
			const res = await fetch('/api/data/import', { method: 'POST', body });
			const result = await res.json();
			if (!res.ok) {
				toast('Import failed', String(result.message ?? res.statusText));
				return;
			}
			if (importInput) importInput.value = '';
			await invalidateAll();
			toast(
				'Data imported',
				`${result.counts.issues} issues restored (snapshot from ${new Date(result.exportedAt).toLocaleString()}).`
			);
		} catch (e) {
			toast('Import failed', String((e as Error).message ?? e));
		} finally {
			importing = false;
		}
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
			<button class="admin-tab" class:on={tab === 'data'} onclick={() => (tab = 'data')}>Data</button>
			<button class="admin-tab" class:on={tab === 'keys'} onclick={() => (tab = 'keys')}>Keys</button>
		</div>

		{#if tab === 'data'}
			<div class="admin-panel on">
				<div class="admin-card-head">
					<h3>Export snapshot</h3>
					<button class="btn btn-primary btn-sm" onclick={runExport} disabled={exporting}>
						<Icon name="download" />{exporting ? 'Exporting…' : 'Export data (.zip)'}
					</button>
				</div>
				<div class="data-card data-pad">
					<p class="data-desc">
						Downloads a single zip with <b>every issue</b> across all applications — full details,
						activity history, sequence counters, reference config (users, applications, settings)
						and all attached <b>images &amp; documents</b>. Checkpoint content (test cases, suites,
						runs, runners) is not included. Use it for backups or to move this instance's data to
						another machine. If any single file cannot be read, it is excluded and listed under
						<b>skipped</b> in the archive's manifest.json — the rest still exports, and you'll be
						warned here.
					</p>
				</div>

				<div class="admin-card-head" style="margin-top:18px">
					<h3>Import snapshot</h3>
				</div>
				<div class="data-card data-pad">
					<p class="data-desc">
						Restores a zip produced by the export above. <b>Replaces</b> all current IssueDesk data
						(issues, config, attachments) after validating the archive; the previous state is kept
						in <b>data/.backups/pre-import-…</b> for manual recovery. Checkpoint data is untouched.
					</p>
					<div class="import-row">
						<input class="inp" type="file" accept=".zip,application/zip" bind:this={importInput} />
						<button class="btn btn-primary btn-sm" onclick={runImport} disabled={importing}>
							<Icon name="upload" />{importing ? 'Importing…' : 'Import data'}
						</button>
					</div>
				</div>
			</div>
		{:else if tab === 'apps'}
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
		{:else if tab === 'keys'}
			<div class="admin-panel on">
				<div class="admin-card-head">
					<h3>Generative AI — Anthropic key</h3>
				</div>
				<div class="data-card data-pad">
					<p class="data-desc">
						Powers <b>description refinement</b> and <b>tag suggestions</b> in the issue editor.
						The key is stored <b>encrypted</b> (AES-256-GCM) in <b>data/vault/anthropic.json</b>,
						never in git and never included in a data export. Only a masked hint is shown here.
					</p>

					{#if !data.vaultReady}
						<div class="admin-note" style="margin-bottom:14px">
							<Icon name="warning" />
							<span>
								<b>KEY_ENCRYPTION_KEY is not set.</b> Generate one and set it in the environment
								before saving a key:
								<code>node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"</code>
							</span>
						</div>
					{/if}

					<div class="key-status">
						<span
							class="key-dot"
							class:on={data.keyStatus.status === 'configured'}
							class:err={data.keyStatus.status === 'error'}
						></span>
						{#if data.keyStatus.status === 'unset'}
							<span>No key configured — AI features are disabled.</span>
						{:else}
							<span>
								Key <b>{data.keyStatus.hint}</b>
								<span class="key-src">({data.keyStatus.source === 'env' ? 'from ANTHROPIC_API_KEY' : 'in vault'})</span>
								{#if data.keyStatus.status === 'error'}<span class="key-err">· last test failed</span>{/if}
							</span>
						{/if}
					</div>
					{#if data.keyStatus.lastError}
						<div class="key-err-detail">{data.keyStatus.lastError}</div>
					{/if}

					<form
						method="POST"
						action="?/setKey"
						use:enhance={() => {
							savingKey = true;
							return async ({ result }) => {
								savingKey = false;
								if (result.type === 'success') {
									apiKey = '';
									await invalidateAll();
									toast('Key saved', 'Anthropic key stored (encrypted).');
								} else if (result.type === 'failure') {
									toast('Could not save key', String(result.data?.message ?? ''));
								}
							};
						}}
					>
						<div class="key-row">
							<input
								class="inp"
								type="password"
								name="apiKey"
								bind:value={apiKey}
								placeholder={data.keyStatus.status === 'unset' ? 'sk-ant-…' : 'sk-ant-… (paste to rotate)'}
								autocomplete="off"
							/>
							<button class="btn btn-primary btn-sm" type="submit" disabled={savingKey || !apiKey.trim()}>
								<Icon name="key" />{savingKey ? 'Saving…' : data.keyStatus.status === 'unset' ? 'Save key' : 'Rotate key'}
							</button>
						</div>
					</form>

					{#if data.keyStatus.status !== 'unset'}
						<div class="key-actions">
							<form
								method="POST"
								action="?/testKey"
								use:enhance={() => {
									testingKey = true;
									return async ({ result }) => {
										testingKey = false;
										await invalidateAll();
										if (result.type === 'success') toast('Key works', 'A live call succeeded.');
										else if (result.type === 'failure') toast('Test failed', String(result.data?.message ?? ''));
									};
								}}
							>
								<button class="btn btn-ghost btn-sm" type="submit" disabled={testingKey || data.keyStatus.source === 'env'}>
									<Icon name="refresh" />{testingKey ? 'Testing…' : 'Test connection'}
								</button>
							</form>
							{#if data.keyStatus.source === 'vault'}
								<form
									method="POST"
									action="?/removeKey"
									use:enhance={() => {
										return async ({ result }) => {
											if (result.type === 'success') {
												await invalidateAll();
												toast('Key removed', 'AI features are now disabled.');
											}
										};
									}}
								>
									<button class="btn btn-ghost btn-sm" type="submit"><Icon name="trash" />Remove</button>
								</form>
							{/if}
						</div>
					{/if}
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
	.data-pad {
		padding: 16px;
	}
	.data-desc {
		margin: 0 0 12px;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.55;
		max-width: 640px;
	}
	.data-desc:last-child {
		margin-bottom: 0;
	}
	.import-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.import-row input[type='file'] {
		max-width: 340px;
	}
	.key-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--muted);
		margin-bottom: 6px;
	}
	.key-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--faint);
		flex: none;
	}
	.key-dot.on {
		background: var(--done);
	}
	.key-dot.err {
		background: var(--open);
	}
	.key-src {
		color: var(--faint);
	}
	.key-err {
		color: var(--open);
	}
	.key-err-detail {
		font-size: 12px;
		color: var(--open);
		margin: 0 0 10px;
		font-family: var(--font-mono);
	}
	.key-row {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 8px;
	}
	.key-row input[type='password'] {
		max-width: 360px;
		font-family: var(--font-mono);
	}
	.key-actions {
		display: flex;
		gap: 10px;
		margin-top: 12px;
	}
	.admin-note code {
		display: inline-block;
		margin-top: 4px;
		font-size: 11.5px;
		background: rgba(0, 0, 0, 0.05);
		padding: 2px 6px;
		border-radius: 5px;
	}
</style>
