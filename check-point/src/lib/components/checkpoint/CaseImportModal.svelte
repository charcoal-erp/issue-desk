<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/stores/toasts.svelte';
	import Icon from '../Icon.svelte';

	let { filterQuery = '', onClose }: { filterQuery?: string; onClose: () => void } = $props();

	let format = $state<'json' | 'csv'>('json');
	let content = $state('');
	let importing = $state(false);

	const exportBase = $derived(`/api/export/cases?${filterQuery ? filterQuery + '&' : ''}format=`);

	async function doImport() {
		if (!content.trim()) return;
		importing = true;
		try {
			const res = await fetch('/api/import/cases', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ format, content })
			});
			const data = await res.json();
			toast(`Imported ${data.createdCount} case${data.createdCount === 1 ? '' : 's'}`, data.skipped ? `${data.skipped} skipped` : 'From ' + format.toUpperCase());
			await invalidateAll();
			onClose();
		} catch (e) {
			toast('Import failed', (e as Error).message);
		} finally {
			importing = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="cp-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
	<div class="cp-modal" role="dialog" aria-modal="true">
		<div class="modal-head">
			<div class="mh-icon"><Icon name="upload" /></div>
			<div>
				<h2>Import &amp; export cases</h2>
				<div class="mh-sub">Paste JSON or CSV to add cases; download the current view for review</div>
			</div>
			<button class="x" onclick={onClose} aria-label="Close"><Icon name="x" /></button>
		</div>

		<div class="modal-body">
			<div class="field">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label>Import</label>
				<div class="exp-toggle">
					<button class:on={format === 'json'} onclick={() => (format = 'json')}>JSON</button>
					<button class:on={format === 'csv'} onclick={() => (format = 'csv')}>CSV</button>
				</div>
				<textarea class="inp" style="min-height:130px;font-family:var(--font-mono);font-size:12px" bind:value={content} placeholder={format === 'json' ? '[ { "appId": "charcoal", "moduleId": "accounting", "title": "…", "kind": "manual" } ]' : 'appId,moduleId,title,kind,priority\ncharcoal,accounting,Login works,manual,high'}></textarea>
				<div class="hint" style="margin-top:4px">Rows missing an application, module or title are skipped. New ids are allocated per app.</div>
			</div>

			<div class="field">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label>Export the current filter</label>
				<div class="tagrow">
					<a class="btn btn-ghost btn-sm" href="{exportBase}json" download><Icon name="json" /> JSON</a>
					<a class="btn btn-ghost btn-sm" href="{exportBase}csv" download><Icon name="download" /> CSV</a>
					<a class="btn btn-ghost btn-sm" href="{exportBase}md" download><Icon name="markdown" /> Markdown</a>
				</div>
			</div>
		</div>

		<div class="modal-foot">
			<div class="ff">Discovery from a runner report is planned; JSON / CSV import is available now.</div>
			<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
			<button class="btn btn-primary" onclick={doImport} disabled={importing || !content.trim()}><Icon name="upload" /> Import</button>
		</div>
	</div>
</div>
