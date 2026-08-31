import type { Application, IssueFilter, User } from '$lib/types';
import { PRIORITY_META } from '$lib/priority';
import { STATUS_META } from '$lib/status';

/** Everything the pure generators need beyond the rows themselves. */
export interface ExportContext {
	baseUrl: string; // host used to absolutise attachment URLs
	generatedAt: Date;
	filter: IssueFilter;
	apps: Application[];
	users: User[];
	/**
	 * The single-issue "Copy for Claude Code" carries the whole activity trace;
	 * a batch of fifty would drown the prompt in it, so batches get the comments
	 * (which are substance) without the field-change log (which is bookkeeping).
	 */
	includeActivityTrace?: boolean;
}

export function userName(ctx: ExportContext, id: string | undefined): string | undefined {
	if (!id) return undefined;
	return ctx.users.find((u) => u.id === id)?.name ?? id;
}

export function appName(ctx: ExportContext): string {
	if (!ctx.filter.appId) return 'all applications';
	return ctx.apps.find((a) => a.id === ctx.filter.appId)?.name ?? ctx.filter.appId;
}

/** "App = Charcoal ERP · Status = Open · Priority = Critical/High" (mockup). */
export function humanFilter(ctx: ExportContext): string {
	const f = ctx.filter;
	const parts: string[] = [];
	if (f.appId) parts.push(`App = ${appName(ctx)}`);
	if (f.status?.length) parts.push(`Status = ${f.status.map((s) => STATUS_META[s].label).join('/')}`);
	if (f.priority?.length)
		parts.push(`Priority = ${f.priority.map((p) => PRIORITY_META[p].label).join('/')}`);
	if (f.type) parts.push(`Type = ${f.type}`);
	if (f.q) parts.push(`Search = "${f.q}"`);
	return parts.length ? parts.join(' · ') : 'All issues';
}

export function absolutise(baseUrl: string, url: string): string {
	return url.startsWith('/') ? baseUrl + url : url;
}

/** "2026-07-17 09:20 IST" */
export function fmtExportDate(d: Date): string {
	const date = new Intl.DateTimeFormat('en-CA', {
		year: 'numeric', month: '2-digit', day: '2-digit'
	}).format(d);
	const time = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short'
	})
		.format(d)
		.replace('GMT+5:30', 'IST');
	return `${date} ${time}`;
}
