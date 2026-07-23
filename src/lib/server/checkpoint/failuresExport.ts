import type { CaseResult, TestCase, TestRun, TestRunner } from '$lib/types';
import { PRIORITY_META } from '$lib/priority';
import { REPORT_FORMAT_LABEL, TEST_KIND_META } from '$lib/checkpoint/meta';
import { fmtExportDate } from '$lib/export/context';

/**
 * Failures → Claude Code export (design §12). The counterpart to IssueDesk's
 * issue export and the most-used path: a self-sufficient prompt with the
 * reproduce command, spec, expected steps and actual error per failure.
 */
export interface FailureItem {
	testCase: TestCase;
	result: CaseResult;
	runner?: TestRunner;
	parentIssueTitle?: string | null;
}

/**
 * The captured stdout/stderr of one runner invocation.
 *
 * Emitted once per invocation at the end of the prompt rather than under each
 * failure: fifteen cases from one unit tier share one log, and repeating it
 * fifteen times buries the failures it is meant to explain.
 */
export interface InvocationLog {
	runnerId: string;
	runnerName: string;
	command: string;
	workingDir: string;
	exitCode: number | null;
	log: string;
	truncated: boolean;
}

export interface FailureExportCtx {
	generatedAt: Date;
	runId?: string;
	suiteName?: string;
	environment?: string;
	logs?: InvocationLog[];
}

/** Logs run to megabytes; the tail is where a failure surfaces. */
const LOG_TAIL_LINES = 120;
const LOG_MAX_CHARS = 12_000;

export function trimLog(raw: string): { text: string; truncated: boolean } {
	const lines = raw.replace(/\s+$/, '').split('\n');
	let truncated = lines.length > LOG_TAIL_LINES;
	let text = lines.slice(-LOG_TAIL_LINES).join('\n');
	if (text.length > LOG_MAX_CHARS) {
		text = text.slice(-LOG_MAX_CHARS);
		truncated = true;
	}
	return { text, truncated };
}

function substituteEnv(command: string, env?: string): string {
	return env ? command.replace(/\$ENV\b/g, env) : command;
}

function targetPath(c: TestCase): string {
	return [c.target.moduleName, c.target.pageName, c.target.formName].filter(Boolean).join(' › ');
}

function reproduceCommand(runner: TestRunner, env?: string): string {
	const cmd = substituteEnv(runner.command, env);
	return runner.workingDir && runner.workingDir !== '.' ? `cd ${runner.workingDir} && ${cmd}` : cmd;
}

const INSTRUCTIONS =
	'You are working in this repository. Each failing test below carries its reproduce ' +
	'command, the spec file, the expected behaviour in the author’s words, and the actual ' +
	'error. For each failure identify the root cause, say whether it is a real defect or a ' +
	'flaky / incorrect test, and propose the minimal fix and which file to change. Ask before ' +
	'changing a shared contract.';

