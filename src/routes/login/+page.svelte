<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';

	let { data, form } = $props();

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '');
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in — {data.productName}</title></svelte:head>

<div class="signin">
	<div class="card">
		<div class="mark"><Icon name="logo" /></div>
		<h1>{data.productName}</h1>
		<p class="sub">Sign in to file, triage and fix issues.</p>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="redirectTo" value={redirectTo} />

			<div class="field full">
				<label for="username">Username</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="username"
					name="username"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					autofocus
					required
					value={form?.username ?? ''}
				/>
			</div>

			<div class="field full">
				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>

			{#if form?.message}
				<p class="err" role="alert">{form.message}</p>
			{/if}

			<button class="btn btn-primary full" type="submit" disabled={submitting}>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<p class="hint">
			Agents sign in the same way, over <code>POST /api/auth/login</code>, and use the returned
			token as a bearer credential.
		</p>
	</div>
</div>

<style>
	.signin {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
		background: var(--paper);
	}
	.card {
		width: 100%;
		max-width: 380px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		padding: 32px 28px 24px;
	}
	.mark {
		width: 42px;
		height: 42px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: #fff;
		display: grid;
		place-items: center;
		margin-bottom: 16px;
	}
	.mark :global(svg) {
		color: #fff;
	}
	h1 {
		font-family: var(--font-display);
		font-size: 22px;
		margin: 0 0 4px;
		color: var(--ink);
	}
	.sub {
		margin: 0 0 22px;
		color: var(--muted);
		font-size: 13px;
	}
	form {
		display: grid;
		gap: 14px;
	}
	.btn.full {
		width: 100%;
		justify-content: center;
		margin-top: 4px;
	}
	.err {
		margin: 0;
		padding: 9px 11px;
		border-radius: var(--radius-xs);
		background: var(--open-soft);
		color: var(--open);
		font-size: 13px;
	}
	.hint {
		margin: 22px 0 0;
		padding-top: 16px;
		border-top: 1px solid var(--line-2);
		color: var(--faint);
		font-size: 11.5px;
		line-height: 1.5;
	}
	.hint code {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--muted);
	}
</style>
