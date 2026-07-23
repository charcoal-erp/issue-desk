<script lang="ts">
	import Icon from './Icon.svelte';

	/**
	 * Copy-to-clipboard with a fallback.
	 *
	 * `navigator.clipboard` only exists in a secure context, and Checkpoint is
	 * routinely opened over a plain-http LAN address — a copy button that
	 * silently does nothing there is worse than no button at all. So a failed
	 * write falls back to the old selection trick, and if even that fails the
	 * button says so rather than pretending it worked.
	 */
	let {
		text,
		label = '',
		title = 'Copy to clipboard',
		variant = 'light'
	}: { text: string; label?: string; title?: string; variant?: 'light' | 'dark' } = $props();

	let phase = $state<'idle' | 'done' | 'failed'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	function selectionCopy(value: string): boolean {
		const ta = document.createElement('textarea');
		ta.value = value;
		ta.setAttribute('readonly', '');
		ta.style.position = 'fixed';
		ta.style.top = '-1000px';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		ta.remove();
		return ok;
	}

	async function copy() {
		let ok = false;
		try {
			await navigator.clipboard.writeText(text);
			ok = true;
		} catch {
			ok = selectionCopy(text);
		}
		phase = ok ? 'done' : 'failed';
		clearTimeout(timer);
		timer = setTimeout(() => (phase = 'idle'), 1600);
	}

	const caption = $derived(phase === 'done' ? 'Copied' : phase === 'failed' ? 'Copy failed' : label);
</script>

<button
	type="button"
	class="copy-btn {variant}"
	class:done={phase === 'done'}
	class:failed={phase === 'failed'}
	onclick={copy}
	title={phase === 'done' ? 'Copied' : title}
	aria-label={title}
>
	<Icon name={phase === 'done' ? 'check' : 'copy'} />
	{#if caption}<span class="cb-label">{caption}</span>{/if}
</button>

<style>
	.copy-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		flex: none;
		border-radius: 7px;
		padding: 5px 8px;
		font-size: 11px;
		font-family: inherit;
		line-height: 1;
		cursor: pointer;
		transition: 0.14s;
	}
	.cb-label {
		white-space: nowrap;
	}

	.copy-btn.light {
		background: var(--surface, #fff);
		border: 1px solid var(--line, #e4e8ee);
		color: var(--muted, #5b6472);
	}
	.copy-btn.light:hover {
		border-color: var(--ws, #0d9488);
		color: var(--ws, #0d9488);
	}

	/* On the terminal box: invisible until wanted, legible when it is. */
	.copy-btn.dark {
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: var(--term-muted, #5c6b86);
	}
	.copy-btn.dark:hover {
		background: rgba(255, 255, 255, 0.14);
		color: var(--term-text, #c7d2e4);
	}

	.copy-btn.done {
		border-color: var(--pass, #2fa36b);
		color: var(--pass, #2fa36b);
	}
	.copy-btn.failed {
		border-color: var(--fail, #e5484d);
		color: var(--fail, #e5484d);
	}
</style>
