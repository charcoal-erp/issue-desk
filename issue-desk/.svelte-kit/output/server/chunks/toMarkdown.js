import { i as STATUS_META, o as PRIORITY_META } from "./types.js";
//#region src/lib/export/context.ts
function userName(ctx, id) {
	if (!id) return void 0;
	return ctx.users.find((u) => u.id === id)?.name ?? id;
}
function appName(ctx) {
	if (!ctx.filter.appId) return "all applications";
	return ctx.apps.find((a) => a.id === ctx.filter.appId)?.name ?? ctx.filter.appId;
}
/** "App = Charcoal ERP · Status = Open · Priority = Critical/High" (mockup). */
function humanFilter(ctx) {
	const f = ctx.filter;
	const parts = [];
	if (f.appId) parts.push(`App = ${appName(ctx)}`);
	if (f.status?.length) parts.push(`Status = ${f.status.map((s) => STATUS_META[s].label).join("/")}`);
	if (f.priority?.length) parts.push(`Priority = ${f.priority.map((p) => PRIORITY_META[p].label).join("/")}`);
	if (f.type) parts.push(`Type = ${f.type}`);
	if (f.q) parts.push(`Search = "${f.q}"`);
	return parts.length ? parts.join(" · ") : "All issues";
}
function absolutise(baseUrl, url) {
	return url.startsWith("/") ? baseUrl + url : url;
}
/** "2026-07-17 09:20 IST" */
function fmtExportDate(d) {
	return `${new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(d)} ${new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZoneName: "short"
	}).format(d).replace("GMT+5:30", "IST")}`;
}
//#endregion
//#region src/lib/export/toMarkdown.ts
/** One self-contained "## CHR-14 · [CRITICAL] …" section (§14.2). */
function issueToMarkdown(issue, ctx) {
	let out = `## ${issue.id} · [${PRIORITY_META[issue.priority].label.toUpperCase()}] ${issue.title}\n\n`;
	out += `| | |\n|---|---|\n`;
	out += `| **App / Module** | ${issue.appName} / ${issue.moduleName} |\n`;
	out += `| **Page / Form**  | ${issue.pagePath || issue.pageName || "—"}${issue.formName ? " · " + issue.formName : ""} |\n`;
	out += `| **Type**         | ${issue.type === "bug" ? "Bug" : "Feature"} |\n`;
	out += `| **Status**       | ${STATUS_META[issue.status].label} |\n`;
	out += `| **Reporter**     | ${userName(ctx, issue.reporterId)} |\n\n`;
	out += `**Description**\n${issue.description}\n\n`;
	if (issue.attachments.length) out += `**Attachments**\n` + issue.attachments.map((a) => `- ${absolutise(ctx.baseUrl, a.url)}`).join("\n") + `\n\n`;
	return out;
}
/** The full Claude Code fix-batch prompt for a filtered result set (§14.2). */
function toMarkdown(rows, ctx) {
	const app = appName(ctx);
	let out = `# Fix batch — ${app} (${rows.length} ${rows.length === 1 ? "issue" : "issues"})\n`;
	out += `_Exported from IssueDesk on ${fmtExportDate(ctx.generatedAt)}. Filter: ${humanFilter(ctx)}._\n\n`;
	out += `You are fixing reported issues${ctx.filter.appId ? ` in **${app}**` : ""}. Address each issue below.\n`;
	out += `For every fix, reference the issue ID in your commit message.\n\n`;
	for (const issue of rows) out += `---\n\n` + issueToMarkdown(issue, ctx);
	return out.trim();
}
//#endregion
export { userName as i, toMarkdown as n, absolutise as r, issueToMarkdown as t };
