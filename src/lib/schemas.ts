import { z } from 'zod';
import {
	ISSUE_TYPES,
	PRIORITIES,
	PROVIDERS,
	REFINE_MODES,
	SOURCES,
	STATUSES,
	USER_KINDS
} from './types';

const slug = z
	.string()
	.min(1)
	.regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits and dashes only');

// ---------- Reference data ----------
export const userSchema = z.object({
	id: slug,
	name: z.string().min(1),
	role: z.string().optional(),
	avatarColor: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	active: z.boolean().optional(),
	assignable: z.boolean().optional(),
	kind: z.enum(USER_KINDS).optional(),
	username: z
		.string()
		.trim()
		.min(2)
		.max(64)
		.regex(/^[a-z0-9][a-z0-9._-]*$/, 'lowercase letters, digits, dot, dash and underscore only')
		.optional(),
	admin: z.boolean().optional()
});

export const categorySchema = z.object({
	id: slug,
	name: z.string().trim().min(1),
	description: z.string().trim().max(280).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional()
});

export const formRefSchema = z.object({ id: slug, name: z.string().min(1) });

export const pageRefSchema = z.object({
	id: slug,
	name: z.string().min(1),
	path: z.string().optional(),
	forms: z.array(formRefSchema).default([])
});

export const moduleRefSchema = z.object({
	id: slug,
	code: z.string().min(1),
	name: z.string().min(1),
	pages: z.array(pageRefSchema).optional().default([])
});

export const applicationSchema = z.object({
	id: slug,
	code: z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/, '2–6 uppercase letters/digits'),
	name: z.string().min(1),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	modules: z.array(moduleRefSchema).default([])
});

export const settingsSchema = z.object({
	productName: z.string().default('IssueDesk'),
	defaultPageSize: z.number().int().positive().default(50)
});

// ---------- Attachments ----------
export const attachmentSchema = z.object({
	id: z.string().min(1),
	filename: z.string().min(1),
	originalName: z.string().min(1),
	mime: z.string().min(1),
	kind: z.enum(['image', 'pdf', 'doc', 'archive', 'html']),
	size: z.number().int().nonnegative(),
	url: z.string().min(1),
	uploadedBy: z.string().min(1),
	uploadedAt: z.string().min(1)
});

// ---------- Activity ----------
export const activitySchema = z.object({
	id: z.string().min(1),
	at: z.string().min(1),
	by: z.string().min(1),
	kind: z.enum(['created', 'comment', 'status', 'priority', 'assignee', 'edit', 'attachment']),
	message: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional()
});

// ---------- Issue ----------
export const issueSchema = z.object({
	id: z.string().min(1),
	uuid: z.string().min(1),
	seq: z.number().int().positive(),
	type: z.enum(ISSUE_TYPES),
	title: z.string().min(1),
	description: z.string().default(''),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	moduleId: slug.optional(),
	moduleCode: z.string().min(1).optional(),
	moduleName: z.string().min(1).optional(),
	pageName: z.string().optional(),
	pagePath: z.string().optional(),
	formName: z.string().optional(),
	priority: z.enum(PRIORITIES),
	status: z.enum(STATUSES),
	// Issues written before the source field existed are manual by definition:
	// nothing else could have filed them.
	source: z.enum(SOURCES).default('manual-testing'),
	reporterId: z.string().min(1),
	assigneeId: z.string().optional(),
	categoryId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	attachments: z.array(attachmentSchema).default([]),
	activity: z.array(activitySchema).default([]),
	testCaseId: z.string().optional(),
	runId: z.string().optional(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1)
});

export const sequenceSchema = z.object({
	code: z.string().min(1),
	next: z.number().int().positive()
});

// ---------- Form action inputs ----------
export const createIssueSchema = z.object({
	type: z.enum(ISSUE_TYPES),
	title: z.string().trim().min(1, 'Title is required').max(200, 'Keep the title under 200 characters'),
	description: z.string().default(''),
	appId: z.string().min(1, 'Application is required'),
	moduleId: z.string().optional(),
	page: z.string().trim().max(200).optional(),
	form: z.string().trim().max(200).optional(),
	priority: z.enum(PRIORITIES),
	status: z.enum(STATUSES),
	assigneeId: z.string().optional(),
	categoryId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	attachments: z.array(attachmentSchema).default([]),
	testCaseId: z.string().optional(),
	runId: z.string().optional()
});

export const updateIssueSchema = createIssueSchema.partial();

// ---------- Authentication ----------
/**
 * Credentials as stored in data/auth/credentials.json (0600). Only the scrypt
 * digest is kept; `updatedAt` doubles as a revocation stamp — a JWT issued
 * before the current password was set is refused, so a password change logs
 * every outstanding token out.
 */
export const storedCredentialsSchema = z.object({
	userId: slug,
	hash: z.string().min(1), // "scrypt$N$r$p$<salt-b64>$<key-b64>"
	updatedAt: z.string().min(1)
});

export const loginRequestSchema = z.object({
	username: z.string().trim().min(1, 'Username is required'),
	password: z.string().min(1, 'Password is required')
});

/**
 * Deliberately generous at the top end and strict at the bottom: agent
 * passwords are machine-generated and long, human ones just need to clear a
 * floor worth defending.
 */
export const passwordSchema = z
	.string()
	.min(10, 'Use at least 10 characters')
	.max(200, 'Keep it under 200 characters');

// ---------- Agent API ----------
/**
 * The transitions an agent may drive. Verification is a human's call, so
 * `complete` and `rejected` are missing here — but this is a statement about
 * agent *accounts*, not about the endpoint: a human hitting the same route
 * keeps the full range, so the restriction is applied per-caller
 * (`mayNotSetStatus`) rather than baked into the request schema.
 */
export const AGENT_STATUSES = ['open', 'in-progress', 'to-be-verified'] as const;

export const agentStatusRequestSchema = z.object({
	status: z.enum(STATUSES),
	comment: z.string().trim().max(5000).optional()
});

export const agentCommentRequestSchema = z.object({
	message: z.string().trim().min(1, 'Comment cannot be empty').max(5000)
});

export const agentClaimRequestSchema = z.object({
	comment: z.string().trim().max(5000).optional()
});

// ---------- Generative AI ----------
/** On-disk shape of an encrypted provider key (never leaves the server). */
export const storedCredentialSchema = z.object({
	provider: z.enum(PROVIDERS),
	ciphertext: z.string().min(1),
	iv: z.string().min(1),
	authTag: z.string().min(1),
	hint: z.string().min(1),
	status: z.enum(['configured', 'error']),
	lastTestedAt: z.string().optional(),
	lastRotatedAt: z.string().optional(),
	lastError: z.string().optional()
});

export const refineRequestSchema = z.object({
	description: z.string().min(1, 'Nothing to refine — write a description first.'),
	mode: z.enum(REFINE_MODES),
	instruction: z.string().trim().max(500).optional()
});

export const extractTagsRequestSchema = z.object({
	title: z.string().default(''),
	description: z.string().default('')
});

/** The model returns a JSON array of tag slugs; bound its size, fail closed. */
export const extractedTagsSchema = z.array(z.string().min(1).max(40)).min(1).max(12);
