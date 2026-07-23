import type {
	MatchStrategy,
	ReportFormat,
	ResultStatus,
	SuiteEnvironment,
	TestCaseStatus,
	TestKind
} from '$lib/types';

/**
 * Shared Checkpoint presentation metadata (design §16). Framework-agnostic so
 * both the server-side exporters and the Svelte UI import the same labels and
 * colours. Colours mirror the mockup's CSS custom properties.
 */

export const TEST_KIND_META: Record<TestKind, { label: string; color: string; soft: string; cls: string }> = {
	unit: { label: 'Unit', color: '#7C3AED', soft: '#F1EAFE', cls: 'k-unit' },
	api: { label: 'API', color: '#0891B2', soft: '#E0F5FA', cls: 'k-api' },
	e2e: { label: 'E2E', color: '#5B4BFF', soft: '#EEEBFF', cls: 'k-e2e' },
	visual: { label: 'Visual', color: '#DB2777', soft: '#FDECF4', cls: 'k-visual' },
	shell: { label: 'Shell', color: '#475569', soft: '#EEF1F5', cls: 'k-shell' },
	manual: { label: 'Manual', color: '#0D9488', soft: '#E0F5F3', cls: 'k-manual' }
};

export const RESULT_META: Record<ResultStatus, { label: string; color: string; soft: string; cls: string }> = {
	pass: { label: 'Pass', color: '#2FA36B', soft: '#E7F5EE', cls: 'rd-pass' },
	fail: { label: 'Fail', color: '#E5484D', soft: '#FDECEC', cls: 'rd-fail' },
	blocked: { label: 'Blocked', color: '#F5A623', soft: '#FEF4E1', cls: 'rd-blocked' },
	skipped: { label: 'Skipped', color: '#94A3B8', soft: '#F1F4F8', cls: 'rd-skipped' }
};

export const CASE_STATUS_META: Record<TestCaseStatus, { label: string; cls: string }> = {
	active: { label: 'Active', cls: 'cs-active' },
	draft: { label: 'Draft', cls: 'cs-draft' },
	deprecated: { label: 'Deprecated', cls: 'cs-deprecated' }
};

export const ENV_LABEL: Record<SuiteEnvironment, string> = {
	local: 'Local',
	ci: 'CI',
	staging: 'Staging',
	prod: 'Prod'
};

export const REPORT_FORMAT_LABEL: Record<ReportFormat, string> = {
	'junit-xml': 'junit-xml',
	'playwright-json': 'playwright-json',
	'vitest-json': 'vitest-json',
	'pytest-json': 'pytest-json',
	tap: 'TAP',
	'checkpoint-json': 'checkpoint-json',
	'exit-code': 'exit-code + TAP stdout',
	'visual-diff': 'playwright-json + diff manifest',
	custom: 'custom'
};

export function matchStrategyLabel(m: MatchStrategy): string {
	switch (m.by) {
		case 'nodeid':
			return 'nodeid';
		case 'annotation':
			return `annotation ${m.tag}`;
		case 'testName':
			return 'test name';
		case 'snapshotName':
			return 'snapshot name';
		case 'tapName':
			return 'TAP test name';
		case 'explicitMap':
			return 'explicit map';
	}
}

/** Traffic-light colour for a pass-rate percentage (mockup `rateColor`). */
export function rateColor(pct: number | null): string {
	if (pct === null) return 'var(--muted)';
	if (pct >= 80) return 'var(--pass)';
	if (pct >= 50) return 'var(--blocked)';
	return 'var(--fail)';
}

export const IS_AUTOMATED: (k: TestKind) => boolean = (k) => k !== 'manual';

/** "820ms" · "42s" · "3m 12s" · "1h 4m". */
export function formatDuration(ms: number | null | undefined): string {
	if (ms == null) return '—';
	if (ms < 1000) return `${Math.round(ms)}ms`;
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
	const h = Math.floor(m / 60);
	return `${h}h ${m % 60}m`;
}

/** Compact "just now · 25m · 2h · 3d" relative time. */
export function timeAgo(iso: string | undefined, now: Date): string {
	if (!iso) return '—';
	const diff = now.getTime() - new Date(iso).getTime();
	if (diff < 60_000) return 'just now';
	const m = Math.floor(diff / 60_000);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}
