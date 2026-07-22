import type { CaseResult, CreateIssueInput, TestCase, TestRun, TestRunner } from '$lib/types';

/**
 * Prefill an IssueDesk issue from a failed test result (design §13). The
 * application / module / page / form come straight from the case's target — no
 * re-selection — and the description assembles a reproduction from the steps,
 * the actual error and (for automated kinds) the reproduce command.
 */
export function resultToIssueInput(
	c: TestCase,
	result: CaseResult,
	run?: TestRun,
	runner?: TestRunner
): CreateIssueInput {
	const automated = c.kind !== 'manual';
	const lines: string[] = [];

	lines.push(`Filed from test **${c.id}** — ${c.title}.`, '');
	if (c.preconditions) lines.push(`**Preconditions:** ${c.preconditions}`, '');

	if (c.steps.length) {
		lines.push('**Steps (expected behaviour)**', '');
		c.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.action} → _${s.expected}_`));
		lines.push('');
	}

	const actual = automated
		? result.stack || result.message || 'No output captured.'
		: result.notes || result.message || 'Marked failed by the tester.';
	lines.push('**Actual**', '', '```', actual, '```', '');

	if (run) lines.push(`**Environment:** ${run.environment}`);
	if (automated && runner) {
		const cmd = run
			? runner.command.replace(/\$ENV\b/g, run.environment)
			: runner.command;
		const repro = runner.workingDir && runner.workingDir !== '.' ? `cd ${runner.workingDir} && ${cmd}` : cmd;
		lines.push(`**Reproduce:** \`${repro}\``);
		if (c.specPath) lines.push(`**Spec file:** \`${c.specPath}\``);
	}

	return {
		type: 'bug',
		title: `${c.title} (${c.id})`,
		description: lines.join('\n').trim(),
		appId: c.appId,
		moduleId: c.target.moduleId,
		page: c.target.pageName,
		form: c.target.formName,
		priority: c.priority,
		status: 'open',
		tags: ['from-test', ...c.tags.filter((t) => t !== 'from-test')],
		attachments: []
	};
}
