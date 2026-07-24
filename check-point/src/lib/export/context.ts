/**
 * Export date formatting for the failures prompt. A trimmed copy of what the
 * combined app shared with IssueDesk — Checkpoint only ever needed the date
 * helper, so none of the issue-export context comes with it.
 */

/** "2026-07-17 09:20 IST" */
export function fmtExportDate(d: Date): string {
	const date = new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(d);
	const time = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZoneName: 'short'
	})
		.format(d)
		.replace('GMT+5:30', 'IST');
	return `${date} ${time}`;
}
