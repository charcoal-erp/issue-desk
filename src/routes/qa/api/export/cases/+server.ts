import type { RequestHandler } from './$types';
import * as cp from '$lib/server/store/checkpoint';
import { casesToCsv, casesToJson, casesToMarkdown } from '$lib/server/checkpoint/casesIO';
import { RESULT_STATUSES, TEST_CASE_STATUSES, TEST_KINDS, type ResultStatus, type TestCaseStatus, type TestKind } from '$lib/types';

/** GET /qa/api/export/cases?format=json|csv|md&app=&kind=&status=&result=&q= */
export const GET: RequestHandler = async ({ url }) => {
	await cp.ensureLoaded();
	const format = url.searchParams.get('format') ?? 'json';
	const kind = url.searchParams.getAll('kind').filter((k): k is TestKind => (TEST_KINDS as readonly string[]).includes(k));
	const status = url.searchParams.getAll('status').filter((s): s is TestCaseStatus => (TEST_CASE_STATUSES as readonly string[]).includes(s));
	const result = url.searchParams
		.getAll('result')
		.filter((r): r is ResultStatus | 'none' => r === 'none' || (RESULT_STATUSES as readonly string[]).includes(r));

	const cases = cp.listCases({
		q: url.searchParams.get('q') ?? undefined,
		appId: url.searchParams.get('app') ?? undefined,
		kind: kind.length ? kind : undefined,
		status: status.length ? status : undefined,
		lastResult: result.length ? result : undefined
	});

	let body: string;
	let contentType: string;
	let filename: string;
	if (format === 'csv') {
		body = casesToCsv(cases);
		contentType = 'text/csv';
		filename = 'cases.csv';
	} else if (format === 'md') {
		body = casesToMarkdown(cases);
		contentType = 'text/markdown';
		filename = 'cases.md';
	} else {
		body = casesToJson(cases);
		contentType = 'application/json';
		filename = 'cases.json';
	}
	return new Response(body, {
		headers: {
			'content-type': `${contentType}; charset=utf-8`,
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};
