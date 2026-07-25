<script lang="ts">
	import { page } from '$app/state';
	import type { Application } from '$lib/types';
	import { toast } from '$lib/stores/toasts.svelte';
	import { closeExport, ui } from '$lib/stores/ui.svelte';
	import Icon from './Icon.svelte';

	let { applications: _applications }: { applications: Application[] } = $props();

	let format = $state<'md' | 'json'>('md');
	let raw = $state('');
	let copied = $state(false);

	const appSlug = $derived(page.url.searchParams.get('appId') || 'all');
	const filename = $derived(format === 'md' ? `fix-batch-${appSlug}.md` : `issues-${appSlug}.json`);

	$effect(() => {
		const params = new URLSearchParams(page.url.searchParams);
		params.delete('page');
		params.delete('pageSize');
		params.set('format', format);
		raw = '';
		fetch(`/api/export?${params}`)
			.then((r) => r.text())
			.then((text) => (raw = text))
			.catch(() => toast('Export failed', 'Could not reach the server'));
	});

	function esc(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
	function highlightMd(t: string): string {
		return esc(t)
			.replace(/^(#.*)$/gm, '<span class="h">$1</span>')
			.replace(/^(---)$/gm, '<span class="c">$1</span>')
			.replace(/^(_.*_)$/gm, '<span class="c">$1</span>')
			.replace(/(\*\*[^*]+\*\*)/g, '<span class="k">$1</span>')
			.replace(/(https?:\/\/[^\s]+)/g, '<span class="s">$1</span>');
	}
	function highlightJson(t: string): string {
		return esc(t)
			.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2')
			.replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="s">$1</span>')
			.replace(/:\s*(\d+)/g, ': <span class="s">$1</span>');
	}
	const highlighted = $derived(format === 'md' ? highlightMd(raw) : highlightJson(raw));

	async function copy() {
		try {
			await navigator.clipboard.writeText(raw);
			copied = true;
			toast('Copied to clipboard', 'Paste into your Claude Code session');
			setTimeout(() => (copied = false), 1800);
		} catch {
			toast('Copy failed', 'Select the text and copy manually');
		}
	}

	function download() {
		const blob = new Blob([raw], { type: format === 'md' ? 'text/markdown' : 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = filename;
		a.click();
		URL.revokeObjectURL(a.href);
		toast(`Downloaded ${filename}`, '');
	}
</script>

<div
	class="backdrop"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) closeExport();
	}}
>
	<div class="modal export-modal" role="dialog" aria-modal="true" aria-label="Export">
		<div class="export-head">
			<div class="win-dots">
				<i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i>
			</div>
			<div class="fname"><Icon name="file" /><span>{filename}</span></div>
			<button class="x" onclick={closeExport} aria-label="Close"><Icon name="x" /></button>
		</div>
		<div class="export-toolbar">
			<div class="export-seg">
				<button class:on={format === 'md'} onclick={() => (format = 'md')}>
					<Icon name="markdown" />
					Markdown
				</button>
				<button class:on={format === 'json'} onclick={() => (format = 'json')}>
					<Icon name="json" />
					JSON
				</button>
			</div>
			<div class="export-info">{ui.exportTotal} {ui.exportTotal === 1 ? 'issue' : 'issues'}</div>
		</div>
		<div class="export-code">
			<!-- eslint-disable-next-line svelte/no-at-html-tags — escaped before highlighting -->
			<pre>{@html highlighted}</pre>
		</div>
		<div class="export-foot">
			<div class="ef">Reflects the current filter. Paste straight into a Claude Code session.</div>
			<button class="btn btn-term btn-sm" onclick={download}>
				<Icon name="download" />
				Download
			</button>
			<button class="btn btn-copy btn-sm" class:done={copied} onclick={copy}>
				{#if copied}
					<Icon name="check-sm" />
					Copied
				{:else}
					<Icon name="copy" />
					Copy for Claude Code
				{/if}
			</button>
		</div>
	</div>
</div>
