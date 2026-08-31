<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import loginBg from '$lib/assets/login-bg.svg';
	import Icon from '$lib/components/Icon.svelte';

	let { data, form } = $props();

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '');
	let submitting = $state(false);

	const POINTS = [
		{ icon: 'rows', text: 'Filter a set of issues, export them as one ready-to-paste prompt' },
		{ icon: 'layers', text: 'Park work in a backlog that stays out of the queue until you want it' },
		{ icon: 'terminal', text: 'Agents sign in over the same API and work the queue on their own' }
	];
</script>

<div class="signin" style:--login-bg={`url("${loginBg}")`}>
	<div class="frame">
		<section class="pitch">
			<div class="brand">
				<span class="mark"><Icon name="logo" /></span>
				<span class="pname">{data.productName}</span>
			</div>
			<h1>File it, triage it, fix it.</h1>
			<p class="blurb">
				A file-backed tracker for QA, dev-testers and the Claude Code sessions that do the fixing.
				No database — every issue is a JSON file you can read, diff and commit.
			</p>
			<ul class="points">
				{#each POINTS as point (point.icon)}
					<li><Icon name={point.icon} /><span>{point.text}</span></li>
				{/each}
			</ul>
		</section>

		<section class="card">
			<div class="card-brand">
				<span class="mark"><Icon name="logo" /></span>
				<span class="pname">{data.productName}</span>
			</div>
			<h2>Welcome back</h2>
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
					<div class="with-icon">
						<Icon name="user" />
						<!-- svelte-ignore a11y_autofocus -->
						<input
							id="username"
							name="username"
							autocomplete="username"
							autocapitalize="none"
							spellcheck="false"
							placeholder="your username"
							autofocus
							required
							value={form?.username ?? ''}
						/>
					</div>
				</div>

				<div class="field full">
					<label for="password">Password</label>
					<div class="with-icon">
						<Icon name="key" />
						<input
							id="password"
							name="password"
							type="password"
							autocomplete="current-password"
							placeholder="••••••••"
							required
						/>
					</div>
				</div>

				{#if form?.message}
					<p class="err" role="alert"><Icon name="warning" />{form.message}</p>
				{/if}

				<button class="btn btn-primary full" type="submit" disabled={submitting}>
					{submitting ? 'Signing in…' : 'Sign in'}
				</button>
			</form>

			<p class="hint">
				Agents sign in the same way, over <code>POST /api/auth/login</code>, and use the returned
				token as a bearer credential.
			</p>
		</section>
	</div>
</div>

<style>
	.signin {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
		/* Three layers: the artwork on top, then two wide gradients so the page
		   never goes flat where the SVG's washes fade out. */
		background-color: var(--paper);
		background-image: var(--login-bg),
			linear-gradient(155deg, var(--accent-soft-2) 0%, transparent 48%),
			linear-gradient(205deg, var(--verify-soft) 0%, transparent 42%);
		background-size: cover, 100% 100%, 100% 100%;
		background-position: center;
		background-repeat: no-repeat;
	}
	.frame {
		position: relative;
		width: 100%;
		max-width: 940px;
		display: grid;
		grid-template-columns: 1fr 380px;
		gap: 44px;
		align-items: center;
	}

	/* ---- left: what this thing is ---- */
	.pitch {
		min-width: 0;
	}
	.brand,
	.card-brand {
		display: flex;
		align-items: center;
		gap: 11px;
		margin-bottom: 22px;
	}
	.mark {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: var(--radius-sm);
		background: linear-gradient(140deg, var(--accent), #8a7bff);
		box-shadow: 0 4px 14px rgba(91, 75, 255, 0.32);
		display: grid;
		place-items: center;
		color: #fff;
	}
	.mark :global(svg) {
		width: 21px;
		height: 21px;
		color: #fff;
	}
	.pname {
		font-family: var(--font-display);
		font-size: 19px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.pitch h1 {
		font-family: var(--font-display);
		font-size: 38px;
		line-height: 1.1;
		letter-spacing: -0.03em;
		margin: 0 0 14px;
		color: var(--ink);
	}
	.blurb {
		margin: 0 0 26px;
		max-width: 46ch;
		font-size: 14px;
		line-height: 1.65;
		color: var(--muted);
	}
	.points {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 13px;
	}
	.points li {
		display: flex;
		align-items: flex-start;
		gap: 11px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--ink-2);
	}
	.points :global(svg) {
		width: 16px;
		height: 16px;
		flex: none;
		margin-top: 2px;
		color: var(--accent);
	}

	/* ---- right: the form ---- */
	.card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 16px;
		box-shadow: var(--shadow-lg);
		padding: 30px 28px 24px;
	}
	.card-brand {
		display: none;
	}
	.card h2 {
		font-family: var(--font-display);
		font-size: 20px;
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
	.with-icon {
		position: relative;
		display: flex;
		align-items: center;
	}
	.with-icon :global(svg) {
		position: absolute;
		left: 11px;
		width: 15px;
		height: 15px;
		color: var(--faint);
		pointer-events: none;
	}
	.with-icon input {
		width: 100%;
		padding: 10px 12px 10px 34px;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: var(--surface);
		color: var(--ink);
		outline: none;
		transition: 0.15s;
	}
	.with-icon input::placeholder {
		color: var(--faint);
	}
	.with-icon input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	/* These fields are styled here rather than with `.inp`, so the app-wide
	   autofill rule loses on specificity to the focus rule above — without this
	   pair, focusing an autofilled field brings Chrome's yellow straight back. */
	.with-icon input:-webkit-autofill {
		-webkit-text-fill-color: var(--ink);
		caret-color: var(--ink);
		box-shadow: 0 0 0 100px var(--surface-2) inset;
	}
	.with-icon input:-webkit-autofill:focus {
		border-color: var(--accent);
		box-shadow:
			0 0 0 100px var(--surface-2) inset,
			0 0 0 3px var(--accent-soft);
	}
	.with-icon:focus-within :global(svg) {
		color: var(--accent);
	}
	.btn.full {
		width: 100%;
		justify-content: center;
		margin-top: 4px;
	}
	.err {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 9px 11px;
		border-radius: var(--radius-xs);
		background: var(--open-soft);
		color: var(--open);
		font-size: 13px;
	}
	.err :global(svg) {
		width: 15px;
		height: 15px;
		flex: none;
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

	/* Below the split, the pitch would push the form off the fold — the card
	   carries its own brand line instead. */
	@media (max-width: 860px) {
		.frame {
			grid-template-columns: 1fr;
			max-width: 400px;
			gap: 0;
		}
		.pitch {
			display: none;
		}
		.card-brand {
			display: flex;
		}
	}
</style>
