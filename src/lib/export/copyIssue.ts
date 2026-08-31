import type { Issue, User } from '$lib/types';
import { issueToMarkdown } from './toMarkdown';

/** Single-issue prompt for the per-row / drawer "Copy for Claude Code". */
export function singleIssueMarkdown(issue: Issue, users: User[], baseUrl: string): string {
	return issueToMarkdown(issue, {
		baseUrl,
		generatedAt: new Date(),
		filter: {},
		apps: [],
		users,
		includeActivityTrace: true
	}).trim();
}
