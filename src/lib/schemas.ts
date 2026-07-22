import { z } from 'zod';
import {
	ISSUE_TYPES,
	PRIORITIES,
	REPORT_FORMATS,
	RESULT_STATUSES,
	RUNNER_LANGUAGES,
	STATUSES,
	SUITE_ENVIRONMENTS,
	TEST_CASE_STATUSES,
	TEST_KINDS
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
	assignable: z.boolean().optional()
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
	kind: z.enum(['image', 'pdf']),
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
	moduleId: slug,
	moduleCode: z.string().min(1),
	moduleName: z.string().min(1),
	pageName: z.string().optional(),
	pagePath: z.string().optional(),
	formName: z.string().optional(),
	priority: z.enum(PRIORITIES),
	status: z.enum(STATUSES),
	reporterId: z.string().min(1),
	assigneeId: z.string().optional(),
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
	moduleId: z.string().min(1, 'Module is required'),
	page: z.string().trim().max(200).optional(),
	form: z.string().trim().max(200).optional(),
	priority: z.enum(PRIORITIES),
	status: z.enum(STATUSES),
	assigneeId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	attachments: z.array(attachmentSchema).default([])
});

export const updateIssueSchema = createIssueSchema.partial();

// ============================================================================
// Checkpoint — persisted entity schemas (boot-time validation, design doc §19).
// ============================================================================

export const issueTargetSchema = z.object({
	moduleId: slug,
	moduleCode: z.string().min(1),
	moduleName: z.string().min(1),
	pageName: z.string().optional(),
	formName: z.string().optional()
});

export const testStepSchema = z.object({
	action: z.string().default(''),
	expected: z.string().default('')
});

export const matchStrategySchema = z.discriminatedUnion('by', [
	z.object({ by: z.literal('nodeid') }),
	z.object({ by: z.literal('annotation'), tag: z.string().min(1) }),
	z.object({ by: z.literal('testName') }),
	z.object({ by: z.literal('snapshotName') }),
	z.object({ by: z.literal('tapName') }),
	z.object({ by: z.literal('explicitMap') })
]);

export const testCaseSchema = z.object({
	id: z.string().min(1),
	uuid: z.string().min(1),
	seq: z.number().int().positive(),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	target: issueTargetSchema,
	title: z.string().min(1),
	preconditions: z.string().optional(),
	steps: z.array(testStepSchema).default([]),
	priority: z.enum(PRIORITIES),
	status: z.enum(TEST_CASE_STATUSES),
	tags: z.array(z.string()).default([]),
	kind: z.enum(TEST_KINDS),
	runnerId: z.string().nullable().default(null),
	specPath: z.string().nullable().default(null),
	externalTestId: z.string().nullable().default(null),
	parentIssueId: z.string().nullable().default(null),
	suiteIds: z.array(z.string()).default([]),
	issueIds: z.array(z.string()).default([]),
	createdBy: z.string().min(1),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1)
});

export const testRunnerSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	kind: z.enum(TEST_KINDS),
	language: z.enum(RUNNER_LANGUAGES),
	command: z.string().default(''),
	workingDir: z.string().default(''),
	env: z.record(z.string(), z.string()).optional(),
	reportFormat: z.enum(REPORT_FORMATS),
	reportPath: z.string().default(''),
	matchStrategy: matchStrategySchema,
	timeoutSec: z.number().int().positive().optional(),
	enabled: z.boolean().default(true)
});

export const testSuiteSchema = z.object({
	id: z.string().min(1),
	seq: z.number().int().positive(),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	caseIds: z.array(z.string()).default([]),
	defaultEnv: z.enum(SUITE_ENVIRONMENTS),
	tags: z.array(z.string()).default([]),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1)
});

export const caseResultSchema = z.object({
	testCaseId: z.string().min(1),
	runnerId: z.string().nullable().default(null),
	status: z.enum(RESULT_STATUSES),
	durationMs: z.number().nullable().default(null),
	message: z.string().nullable().default(null),
	stack: z.string().nullable().default(null),
	artifacts: z.array(z.string()).default([]),
	notes: z.string().optional(),
	issueId: z.string().optional(),
	flaky: z.boolean().optional()
});

export const runnerInvocationSchema = z.object({
	runnerId: z.string().min(1),
	command: z.string().default(''),
	workingDir: z.string().default(''),
	exitCode: z.number().nullable().default(null),
	startedAt: z.string().min(1),
	finishedAt: z.string().optional(),
	reportPath: z.string().default(''),
	parsedCount: z.number().int().nonnegative().default(0),
	orphanCount: z.number().int().nonnegative().default(0),
	log: z.string().optional()
});

export const testRunSchema = z.object({
	id: z.string().min(1),
	seq: z.number().int().positive(),
	appId: slug,
	appCode: z.string().min(1),
	appName: z.string().min(1),
	suiteId: z.string().optional(),
	suiteName: z.string().optional(),
	environment: z.enum(SUITE_ENVIRONMENTS),
	startedBy: z.string().min(1),
	startedAt: z.string().min(1),
	completedAt: z.string().optional(),
	invocations: z.array(runnerInvocationSchema).default([]),
	results: z.array(caseResultSchema).default([])
});

/** Per-app Checkpoint counters — the next id to allocate for each entity. */
export const checkpointSequenceSchema = z.object({
	testCase: z.number().int().positive().default(1),
	suite: z.number().int().positive().default(1),
	run: z.number().int().positive().default(1)
});
