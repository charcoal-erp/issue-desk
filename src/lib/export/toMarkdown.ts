import type { Issue } from '$lib/types';
import { activityMarkdown } from '$lib/activity';
import { PRIORITY_META } from '$lib/priority';
import { STATUS_META } from '$lib/status';
import { SOURCE_META } from '$lib/source';
import {
	absolutise,
	appName,
	fmtExportDate,
	humanFilter,
	userName,
	type ExportContext
} from './context';

/** One self-contained "## CHR-14 · [CRITICAL] …" section (§14.2). */
export function issueToMarkdown(issue: Issue, ctx: ExportContext): string {
	let out = `## ${issue.id} · [${PRIORITY_META[issue.priority].label.toUpperCase()}] ${issue.title}\n\n`;
	out += `| | |\n|---|---|\n`;
	out += `| **App / Module** | ${issue.appName} / ${issue.moduleName ?? 'No module'} |\n`;
	out += `| **Page / Form**  | ${issue.pagePath || issue.pageName || '—'}${issue.formName ? ' · ' + issue.formName : ''} |\n`;
	out += `| **Type**         | ${issue.type === 'bug' ? 'Bug' : 'Feature'} |\n`;
	out += `| **Status**       | ${STATUS_META[issue.status].label} |\n`;
	out += `| **Source**       | ${SOURCE_META[issue.source].label} |\n`;
	out += `| **Reporter**     | ${userName(ctx, issue.reporterId)} |\n\n`;
	out += `**Description**\n${issue.description}\n\n`;
	if (issue.attachments.length) {
		out +=
			`**Attachments**\n` +
			issue.attachments.map((a) => `- ${absolutise(ctx.baseUrl, a.url)}`).join('\n') +
			`\n\n`;
	}

	// Who said what, in order — the discussion is often where the actual
	// diagnosis lives, so it travels with the issue rather than being left
	// behind in the UI.
	const who = (id: string) => userName(ctx, id) ?? id;
	const comments = issue.activity.filter((a) => a.kind === 'comment' && a.message);
	if (comments.length) {
		out += `**Comments and progress**\n\n`;
		for (const c of comments) {
			out += `**${who(c.by)}** · ${fmtExportDate(new Date(c.at))}\n${c.message!.trim()}\n\n`;
		}
	}

	if (ctx.includeActivityTrace) {
		const history = issue.activity.filter((a) => a.kind !== 'comment');
		if (history.length) {
			out += `**Activity trace**\n`;
			for (const entry of history) {
				out += `- ${fmtExportDate(new Date(entry.at))} · ${activityMarkdown(entry, who)}\n`;
			}
			out += `\n`;
		}
	}
	return out;
}

/** The full Claude Code fix-batch prompt for a filtered result set (§14.2). */
export function toMarkdown(rows: Issue[], ctx: ExportContext): string {
	const app = appName(ctx);
	let out = `# Fix batch — ${app} (${rows.length} ${rows.length === 1 ? 'issue' : 'issues'})\n`;
	out += `_Exported from IssueDesk on ${fmtExportDate(ctx.generatedAt)}. Filter: ${humanFilter(ctx)}._\n\n`;
	out += `You are fixing reported issues${ctx.filter.appId ? ` in **${app}**` : ''}. Address each issue below.\n`;
	out += `For every fix, reference the issue ID in your commit message.\n\n`;
	for (const issue of rows) {
		out += `---\n\n` + issueToMarkdown(issue, ctx);
	}
	return out.trim();
}
