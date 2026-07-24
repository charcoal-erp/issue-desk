<script lang="ts">
	interface RunCounts {
		pass: number;
		fail: number;
		blocked: number;
		skipped: number;
		total: number;
	}

	let { counts }: { counts: RunCounts } = $props();
	const total = $derived(counts.total || 1);
	const pct = (n: number) => (n / total) * 100;
</script>

<div class="prog">
	<div class="seg-p" style="width:{pct(counts.pass)}%"></div>
	<div class="seg-f" style="width:{pct(counts.fail)}%"></div>
	<div class="seg-b" style="width:{pct(counts.blocked)}%"></div>
	<div class="seg-s" style="width:{pct(counts.skipped)}%"></div>
</div>
