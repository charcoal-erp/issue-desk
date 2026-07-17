<script lang="ts">
	import type { Attachment } from '$lib/types';
	import { fmtSize } from '$lib/format';
	import { toast } from '$lib/stores/toasts.svelte';
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

	async function upload(files: FileList | File[]) {
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
			attachments = [...attachments, ...payload.attachments];
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
		Uploaded to <span style="font-family:var(--font-mono)">/uploads/&lt;app&gt;/&lt;id&gt;/</span> with a
		public URL
	</div>
</button>
<input
	bind:this={input}
	type="file"
	multiple
	accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
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
			<span class="thumb {att.kind === 'image' ? 'thumb-img' : 'thumb-pdf'}">
				<Icon name={att.kind === 'image' ? 'image' : 'file'} />
			</span>
			<div class="fmeta">
				<div class="fn">{att.filename}</div>
				<div class="fs">{fmtSize(att.size)} · {att.kind === 'image' ? 'Image' : 'PDF'}</div>
			</div>
			<button type="button" class="frm" aria-label="Remove {att.filename}" onclick={() => remove(att)}>
				<Icon name="x-sm" />
			</button>
		</div>
	{/each}
</div>
