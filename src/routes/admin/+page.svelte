<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { Application, Category, User } from '$lib/types';
	import { toast } from '$lib/stores/toasts.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	let tab = $state<'apps' | 'users' | 'categories' | 'data' | 'keys'>('apps');
	let editor = $state<
		| null
		| { kind: 'user'; user: User | null }
		| { kind: 'app'; app: Application | null }
		| { kind: 'category'; category: Category | null }
	>(null);

	function closeEditor() {
		editor = null;
	}

	// A generated password is shown exactly once, right after it is set —
	// there is no way to read it back afterwards.
	let issued = $state<{ username: string; password: string } | null>(null);
	let pwFor = $state<User | null>(null);
	let pwValue = $state('');

	function openPassword(user: User) {
		pwFor = user;
		pwValue = '';
		issued = null;
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
			<button class="admin-tab" class:on={tab === 'users'} onclick={() => (tab = 'users')}>Accounts</button>
			<button class="admin-tab" class:on={tab === 'categories'} onclick={() => (tab = 'categories')}>Categories</button>
			<button class="admin-tab" class:on={tab === 'data'} onclick={() => (tab = 'data')}>Data</button>
			<button class="admin-tab" class:on={tab === 'keys'} onclick={() => (tab = 'keys')}>Keys</button>
		</div>

		{#if tab === 'data'}
			<div class="admin-panel on">
				<div class="cfg-grid">
					<section class="cfg-col">
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
					</section>

					<section class="cfg-col">
						<div class="admin-card-head">
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
					</section>
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
				<div class="cfg-grid">
					<section class="cfg-col cfg-aside">
						<div class="data-card data-pad">
							<p class="data-desc">
								Powers <b>description refinement</b> and <b>tag suggestions</b> in the issue editor.
								The key is stored <b>encrypted</b> (AES-256-GCM) in <b>data/vault/anthropic.json</b>,
								never in git and never included in a data export. Only a masked hint is shown here.
							</p>
						</div>
					</section>

					<section class="cfg-col cfg-main">
					<div class="data-card data-pad">
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
					</section>
				</div>
			</div>
		{:else if tab === 'categories'}
			<div class="admin-panel on">
				<div class="admin-card-head">
					<h3>Categories</h3>
					<button class="btn btn-primary btn-sm" onclick={() => (editor = { kind: 'category', category: null })}>
						<Icon name="plus" />Add category
					</button>
				</div>
				<div class="cfg-grid">
				<section class="cfg-col cfg-aside">
					<div class="data-card data-pad">
						<p class="data-desc">
							What an issue is <b>about</b> — as opposed to the application and module, which say
							where it lives. Agents pull work a category at a time
							(<code>GET /api/agent/issues?category=…</code>), so these slugs are part of your API
							surface: renaming an id changes what an agent must ask for. Tags stay free-form and
							filter separately.
						</p>
					</div>
				</section>
				<section class="cfg-col cfg-main">
					<div class="data-card">
						<table>
							<thead>
								<tr><th>Category</th><th>ID</th><th>Description</th><th></th></tr>
							</thead>
							<tbody>
								{#each data.categories as category (category.id)}
									<tr class="rowbtn" onclick={() => (editor = { kind: 'category', category })}>
										<td><AppChip name={category.name} color={category.color} bold /></td>
										<td style="font-family:var(--font-mono);font-size:12px;color:var(--muted)">{category.id}</td>
										<td style="color:var(--muted)">{category.description ?? '—'}</td>
										<td style="text-align:right">
											<form
												method="POST"
												action="?/removeCategory"
												use:enhance={() => async ({ result }) => {
													if (result.type === 'success') {
														await invalidateAll();
														toast('Category removed', 'Issues using it keep the id and show as uncategorised.');
													}
												}}
											>
												<input type="hidden" name="id" value={category.id} />
												<button
													class="btn btn-ghost btn-sm"
													type="submit"
													onclick={(e) => e.stopPropagation()}
													aria-label="Remove {category.name}"><Icon name="trash" /></button
												>
											</form>
										</td>
									</tr>
								{/each}
								{#if !data.categories.length}
									<tr><td colspan="4" style="color:var(--faint)">No categories yet.</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</section>
				</div>
			</div>
		{:else}
			<div class="admin-panel on">
				<div class="admin-card-head">
					<h3>Accounts</h3>
					<button class="btn btn-primary btn-sm" onclick={() => (editor = { kind: 'user', user: null })}>
						<Icon name="plus" />Add account
					</button>
				</div>
				<div class="cfg-grid">
				<section class="cfg-col cfg-aside">
					<div class="data-card data-pad">
						<p class="data-desc">
							Everyone signs in with a username and password. <b>Agent</b> accounts are the same
							thing for a Claude Code session: it posts those credentials to
							<code>/api/auth/login</code>, gets a JWT and works through issues under its own name.
							An account with no password cannot sign in at all — set one from the table.
						</p>
					</div>
				</section>
				<section class="cfg-col cfg-main">
					<div class="data-card">
						<table>
							<thead>
								<tr><th>Name</th><th>Username</th><th>Kind</th><th>Sign-in</th><th>Assignable</th><th>Reported</th><th>Assigned</th><th></th></tr>
							</thead>
							<tbody>
								{#each data.users as user (user.id)}
									<tr class="rowbtn" onclick={() => (editor = { kind: 'user', user })}>
										<td>
											<div class="assignee-cell">
												<Avatar {user} /><b>{user.name}</b>
												{#if user.admin}<span class="role-tag" style="color:var(--accent-ink)">admin</span>{/if}
												{#if user.active === false}<span class="role-tag" style="color:var(--open)">inactive</span>{/if}
											</div>
										</td>
										<td style="font-family:var(--font-mono);font-size:12px;color:var(--muted)">{user.username ?? user.id}</td>
										<td>
											<span class="role-tag" style={user.kind === 'agent' ? 'color:#a2650e' : ''}>
												{user.kind === 'agent' ? 'Agent' : 'Human'}
											</span>
										</td>
										<td>
											{#if data.credentialed[user.id]}
												<span class="pw-ok">Password set</span>
											{:else}
												<span class="pw-none">No password</span>
											{/if}
										</td>
										<td>
											{#if user.assignable}<span class="role-tag" style="color:var(--accent-ink)">Yes</span
												>{:else}<span style="color:var(--faint)">—</span>{/if}
										</td>
										<td>{data.perUser[user.id]?.reported ?? 0}</td>
										<td>{data.perUser[user.id]?.assigned ?? 0}</td>
										<td style="text-align:right">
											<button
												class="btn btn-ghost btn-sm"
												onclick={(e) => {
													e.stopPropagation();
													openPassword(user);
												}}><Icon name="key" />Password</button
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
				</div>
			</div>
		{/if}
	</div>
</section>

{#if editor}
	{@const isUser = editor.kind === 'user'}
	{@const isCategory = editor.kind === 'category'}
	{@const editingUser = editor.kind === 'user' ? editor.user : null}
	{@const editingApp = editor.kind === 'app' ? editor.app : null}
	{@const editingCategory = editor.kind === 'category' ? editor.category : null}
	{@const configFile = isUser ? 'users' : isCategory ? 'categories' : 'applications'}
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
						{#if isUser}
							{editingUser ? `Edit ${editingUser.name}` : 'Add account'}
						{:else if isCategory}
							{editingCategory ? `Edit ${editingCategory.name}` : 'Add category'}
						{:else}
							{editingApp ? `Edit ${editingApp.name}` : 'Add application'}
						{/if}
					</h2>
					<div class="mh-sub">Writes to data/config/{configFile}.json</div>
				</div>
				<button class="x" onclick={closeEditor} aria-label="Close"><Icon name="x" /></button>
			</div>
			<form
				method="POST"
				action={isUser ? '?/upsertUser' : isCategory ? '?/upsertCategory' : '?/upsertApplication'}
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							closeEditor();
							await invalidateAll();
							toast('Saved', `data/config/${configFile}.json updated`);
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
							<div class="field">
								<label for="a-username">Username <span class="hint">· for signing in</span></label>
								<input
									class="inp"
									id="a-username"
									name="username"
									value={editingUser?.username ?? editingUser?.id ?? ''}
									placeholder="defaults to the ID"
									autocapitalize="none"
									spellcheck="false"
								/>
							</div>
							<div class="field">
								<label for="a-kind">Kind</label>
								<select class="inp" id="a-kind" name="kind" value={editingUser?.kind ?? 'human'}>
									<option value="human">Human — signs in through the browser</option>
									<option value="agent">Agent — signs in over the API</option>
								</select>
							</div>
							<div class="field full">
								<label class="chkline">
									<input type="checkbox" name="assignable" checked={editingUser?.assignable ?? false} />
									Assignable <span class="hint">· appears in the assignee dropdown</span>
								</label>
							</div>
							<div class="field full">
								<label class="chkline">
									<input type="checkbox" name="admin" checked={editingUser?.admin ?? false} />
									Administrator <span class="hint">· may reach Config and manage passwords</span>
								</label>
							</div>
							<div class="field full">
								<label class="chkline">
									<input type="checkbox" name="active" value="on" checked={editingUser?.active !== false} />
									Active <span class="hint">· unchecked blocks sign-in but keeps history</span>
								</label>
							</div>
						{:else if isCategory}
							<div class="field">
								<label for="a-id">ID <span class="hint">· slug, used by the agent API</span></label>
								<input class="inp" id="a-id" name="id" value={editingCategory?.id ?? ''} readonly={!!editingCategory} placeholder="authentication" />
							</div>
							<div class="field">
								<label for="a-name">Name</label>
								<input class="inp" id="a-name" name="name" value={editingCategory?.name ?? ''} placeholder="Authentication" />
							</div>
							<div class="field">
								<label for="a-color">Colour <span class="hint">· hex</span></label>
								<input class="inp" id="a-color" name="color" value={editingCategory?.color ?? '#5B4BFF'} placeholder="#5B4BFF" />
							</div>
							<div class="field full">
								<label for="a-desc">Description <span class="hint">· what belongs here</span></label>
								<input class="inp" id="a-desc" name="description" value={editingCategory?.description ?? ''} placeholder="Login, sessions, tokens and permissions" />
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

{#if pwFor}
	<div
		class="backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) pwFor = null;
		}}
	>
		<div class="modal" style="max-width:520px" role="dialog" aria-modal="true">
			<div class="modal-head">
				<div class="mh-icon"><Icon name="key" /></div>
				<div>
					<h2>Password — {pwFor.name}</h2>
					<div class="mh-sub">Signs in as <b>{pwFor.username ?? pwFor.id}</b></div>
				</div>
				<button class="x" onclick={() => (pwFor = null)} aria-label="Close"><Icon name="x" /></button>
			</div>

			{#if issued}
				<div class="modal-body">
					<p class="data-desc">
						Password set. <b>Copy it now</b> — it is not stored in a readable form and cannot be
						shown again.
					</p>
					<div class="pw-issued">
						<div><span class="pw-lbl">Username</span><code>{issued.username}</code></div>
						<div><span class="pw-lbl">Password</span><code>{issued.password}</code></div>
					</div>
					<p class="data-desc" style="margin-top:12px">
						For an agent account, this is what a Claude Code session posts to
						<code>/api/auth/login</code>.
					</p>
				</div>
				<div class="modal-foot">
					<div class="ff"></div>
					<button
						type="button"
						class="btn btn-ghost"
						onclick={() => navigator.clipboard.writeText(issued!.password).then(() => toast('Copied', 'Password on the clipboard.'))}
						>Copy password</button
					>
					<button type="button" class="btn btn-primary" onclick={() => (pwFor = null)}>Done</button>
				</div>
			{:else}
				<form
					method="POST"
					action="?/setPassword"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								await invalidateAll();
								const generated = result.data?.generatedPassword as string | undefined;
								if (generated) {
									issued = { username: String(result.data?.username ?? ''), password: generated };
								} else {
									pwFor = null;
									toast('Password set', 'Existing tokens for this account are now invalid.');
								}
							} else if (result.type === 'failure') {
								toast('Could not set password', String(result.data?.message ?? ''));
							}
						};
					}}
				>
					<div class="modal-body">
						<input type="hidden" name="userId" value={pwFor.id} />
						<p class="data-desc">
							Setting a password invalidates any token this account is currently using — a
							deliberate way to cut off an agent that has gone astray.
						</p>
						<div class="field full">
							<label for="pw">New password <span class="hint">· leave blank to generate one</span></label>
							<input
								class="inp"
								id="pw"
								name="password"
								type="text"
								bind:value={pwValue}
								placeholder="Generate a strong one"
								autocomplete="new-password"
								style="font-family:var(--font-mono)"
							/>
						</div>
					</div>
					<div class="modal-foot">
						{#if data.credentialed[pwFor.id]}
							<button
								type="submit"
								class="btn btn-ghost danger"
								formaction="?/clearPassword"
								onclick={(e) => {
									if (!confirm(`Remove ${pwFor?.name}'s password? They will not be able to sign in.`)) {
										e.preventDefault();
									}
								}}>Remove password</button
							>
						{/if}
						<div class="ff"></div>
						<button type="button" class="btn btn-ghost" onclick={() => (pwFor = null)}>Cancel</button>
						<button type="submit" class="btn btn-primary">
							{pwValue.trim() ? 'Set password' : 'Generate password'}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.rowbtn {
		cursor: pointer;
	}
	.pw-ok {
		font-size: 12px;
		color: var(--done);
	}
	.pw-none {
		font-size: 12px;
		color: var(--faint);
	}
	.pw-issued {
		display: grid;
		gap: 8px;
		padding: 14px;
		border-radius: var(--radius-sm);
		background: var(--term-bg);
	}
	.pw-issued div {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.pw-lbl {
		width: 74px;
		flex: none;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--term-muted);
	}
	.pw-issued code {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--term-str);
		word-break: break-all;
	}
	.danger {
		color: var(--open);
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
