<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	// A select that can carry the colour language a native <option> cannot —
	// priority pips, status dots. Closed, it is a plain `.sel` so it lines up
	// with the real selects beside it; open, each row renders the same swatch
	// the rest of the app uses.
	let {
		value = $bindable(),
		options,
		id,
		placeholder = 'Select…',
		disabled = false,
		decor
	}: {
		value: T;
		options: { value: T; label: string; title?: string }[];
		id?: string;
		placeholder?: string;
		disabled?: boolean;
		/** Leading swatch for a value, drawn in the trigger and in every row. */
		decor?: Snippet<[T]>;
	} = $props();

	const uid = $props.id();

	let open = $state(false);
	let active = $state(0);
	let btn = $state<HTMLButtonElement | undefined>();
	let pop = $state<HTMLDivElement | undefined>();
	let box = $state({ left: 0, width: 0, top: 0, bottom: 0, up: false, maxH: 280 });

	const selected = $derived(options.find((o) => o.value === value));

	/**
	 * The popup is fixed-positioned so the scrolling modal body cannot clip it,
	 * which means its coordinates have to be taken from the trigger each time.
	 */
	function place(): void {
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		const below = window.innerHeight - r.bottom - 12;
		const above = r.top - 12;
		const wanted = Math.min(options.length * 38 + 10, 300);
		const up = below < wanted && above > below;
		box = {
			left: r.left,
			width: r.width,
			top: r.bottom + 4,
			bottom: window.innerHeight - r.top + 4,
			up,
			maxH: Math.max(120, Math.min(wanted, up ? above : below))
		};
	}

	function openMenu(): void {
		if (disabled) return;
		const i = options.findIndex((o) => o.value === value);
		active = i < 0 ? 0 : i;
		place();
		open = true;
	}

	function closeMenu(refocus = true): void {
		open = false;
		if (refocus) btn?.focus();
	}

	function pick(v: T): void {
		value = v;
		closeMenu();
	}

	function onKeydown(e: KeyboardEvent): void {
		if (!open) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				openMenu();
			}
			return;
		}
		switch (e.key) {
			case 'Escape':
				// Swallow it: the modal also listens for Escape, and dismissing a
				// dropdown should never take the half-typed issue with it.
				e.preventDefault();
				e.stopPropagation();
				closeMenu();
				break;
			case 'ArrowDown':
				e.preventDefault();
				active = (active + 1) % options.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				active = (active - 1 + options.length) % options.length;
				break;
			case 'Home':
				e.preventDefault();
				active = 0;
				break;
			case 'End':
				e.preventDefault();
				active = options.length - 1;
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				if (options[active]) pick(options[active].value);
				break;
			case 'Tab':
				closeMenu(false);
				break;
		}
	}

	// Anchored in viewport space, so anything that moves the trigger — scrolling
	// the form, resizing the window — has to dismiss it rather than leave it
	// floating over unrelated fields.
	$effect(() => {
		if (!open) return;
		const away = (e: Event) => {
			const t = e.target as Node;
			if (!btn?.contains(t) && !pop?.contains(t)) closeMenu(false);
		};
		const dismiss = (e: Event) => {
			if (pop?.contains(e.target as Node)) return; // the list scrolling itself
			closeMenu(false);
		};
		window.addEventListener('pointerdown', away, true);
		window.addEventListener('scroll', dismiss, true);
		window.addEventListener('resize', dismiss);
		return () => {
			window.removeEventListener('pointerdown', away, true);
			window.removeEventListener('scroll', dismiss, true);
			window.removeEventListener('resize', dismiss);
		};
	});
</script>

<button
	type="button"
	{id}
	{disabled}
	bind:this={btn}
	class="sel smenu-btn"
	class:open
	role="combobox"
	aria-controls="{uid}-list"
	aria-expanded={open}
	aria-haspopup="listbox"
	aria-activedescendant={open ? `${uid}-opt-${active}` : undefined}
	onclick={() => (open ? closeMenu(false) : openMenu())}
	onkeydown={onKeydown}
>
	{#if decor && selected}{@render decor(selected.value)}{/if}
	<span class="smenu-label" class:ph={!selected}>{selected?.label ?? placeholder}</span>
</button>

{#if open}
	<div
		bind:this={pop}
		id="{uid}-list"
		class="smenu-pop"
		role="listbox"
		tabindex="-1"
		style="left:{box.left}px; width:{box.width}px; max-height:{box.maxH}px; {box.up
			? `bottom:${box.bottom}px`
			: `top:${box.top}px`}"
	>
		{#each options as o, i (o.value)}
			<button
				type="button"
				id="{uid}-opt-{i}"
				class="smenu-opt"
				class:on={o.value === value}
				class:active={i === active}
				role="option"
				aria-selected={o.value === value}
				title={o.title}
				onclick={() => pick(o.value)}
				onmousemove={() => (active = i)}
			>
				{#if decor}{@render decor(o.value)}{/if}
				<span class="smenu-label">{o.label}</span>
				{#if o.value === value}<span class="smenu-tick"><Icon name="check-sm" /></span>{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.smenu-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
		/* Matches what `input, select, textarea` get globally, so this sits at
		   exactly the same height as the native selects next to it. */
		font-size: 14px;
		line-height: normal;
		color: var(--ink);
	}
	.smenu-btn.open {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	.smenu-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.smenu-label.ph {
		color: var(--faint);
	}
	.smenu-pop {
		position: fixed;
		z-index: 210;
		overflow-y: auto;
		padding: 4px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 10px;
		box-shadow: var(--shadow-lg);
		animation: pop 0.12s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.smenu-opt {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 9px;
		border-radius: 7px;
		border: 1px solid transparent;
		background: transparent;
		font-size: 13px;
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.smenu-opt.active {
		background: var(--surface-2);
	}
	.smenu-opt.on {
		color: var(--ink);
		font-weight: 600;
	}
	.smenu-tick {
		display: inline-flex;
		color: var(--accent);
	}
	.smenu-tick :global(svg) {
		width: 14px;
		height: 14px;
	}
</style>
