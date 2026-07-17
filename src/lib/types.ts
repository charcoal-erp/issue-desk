// ---------- Enums ----------
export const PRIORITIES = ['critical', 'very_high', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['open', 'implemented', 'complete'] as const;
export type Status = (typeof STATUSES)[number]; // open→Red, implemented→Yellow, complete→Green

export const ISSUE_TYPES = ['bug', 'feature'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

// ---------- Reference data ----------
export interface User {
	id: string; // slug, e.g. "kiran"
	name: string; // "Kiran Kharade"
	role?: string; // "Architect", "QA", "Stakeholder"
	avatarColor?: string; // hex, for the avatar chip
	active?: boolean;
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
	pages: PageRef[];
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
	pageId?: string;
	pageName?: string;
	pagePath?: string;
	formId?: string;
	formName?: string;

	priority: Priority;
	status: Status;

	reporterId: string;
	assigneeId?: string;
	tags: string[];

	attachments: Attachment[];
	activity: Activity[];

	createdAt: string; // ISO
	updatedAt: string; // ISO
}

// ---------- Query / filter ----------
export interface IssueFilter {
	q?: string; // free text over title + description + id
	appId?: string;
	moduleId?: string;
	pageId?: string;
	formId?: string;
	type?: IssueType;
	status?: Status[]; // multi-select
	priority?: Priority[]; // multi-select
	reporterId?: string;
	assigneeId?: string;
	tag?: string;
	updatedFrom?: string; // ISO date
	updatedTo?: string;
	sort?: 'id' | 'title' | 'priority' | 'status' | 'updated';
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
	pageId?: string;
	formId?: string;
	priority: Priority;
	status: Status;
	assigneeId?: string;
	tags: string[];
	attachments: Attachment[];
}

export type UpdateIssueInput = Partial<CreateIssueInput>;
