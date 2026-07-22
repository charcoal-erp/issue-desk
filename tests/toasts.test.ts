import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismiss, toast, toasts } from '$lib/stores/toasts.svelte';

/** The store is module-level, so clear it between cases. */
function reset() {
	toasts().splice(0, toasts().length);
}

describe('toasts', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		reset();
	});
	afterEach(() => {
		reset();
		vi.useRealTimers();
	});

	it('fades out and then removes itself', () => {
		toast('Saved CHR-1', 'Changes written');
		expect(toasts()).toHaveLength(1);

		vi.advanceTimersByTime(2600);
		expect(toasts()[0].out).toBe(true);

		vi.advanceTimersByTime(300);
		expect(toasts()).toHaveLength(0);
	});

	it('clears a burst of toasts rather than stacking them forever', () => {
		toast('Screenshot attached');
		toast('Created CHR-4');
		toast('Saved CHR-3');
		expect(toasts()).toHaveLength(3);

		vi.advanceTimersByTime(2900);
		expect(toasts()).toHaveLength(0);
	});

	it('dismisses on demand, without waiting out the timer', () => {
		toast('Saved CHR-1');
		const { id } = toasts()[0];

		dismiss(id);
		expect(toasts()[0].out).toBe(true);

		vi.advanceTimersByTime(300);
		expect(toasts()).toHaveLength(0);
	});

	it('ignores a second dismiss of the same toast', () => {
		toast('Saved CHR-1');
		const { id } = toasts()[0];

		dismiss(id);
		dismiss(id);
		vi.advanceTimersByTime(300);
		expect(toasts()).toHaveLength(0);

		// The auto-dismiss timer still fires later; it must not throw or
		// remove a newer toast that reused the slot.
		toast('Later toast');
		vi.advanceTimersByTime(2300);
		expect(toasts()).toHaveLength(1);
	});
});