function sectionFor(item: FailureItem, index: number, env?: string): string {
	const { testCase: c, result, runner } = item;
	const automated = c.kind !== 'manual';
	let out = `## ${index}. \`${c.id}\` — ${c.title}\n\n`;
	out += `- **Application:** ${c.appName}\n`;
	out += `- **Target:** ${targetPath(c)}\n`;
	out += `- **Test type:** ${TEST_KIND_META[c.kind].label}\n`;
	out += `- **Priority:** ${PRIORITY_META[c.priority].label}\n`;
	if (automated && runner) {
		out += `- **Runner:** ${runner.name} (${runner.language})\n`;
		out += `- **Reproduce:** \`${reproduceCommand(runner, env)}\`\n`;
	}
	if (c.specPath) out += `- **Spec file:** \`${c.specPath}\`\n`;
	if (c.externalTestId) out += `- **Test id:** \`${c.externalTestId}\`\n`;
	if (automated && runner)
		out += `- **Report:** \`${runner.reportPath}\` (${REPORT_FORMAT_LABEL[runner.reportFormat]})\n`;
	if (c.parentIssueId)
		out += `- **Parent issue:** ${c.parentIssueId}${item.parentIssueTitle ? ` — ${item.parentIssueTitle}` : ''}\n`;
	out += '\n';

	if (c.preconditions) out += `**Preconditions:** ${c.preconditions}\n\n`;

	if (c.steps.length) {
		out += `**Expected**\n\n`;
		c.steps.forEach((s, i) => {
			out += `${i + 1}. ${s.action} → _${s.expected}_\n`;
		});
		out += '\n';
	}

	const actual = automated
		? result.stack || result.message || 'No output captured.'
		: result.notes || result.message || 'Marked failed by the tester; no note provided.';
	out += `**Actual**\n\n\`\`\`\n${actual}\n\`\`\`\n`;

	if (result.artifacts.length) {
		out += `\n**Artifacts:** ${result.artifacts.map((a) => `\`${a}\``).join(', ')}\n`;
	}
	return out;
}

export function failuresToMarkdown(items: FailureItem[], ctx: FailureExportCtx): string {
	const scope: string[] = [`Generated ${fmtExportDate(ctx.generatedAt)}`];
	if (ctx.runId) scope.push(`run ${ctx.runId}`);
	if (ctx.suiteName) scope.push(`suite ${ctx.suiteName}`);
	if (ctx.environment) scope.push(`env ${ctx.environment}`);

	let out = `# Failing tests — Checkpoint export\n\n`;
	out += `_${scope.join(' · ')}. ${items.length} ${items.length === 1 ? 'failure' : 'failures'}._\n\n`;
	out += `${INSTRUCTIONS}\n\n`;
	items.forEach((item, i) => {
		out += `---\n\n${sectionFor(item, i + 1, ctx.environment)}\n`;
	});

	if (ctx.logs?.length) {
		out += `---\n\n# Runner output\n\n`;
		out += `_The console output of each runner that failed or reported a failing case. `;
		out += `Parsed reports give you the assertion; these give you what happened around it — `;
		out += `a missing service, a migration that did not apply, a port already bound._\n\n`;
		for (const l of ctx.logs) {
			out += `## \`${l.runnerId}\` — ${l.runnerName}\n\n`;
			out += `- **Command:** \`${l.command}\`\n`;
			out += `- **Working dir:** \`${l.workingDir}\`\n`;
			out += `- **Exit code:** ${l.exitCode ?? 'unknown'}\n\n`;
			if (l.truncated) out += `_Last ${LOG_TAIL_LINES} lines; earlier output omitted._\n\n`;
			out += `\`\`\`\n${l.log}\n\`\`\`\n\n`;
		}
	}

	out += `---\n\n## What I need back\n\n`;
	out += `- The root cause of each failure.\n`;
	out += `- Whether it is a real defect, a flaky test, or an incorrect test.\n`;
	out += `- The minimal fix and which file to change.\n`;
	out += `- Anything that needs a decision before you proceed.\n`;
	return out.trim();
}

export function failuresToJson(items: FailureItem[], ctx: FailureExportCtx): string {
	const doc = {
		generatedAt: ctx.generatedAt.toISOString(),
		run: ctx.runId ?? null,
		suite: ctx.suiteName ?? null,
		environment: ctx.environment ?? null,
		runnerLogs: (ctx.logs ?? []).map((l) => ({
			runnerId: l.runnerId,
			runnerName: l.runnerName,
			command: l.command,
			workingDir: l.workingDir,
			exitCode: l.exitCode,
			truncated: l.truncated,
			log: l.log
		})),
		failures: items.map((item) => {
			const c = item.testCase;
			return {
				id: c.id,
				title: c.title,
				application: c.appName,
				target: targetPath(c),
				kind: c.kind,
				priority: c.priority,
				runner: item.runner
					? {
							name: item.runner.name,
							language: item.runner.language,
							reproduce: reproduceCommand(item.runner, ctx.environment),
							reportFormat: item.runner.reportFormat
						}
					: null,
				spec: c.specPath,
				testId: c.externalTestId,
				parentIssue: c.parentIssueId,
				preconditions: c.preconditions ?? null,
				steps: c.steps,
				error: item.result.stack || item.result.message || item.result.notes || null,
				artifacts: item.result.artifacts
			};
		})
	};
	return JSON.stringify(doc, null, 2);
}
