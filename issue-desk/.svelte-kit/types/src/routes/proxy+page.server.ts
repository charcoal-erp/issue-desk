// @ts-nocheck
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseFilter } from '$lib/filter';
import { createIssueSchema, updateIssueSchema } from '$lib/schemas';
import type { Priority, Status } from '$lib/types';
import { PRIORITIES, STATUSES } from '$lib/types';
import * as store from '$lib/server/store';

export interface FilterCounts {
	total: number;
	byApp: Record<string, number>;
	byStatus: Record<string, number>;
	byPriority: Record<string, number>;
}

export const load = async ({ url }: Parameters<PageServerLoad>[0]) => {
	await store.ensureLoaded();
	const filter = parseFilter(url.searchParams);
	const { rows, total } = store.list(filter);

	// Rail counts are over the whole dataset, matching the mockup.
	const all = store.list({}).rows;
	const counts: FilterCounts = { total: all.length, byApp: {}, byStatus: {}, byPriority: {} };
	for (const issue of all) {
		counts.byApp[issue.appId] = (counts.byApp[issue.appId] ?? 0) + 1;
		counts.byStatus[issue.status] = (counts.byStatus[issue.status] ?? 0) + 1;
		counts.byPriority[issue.priority] = (counts.byPriority[issue.priority] ?? 0) + 1;
	}
	return { rows, total, filter, counts };
};

function actor(cookies: { get(name: string): string | undefined }): string {
	const id = cookies.get('issuedesk_user');
	return store.users().some((u) => u.id === id) ? id! : (store.users()[0]?.id ?? 'system');
}

function parseIssueForm(form: FormData) {
	let attachments: unknown = [];
	try {
		attachments = JSON.parse(String(form.get('attachments') || '[]'));
	} catch {
		attachments = [];
	}
	return {
		type: String(form.get('type') || 'bug'),
		title: String(form.get('title') || ''),
		description: String(form.get('description') || ''),
		appId: String(form.get('appId') || ''),
		moduleId: String(form.get('moduleId') || ''),
		page: String(form.get('page') || '') || undefined,
		form: String(form.get('form') || '') || undefined,
		priority: String(form.get('priority') || 'high'),
		status: String(form.get('status') || 'open'),
		assigneeId: String(form.get('assigneeId') || '') || undefined,
		tags: String(form.get('tags') || '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean),
		attachments
	};
}

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? 'form');
		out[key] ??= issue.message;
	}
	return out;
}

export const actions = {
	createIssue: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const parsed = createIssueSchema.safeParse(parseIssueForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		const draftId = String(form.get('draftId') || '') || undefined;
		try {
			const issue = await store.create(parsed.data, actor(cookies), draftId);
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	updateIssue: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const parsed = updateIssueSchema.safeParse(parseIssueForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			const issue = await store.update(id, parsed.data, actor(cookies));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	deleteIssue: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		try {
			await store.remove(id, actor(cookies));
			return { deleted: id };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	comment: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const message = String(form.get('message') || '').trim();
		if (!message) return fail(400, { fieldErrors: { message: 'Write a comment first.' } });
		try {
			const issue = await store.comment(id, message, actor(cookies));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	changeStatus: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const status = String(form.get('status') || '') as Status;
		if (!(STATUSES as readonly string[]).includes(status)) {
			return fail(400, { fieldErrors: { status: 'Unknown status.' } });
		}
		try {
			const issue = await store.update(id, { status }, actor(cookies));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	changePriority: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const priority = String(form.get('priority') || '') as Priority;
		if (!(PRIORITIES as readonly string[]).includes(priority)) {
			return fail(400, { fieldErrors: { priority: 'Unknown priority.' } });
		}
		try {
			const issue = await store.update(id, { priority }, actor(cookies));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	changeAssignee: async ({ request, cookies }: import('./$types').RequestEvent) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const assigneeId = String(form.get('assigneeId') || '') || undefined;
		try {
			const issue = await store.update(id, { assigneeId }, actor(cookies));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	}
};
;null as any as Actions;