// ---------- Enums ----------
export const PRIORITIES = ['critical', 'very_high', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
	'backlog',
	'open',
	'in-progress',
	'to-be-verified',
	'complete',
	'rejected'
] as const;
// backlog→Violet (parked), open→Red, in-progress→Yellow, to-be-verified→Blue,
// complete→Green, rejected→Slate (won't implement)
export type Status = (typeof STATUSES)[number];

/**
 * Where the issue came from. Set automatically from who filed it — a person
 * through the UI is manual testing, an agent account is agent testing, and the
 * Checkpoint ingest path is a triggered test run — so it stays trustworthy
 * rather than becoming another dropdown to get wrong.
 */
export const SOURCES = ['manual-testing', 'checkpoint-triggered', 'agent-testing'] as const;
export type Source = (typeof SOURCES)[number];

export const ISSUE_TYPES = ['bug', 'feature'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

// ---------- Reference data ----------
/**
 * Accounts are either people who sign in through the browser, or agents (a
 * Claude Code session) that sign in over the API for a JWT. Same credential
 * mechanism for both; the kind is what activity lines and agent-only rules key
 * off, so a fix landed by an agent is never mistaken for a human's.
 */
export const USER_KINDS = ['human', 'agent'] as const;
export type UserKind = (typeof USER_KINDS)[number];

export interface User {
	id: string; // slug, e.g. "kiran"
	name: string; // "Kiran Kharade"
	role?: string; // "Architect", "QA", "Stakeholder"
	avatarColor?: string; // hex, for the avatar chip
	active?: boolean;
	assignable?: boolean; // eligible to be an assignee; reporters can be anyone
	kind?: UserKind; // undefined = "human" (every pre-auth account)
	username?: string; // login name; undefined = the id
	admin?: boolean; // may reach Config and manage passwords
}

/**
 * A cross-cutting label for what an issue is *about* — orthogonal to the app /
 * module taxonomy, which says where it lives. Agents pull work by category
 * ("give me the open auth bugs"); `tags` stay free-form and are filtered
 * separately.
 */
export interface Category {
	id: string; // slug, e.g. "authentication"
	name: string; // "Authentication"
	description?: string; // shown as help text on the picker
	color?: string; // hex, for the chip
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
	kind: 'image' | 'pdf' | 'doc' | 'archive' | 'html';
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
	// Module is optional — plenty of issues are filed before anyone knows which
	// module owns them, and forcing a guess is worse than leaving it blank.
	moduleId?: string;
	moduleCode?: string;
	moduleName?: string;
	// Page and form are free text captured on the issue (not seeded taxonomy).
	pageName?: string;
	pagePath?: string;
	formName?: string;

	priority: Priority;
	status: Status;
	source: Source;

	reporterId: string;
	assigneeId?: string;
	categoryId?: string; // slug into config/categories.json
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
	source?: Source[]; // multi-select
	reporterId?: string;
	assigneeId?: string;
	categoryId?: string;
	tag?: string;
	updatedFrom?: string; // ISO date (inclusive)
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
	moduleId?: string;
	page?: string; // free text — route or page name, e.g. "/login" or "Login screen"
	form?: string; // free text — form/treatment name, e.g. "OTP Verification"
	priority: Priority;
	status: Status;
	assigneeId?: string;
	categoryId?: string;
	tags: string[];
	attachments: Attachment[];
	// Set when the issue is filed from a failed Checkpoint test (§13).
	testCaseId?: string;
	runId?: string;
}

export type UpdateIssueInput = Partial<CreateIssueInput>;

// ---------- Generative AI (§ LLM support) ----------
// One provider today (Anthropic), but modelled as an enum so a second could be
// added without reshaping the vault or the Keys screen.
export const PROVIDERS = ['anthropic'] as const;
export type Provider = (typeof PROVIDERS)[number];

export interface ProviderMeta {
	label: string;
	envKey: string; // env var read as a fallback when the vault has no entry
	keyHint: string; // placeholder shown on the Keys screen
	defaultModel: string; // used for refinement
	fastModel: string; // used for the cheaper tag-extraction call
}

export const PROVIDER_META: Record<Provider, ProviderMeta> = {
	anthropic: {
		label: 'Anthropic (Claude)',
		envKey: 'ANTHROPIC_API_KEY',
		keyHint: 'sk-ant-…',
		defaultModel: 'claude-opus-4-8',
		fastModel: 'claude-haiku-4-5'
	}
};

/** Client-safe view of a stored credential — never carries key material. */
export interface CredentialStatusView {
	provider: Provider;
	status: 'unset' | 'configured' | 'error';
	hint: string; // masked, e.g. "••••4f2a" or "••••env"
	source: 'vault' | 'env' | 'none';
	lastTestedAt?: string;
	lastRotatedAt?: string;
	lastError?: string;
}

// Description-refinement modes, analogous to Prism's prompt refiner. The system
// prompts live server-side; only these labels reach the client.
// ---------- Authentication (§ auth) ----------
/**
 * The identity attached to a request, in both directions: it is what
 * `locals.user` carries after the hook resolves a session cookie or a bearer
 * JWT, and what `/api/auth/login` echoes back. Deliberately a subset of `User`
 * — no credential material can travel on it.
 */
export interface SessionUser {
	id: string;
	name: string;
	username: string;
	kind: UserKind;
	admin: boolean;
	role?: string;
	avatarColor?: string;
}

/** JWT payload. Short names because they ride in every agent request. */
export interface TokenClaims {
	sub: string; // user id
	usr: string; // username
	knd: UserKind;
	adm: boolean;
	iat: number; // seconds
	exp: number; // seconds
	iss: 'issuedesk';
}

export interface LoginResult {
	token: string;
	tokenType: 'Bearer';
	expiresAt: string; // ISO — when `token` stops being accepted
	expiresIn: number; // seconds, for clients that prefer a duration
	user: SessionUser;
}

export const REFINE_MODES = [
	'clarify',
	'itemize',
	'repro',
	'structure',
	'concise',
	'strengthen',
	'custom'
] as const;
export type RefineMode = (typeof REFINE_MODES)[number];
