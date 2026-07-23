// ---------- Enums ----------
export const PRIORITIES = ['critical', 'very_high', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['open', 'implemented', 'complete', 'rejected'] as const;
// open→Red, implemented→Yellow, complete→Green, rejected→Slate (won't implement)
export type Status = (typeof STATUSES)[number];

export const ISSUE_TYPES = ['bug', 'feature'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

// ---------- Reference data ----------
export interface User {
	id: string; // slug, e.g. "kiran"
	name: string; // "Kiran Kharade"
	role?: string; // "Architect", "QA", "Stakeholder"
	avatarColor?: string; // hex, for the avatar chip
	active?: boolean;
	assignable?: boolean; // eligible to be an assignee; reporters can be anyone
}

export interface FormRef {
	id: string;
	name: string;
}
export interface PageRef {
	id: string;
	name: string;
	path?: string;
	forms: FormRef[];
}
export interface ModuleRef {
	id: string;
	code: string;
	name: string;
	pages?: PageRef[]; // pages/forms are now free-text on the issue, not seeded taxonomy
}

export interface Application {
	id: string; // slug, e.g. "charcoal-erp"
	code: string; // short code used in issue IDs, e.g. "CHR"
	name: string; // "Charcoal ERP"
	color?: string; // accent for app chips
	modules: ModuleRef[];
}

export interface Settings {
	productName: string;
	defaultPageSize: number;
}

// ---------- Attachments ----------
export interface Attachment {
	id: string; // uuid v7
	filename: string; // stored (sanitised) filename
	originalName: string; // as uploaded
	mime: string; // "image/png" | "application/pdf" | ...
	kind: 'image' | 'pdf';
	size: number; // bytes
	url: string; // public URL: /api/files/<app>/<issueId>/<filename>
	uploadedBy: string; // user id
	uploadedAt: string; // ISO 8601
}

// ---------- Activity / comments ----------
export interface Activity {
	id: string;
	at: string; // ISO
	by: string; // user id
	kind: 'created' | 'comment' | 'status' | 'priority' | 'assignee' | 'edit' | 'attachment';
	message?: string; // for comments
	from?: string; // for field changes
	to?: string;
}

// ---------- The core entity ----------
export interface Issue {
	id: string; // human ID, per-app sequence, e.g. "CHR-14"
	uuid: string; // uuid v7, stable internal reference
	seq: number; // 14 (the per-app number behind the ID)

	type: IssueType;
	title: string;
	description: string; // Markdown

	// Location context (all denormalised for fast filtering + export)
	appId: string;
	appCode: string;
	appName: string;
	moduleId: string;
	moduleCode: string;
	moduleName: string;
	// Page and form are free text captured on the issue (not seeded taxonomy).
	pageName?: string;
	pagePath?: string;
	formName?: string;

	priority: Priority;
	status: Status;

	reporterId: string;
	assigneeId?: string;
	tags: string[];

	attachments: Attachment[];
	activity: Activity[];

	// Checkpoint links (set only when the issue was filed from a failed test).
	testCaseId?: string; // "TC-CHR-12"
	runId?: string; // "RUN-CHR-31"

	createdAt: string; // ISO
	updatedAt: string; // ISO
}

// ---------- Query / filter ----------
export interface IssueFilter {
	q?: string; // free text over title + description + id
	appId?: string;
	moduleId?: string;
	type?: IssueType;
	status?: Status[]; // multi-select
	priority?: Priority[]; // multi-select
	reporterId?: string;
	assigneeId?: string;
	tag?: string;
	updatedFrom?: string; // ISO date
	updatedTo?: string;
	sort?: 'id' | 'title' | 'priority' | 'status' | 'updated' | 'created';
	dir?: 'asc' | 'desc';
	page?: number;
	pageSize?: number;
}

export interface CreateIssueInput {
	type: IssueType;
	title: string;
	description: string;
	appId: string;
	moduleId: string;
	page?: string; // free text — route or page name, e.g. "/login" or "Login screen"
	form?: string; // free text — form/treatment name, e.g. "OTP Verification"
	priority: Priority;
	status: Status;
	assigneeId?: string;
	tags: string[];
	attachments: Attachment[];
	// Set when the issue is filed from a failed Checkpoint test (§13).
	testCaseId?: string;
	runId?: string;
}

export type UpdateIssueInput = Partial<CreateIssueInput>;

// ============================================================================
// Checkpoint — test management (design doc §6). Reuses the shared Priority
// union and the application/module/page/form taxonomy; mirrors the Issue entity
// where they overlap so pickers, filters and rendering are shared.
// ============================================================================

// ---------- Enums ----------
export const TEST_KINDS = ['unit', 'api', 'e2e', 'visual', 'shell', 'manual'] as const;
export type TestKind = (typeof TEST_KINDS)[number];

export const TEST_CASE_STATUSES = ['active', 'draft', 'deprecated'] as const;
export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number];

export const RESULT_STATUSES = ['pass', 'fail', 'blocked', 'skipped'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const REPORT_FORMATS = [
	'junit-xml', // pytest and many others
	'playwright-json',
	'vitest-json', // Vitest / Jest JSON reporters
	'pytest-json',
	'tap', // shell scripts emitting TAP on stdout
	'checkpoint-json', // the normalized entry shape itself, for converter scripts
	'exit-code', // shell scripts with no structured output
	'visual-diff', // playwright-json plus an image-diff manifest
	'custom' // user-supplied parser module
] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const RUNNER_LANGUAGES = ['python', 'node', 'bash', 'other'] as const;
export type RunnerLanguage = (typeof RUNNER_LANGUAGES)[number];

export const SUITE_ENVIRONMENTS = ['local', 'ci', 'staging', 'prod'] as const;
export type SuiteEnvironment = (typeof SUITE_ENVIRONMENTS)[number];

export type MatchStrategy =
	| { by: 'nodeid' } // pytest: tests/x.py::test_y
	| { by: 'annotation'; tag: string } // Playwright: "@checkpoint TC-CHR-08"
	| { by: 'testName' } // Vitest / Jest full test name
	| { by: 'snapshotName' } // visual: "invoice-pdf-a4"
	| { by: 'tapName' } // TAP assertion description
	| { by: 'explicitMap' }; // curated map when nothing else is stable

// ---------- Shared taxonomy target (module/page/form) ----------
// The application lives at the top of TestCase (it drives the id prefix), so the
// target holds the module plus the free-text page/form — the same shape a new
// issue captures.
export interface IssueTarget {
	moduleId: string;
	moduleCode: string;
	moduleName: string;
	pageName?: string; // free text — route or page name
	formName?: string; // free text — form / area name
}

// ---------- Test case ----------
export interface TestStep {
	action: string; // "POST /invoices with a 10% line discount"
	expected: string; // "tax is computed on the post-discount subtotal"
}

export interface TestCase {
	id: string; // "TC-CHR-12"
	uuid: string; // stable internal reference
	seq: number; // 12 (per-app number behind the ID)

	appId: string; // "charcoal" — drives the id prefix
	appCode: string; // "CHR"
	appName: string; // "Charcoal"
	target: IssueTarget; // module / page / form (shared taxonomy)

	title: string;
	preconditions?: string;
	steps: TestStep[];
	priority: Priority; // shared five-level union
	status: TestCaseStatus;
	tags: string[];

	kind: TestKind;
	runnerId: string | null; // null only when kind === 'manual'
	specPath: string | null; // "tests/api/billing/test_tax.py"
	externalTestId: string | null; // "test_tax.py::test_discounted_subtotal"

	parentIssueId: string | null; // "CHR-15" — the issue this test verifies
	suiteIds: string[];
	issueIds: string[]; // bugs filed FROM this case

	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

// ---------- Runner ----------
export interface TestRunner {
	id: string; // "RNR-1" — numbered globally, not per-app
	name: string; // "API contract (pytest)"
	kind: TestKind;
	language: RunnerLanguage;
	command: string; // "pytest tests/api -q --junitxml=reports/api-junit.xml"
	workingDir: string; // "services/api"
	env?: Record<string, string>; // substituted into the command ($ENV, $BASE_URL)
	reportFormat: ReportFormat;
	reportPath: string; // "reports/api-junit.xml" | "stdout"
	matchStrategy: MatchStrategy;
	timeoutSec?: number;
	enabled: boolean;
}

// ---------- Suite ----------
export interface TestSuite {
	id: string; // "SUITE-CHR-1"
	seq: number;
	appId: string;
	appCode: string;
	appName: string;
	name: string; // "Billing release"
	description?: string;
	caseIds: string[]; // ORDERED
	defaultEnv: SuiteEnvironment;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

// ---------- Run ----------
export interface CaseResult {
	testCaseId: string; // "TC-CHR-12"
	runnerId: string | null;
	status: ResultStatus;
	durationMs: number | null;
	message: string | null; // assertion text / first error line
	stack: string | null; // trimmed stack or diff summary
	artifacts: string[]; // trace.zip, screenshot.png, diff.png, stdout.log
	notes?: string; // tester's note on a manual result
	issueId?: string; // if a bug was filed from this result
	flaky?: boolean; // flipped without an intervening commit
}

export interface RunnerInvocation {
	runnerId: string;
	command: string; // as executed, after env substitution
	workingDir: string;
	exitCode: number | null;
	startedAt: string;
	finishedAt?: string;
	reportPath: string;
	parsedCount: number;
	orphanCount: number;
	log?: string;
}

export interface TestRun {
	id: string; // "RUN-CHR-31"
	seq: number;
	appId: string;
	appCode: string;
	appName: string;
	suiteId?: string; // or ad-hoc
	suiteName?: string;
	environment: SuiteEnvironment;
	startedBy: string;
	startedAt: string;
	completedAt?: string;
	invocations: RunnerInvocation[]; // one per participating runner
	results: CaseResult[];
	/** Archived runs are kept when a cleanup prunes by age — the record of a
	 *  release, a regression, or anything else worth keeping indefinitely. */
	archived?: boolean;
	archivedAt?: string;
	// derived at read time: counts { pass, fail, blocked, skipped }, passRate
}

// ---------- Checkpoint form / action inputs ----------
export interface CreateTestCaseInput {
	appId: string;
	moduleId: string;
	page?: string; // free text
	form?: string; // free text
	title: string;
	preconditions?: string;
	steps: TestStep[];
	priority: Priority;
	status: TestCaseStatus;
	tags: string[];
	kind: TestKind;
	runnerId: string | null;
	specPath: string | null;
	externalTestId: string | null;
	parentIssueId: string | null;
	suiteIds: string[];
}
export type UpdateTestCaseInput = Partial<CreateTestCaseInput>;

export interface CreateSuiteInput {
	appId: string;
	name: string;
	description?: string;
	caseIds: string[];
	defaultEnv: SuiteEnvironment;
	tags: string[];
}
export type UpdateSuiteInput = Partial<Omit<CreateSuiteInput, 'appId'>>;

export interface CreateRunnerInput {
	name: string;
	kind: TestKind;
	language: RunnerLanguage;
	command: string;
	workingDir: string;
	env?: Record<string, string>;
	reportFormat: ReportFormat;
	reportPath: string;
	matchStrategy: MatchStrategy;
	timeoutSec?: number;
	enabled: boolean;
}
export type UpdateRunnerInput = Partial<CreateRunnerInput>;

/** Case filter for the Cases table (design §10.2). */
export interface TestCaseFilter {
	q?: string;
	appId?: string;
	moduleId?: string;
	kind?: TestKind[];
	status?: TestCaseStatus[];
	lastResult?: (ResultStatus | 'none')[];
	tag?: string;
}
