<script lang="ts">
	import { fmtSize } from '$lib/format';
	import { closeLightbox, stepLightbox, ui } from '$lib/stores/ui.svelte';
	import Icon from './Icon.svelte';

	// Only rendered while ui.lightbox is set, so the non-null assertions hold.
	const box = $derived(ui.lightbox!);
	const current = $derived(box.items[box.index]);
	const many = $derived(box.items.length > 1);

	let closeBtn = $state<HTMLButtonElement | undefined>();

	// Escape lives in +layout so it can close the preview without also closing
	// the issue modal underneath it.
	function onKeydown(e: KeyboardEvent) {
		if (!many) return;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			stepLightbox(-1);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			stepLightbox(1);
		}
	}

	/** Clicking the empty space around the image dismisses it; the image itself doesn't. */
	function onBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) closeLightbox();
	}

	$effect(() => {
		closeBtn?.focus();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="lb" role="presentation" onclick={onBackdrop}>
	<div class="lb-bar">
		<div class="lb-meta">
			<div class="lb-name">{current.filename}</div>
			<div class="lb-sub">
				{fmtSize(current.size)}
				{#if many}· {box.index + 1} of {box.items.length}{/if}
			</div>
		</div>
		<a class="lb-btn" href={current.url} target="_blank" rel="noopener" title="Open original">
			<Icon name="download" />
		</a>
		<button
			bind:this={closeBtn}
			type="button"
			class="lb-btn"
			onclick={closeLightbox}
			aria-label="Close preview"
		>
			<Icon name="x" />
		</button>
	</div>

	<div class="lb-stage" role="presentation" onclick={onBackdrop}>
		{#if many}
			<button
				type="button"
				class="lb-nav prev"
				onclick={() => stepLightbox(-1)}
				aria-label="Previous image"
			>
				<Icon name="chevron" />
			</button>
		{/if}
		<!-- keyed so swapping images doesn't briefly show the previous one -->
		{#key current.id}
			<img class="lb-img" src={current.url} alt={current.filename} />
		{/key}
		{#if many}
			<button
				type="button"
				class="lb-nav next"
				onclick={() => stepLightbox(1)}
				aria-label="Next image"
			>
				<Icon name="chevron" />
			</button>
		{/if}
	</div>
</div>
