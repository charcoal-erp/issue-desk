import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { tallyCounts } from '$lib/counts';
import { parseFilter } from '$lib/filter';
import { createIssueSchema, updateIssueSchema } from '$lib/schemas';
import type { Priority, Status } from '$lib/types';
import { PRIORITIES, STATUSES } from '$lib/types';
import * as store from '$lib/server/store';

export const load: PageServerLoad = async ({ url }) => {
	await store.ensureLoaded();
	const filter = parseFilter(url.searchParams);
	const { rows, total } = store.list(filter);
	// Rail counts are over the whole dataset, matching the mockup.
	return { rows, total, filter, counts: tallyCounts(store.list({}).rows) };
};

/** Who the change is recorded against — the signed-in account, always. */
function actor(locals: App.Locals): string {
	return locals.user?.id ?? 'system';
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
		categoryId: String(form.get('categoryId') || '') || undefined,
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

export const actions: Actions = {
	createIssue: async ({ request, locals }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const parsed = createIssueSchema.safeParse(parseIssueForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		const draftId = String(form.get('draftId') || '') || undefined;
		try {
			const issue = await store.create(parsed.data, actor(locals), draftId);
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	updateIssue: async ({ request, locals }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const parsed = updateIssueSchema.safeParse(parseIssueForm(form));
		if (!parsed.success) return fail(400, { fieldErrors: fieldErrors(parsed.error) });
		try {
			const issue = await store.update(id, parsed.data, actor(locals));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	deleteIssue: async ({ request, locals }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		try {
			await store.remove(id, actor(locals));
			return { deleted: id };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	comment: async ({ request, locals }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const message = String(form.get('message') || '').trim();
		if (!message) return fail(400, { fieldErrors: { message: 'Write a comment first.' } });
		try {
			const issue = await store.comment(id, message, actor(locals));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	changeStatus: async ({ request, locals }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const status = String(form.get('status') || '') as Status;
		if (!(STATUSES as readonly string[]).includes(status)) {
			return fail(400, { fieldErrors: { status: 'Unknown status.' } });
		}
		try {
			const issue = await store.update(id, { status }, actor(locals));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	changePriority: async ({ request, locals }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const priority = String(form.get('priority') || '') as Priority;
		if (!(PRIORITIES as readonly string[]).includes(priority)) {
			return fail(400, { fieldErrors: { priority: 'Unknown priority.' } });
		}
		try {
			const issue = await store.update(id, { priority }, actor(locals));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	},

	changeAssignee: async ({ request, locals }) => {
		await store.ensureLoaded();
		const form = await request.formData();
		const id = String(form.get('id') || '');
		const assigneeId = String(form.get('assigneeId') || '') || undefined;
		try {
			const issue = await store.update(id, { assigneeId }, actor(locals));
			return { issue };
		} catch (e) {
			return fail(400, { fieldErrors: { form: (e as Error).message } });
		}
	}
};
