import type { Issue } from '$lib/types';
import { absolutise, userName, type ExportContext } from './context';

/** Compact machine-friendly export (§14.1). */
export function toJsonExport(rows: Issue[], ctx: ExportContext): object {
	const f = ctx.filter;
	return {
		generatedAt: ctx.generatedAt.toISOString(),
		filter: {
			appId: f.appId || undefined,
			moduleId: f.moduleId || undefined,
			status: f.status?.length ? f.status : undefined,
			priority: f.priority?.length ? f.priority : undefined,
			type: f.type || undefined,
			q: f.q || undefined
		},
		count: rows.length,
		issues: rows.map((issue) => ({
			id: issue.id,
			type: issue.type,
			title: issue.title,
			app: issue.appName,
			module: issue.moduleName,
			page: issue.pagePath || issue.pageName || undefined,
			form: issue.formName || undefined,
			priority: issue.priority,
			status: issue.status,
			reporter: userName(ctx, issue.reporterId),
			assignee: userName(ctx, issue.assigneeId),
			description: issue.description,
			attachments: issue.attachments.map((a) => absolutise(ctx.baseUrl, a.url))
		}))
	};
}

export function toJson(rows: Issue[], ctx: ExportContext): string {
	return JSON.stringify(toJsonExport(rows, ctx), null, 2);
}
