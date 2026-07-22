/**
 * Cross-screen Checkpoint UI state (the Launch and Failures modals overlay any
 * screen). Screen-local overlays — the case drawer, the case/suite forms — are
 * kept in their own screens or driven by URL params, not here.
 */
export type FailureScope =
	| { kind: 'all' }
	| { kind: 'run'; runId: string }
	| { kind: 'case'; caseId: string }
	| { kind: 'filter'; query: string };

interface CpUiState {
	launch: { suiteId: string | null } | null;
	failures: FailureScope | null;
}

export const cpUi = $state<CpUiState>({ launch: null, failures: null });

export function openLaunch(suiteId: string | null = null): void {
	cpUi.launch = { suiteId };
}
export function closeLaunch(): void {
	cpUi.launch = null;
}
export function openFailures(scope: FailureScope): void {
	cpUi.failures = scope;
}
export function closeFailures(): void {
	cpUi.failures = null;
}
