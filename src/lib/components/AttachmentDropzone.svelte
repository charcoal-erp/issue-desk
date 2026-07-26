<script lang="ts">
	import type { Attachment } from '$lib/types';
	import { pastedImages } from '$lib/clipboard';
	import { fmtSize } from '$lib/format';
	import { toast } from '$lib/stores/toasts.svelte';
	import { openLightbox } from '$lib/stores/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		attachments = $bindable(),
		appId,
		issueId,
		draftId
	}: {
		attachments: Attachment[];
		appId: string;
		issueId: string; // 'pending' for a not-yet-created issue
		draftId: string;
	} = $props();

	let input = $state<HTMLInputElement | undefined>();
	let dragover = $state(false);
	let uploading = $state(false);

	const KIND_LABELS: Record<Attachment['kind'], string> = {
		image: 'Image',
		pdf: 'PDF',
		doc: 'Word doc',
		archive: 'ZIP',
		html: 'HTML'
	};
	const kindLabel = (k: Attachment['kind']) => KIND_LABELS[k] ?? 'File';

	// Client-only component, so no hydration mismatch to worry about.
	const pasteKey = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

	async function upload(files: FileList | File[], announce = false) {
		if (!appId) {
			toast('Choose an application first', 'Uploads are stored per app and issue');
			return;
		}
		const body = new FormData();
		body.set('appId', appId);
		body.set('issueId', issueId);
		body.set('draftId', draftId);
		for (const file of files) body.append('files', file);
		uploading = true;
		try {
			const res = await fetch('/api/uploads', { method: 'POST', body });
			const payload = await res.json();
			if (!res.ok) {
				toast('Upload failed', payload.message);
				return;
			}
			const added = payload.attachments as Attachment[];
			attachments = [...attachments, ...added];
			// The dropzone sits at the foot of a long form, so a paste that lands
			// off-screen needs to say so.
			if (announce && added.length) {
				toast(
					added.length === 1 ? 'Screenshot attached' : `${added.length} screenshots attached`,
					added.map((a) => a.filename).join(', ')
				);
			}
		} catch {
			toast('Upload failed', 'Could not reach the server');
		} finally {
			uploading = false;
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		if (e.dataTransfer?.files.length) upload(e.dataTransfer.files);
	}

	// Paste anywhere in the modal — this component only exists while it's open.
	$effect(() => {
		function onPaste(e: ClipboardEvent) {
			const images = pastedImages(e);
			if (!images.length) return;
			e.preventDefault();
			upload(images, true);
		}
		window.addEventListener('paste', onPaste);
		return () => window.removeEventListener('paste', onPaste);
	});

	function remove(att: Attachment) {
		attachments = attachments.filter((a) => a.id !== att.id);
	}
</script>

<button
	type="button"
	class="dropzone"
	class:dragover
	onclick={() => input?.click()}
	ondragover={(e) => {
		e.preventDefault();
		dragover = true;
	}}
	ondragleave={() => (dragover = false)}
	ondrop={onDrop}
>
	<Icon name="upload" />
	<div class="dz-t">
		{uploading ? 'Uploading…' : 'Drop screenshots or PDFs here, or click to browse'}
	</div>
	<div class="dz-s">
		Paste a screenshot with <kbd>{pasteKey}</kbd><kbd>V</kbd> · files land in
		<span style="font-family:var(--font-mono)">/uploads/&lt;app&gt;/&lt;id&gt;/</span>
	</div>
</button>
<input
	bind:this={input}
	type="file"
	multiple
	accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/html,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.html,.zip,.doc,.docx"
	style="display:none"
	onchange={(e) => {
		const files = e.currentTarget.files;
		if (files?.length) upload(files);
		e.currentTarget.value = '';
	}}
/>
<div class="dz-list">
	{#each attachments as att (att.id)}
		<div class="dz-file">
			{#if att.kind === 'image'}
				<button
					type="button"
					class="thumb thumb-shot"
					aria-label="Preview {att.filename}"
					onclick={() => openLightbox(attachments, att)}
				>
					<img src={att.url} alt="" loading="lazy" />
				</button>
			{:else}
				<span class="thumb thumb-pdf"><Icon name="file" /></span>
			{/if}
			<div class="fmeta">
				<div class="fn">{att.filename}</div>
				<div class="fs">{fmtSize(att.size)} · {kindLabel(att.kind)}</div>
			</div>
			<button type="button" class="frm" aria-label="Remove {att.filename}" onclick={() => remove(att)}>
				<Icon name="x-sm" />
			</button>
		</div>
	{/each}
</div>
