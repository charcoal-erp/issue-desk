import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import type { CaseResult, RunnerInvocation, TestCase, TestRunner } from '$lib/types';
import { reportsDir } from '../fs/paths';
import { exitCodeResults, matchEntries, skippedResult } from './match';
import { parseReport } from './report';

/**
 * Launching and executing a run (design doc §8). A runner's command is executed
 * as authored (this is a single-tenant tool behind a trusted boundary — the
 * commands are CI-style config, not external input), its report is read and
 * normalized, and entries are matched back to the participating cases. A
 * missing command, timeout or unreadable report degrades to recorded failures /
 * skips rather than throwing, so a run always completes with an honest record.
 */
function substituteEnv(command: string, environment: string): string {
	return command.replace(/\$ENV\b/g, environment);
}

/** Where runner working directories resolve from (the code under test). */
function workBase(): string {
	return env.CHECKPOINT_WORKDIR || process.cwd();
}

interface CommandOutcome {
	exitCode: number | null;
	stdout: string;
	stderr: string;
	startedAt: string;
	finishedAt: string;
}

function runCommand(runner: TestRunner, environment: string, startedAt: string): Promise<CommandOutcome> {
	return new Promise((resolve) => {
		const cwd = path.resolve(workBase(), runner.workingDir || '.');
		let child;
		try {
			child = spawn(substituteEnv(runner.command, environment), {
				cwd,
				shell: true,
				env: { ...process.env, ...runner.env, ENV: environment }
			});
		} catch (e) {
			resolve({ exitCode: null, stdout: '', stderr: String(e), startedAt, finishedAt: new Date().toISOString() });
			return;
		}
		let stdout = '';
		let stderr = '';
		child.stdout?.on('data', (d) => (stdout += d));
		child.stderr?.on('data', (d) => (stderr += d));
		const timer = setTimeout(() => child.kill('SIGKILL'), (runner.timeoutSec ?? 120) * 1000);
		child.on('error', (e) => {
			clearTimeout(timer);
			resolve({ exitCode: null, stdout, stderr: `${stderr}\n${e.message}`, startedAt, finishedAt: new Date().toISOString() });
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			resolve({ exitCode: code, stdout, stderr, startedAt, finishedAt: new Date().toISOString() });
		});
	});
}

export interface DispatchOutcome {
	invocation: RunnerInvocation;
	results: CaseResult[];
}

export async function dispatchRunner(
	runId: string,
	runner: TestRunner,
	cases: TestCase[],
	environment: string
): Promise<DispatchOutcome> {
	const startedAt = new Date().toISOString();
	const outcome = await runCommand(runner, environment, startedAt);

	// Read the report the runner produced.
	let content = '';
	const usesStdout = runner.reportPath === 'stdout' || runner.reportFormat === 'tap';
	if (usesStdout) {
		content = outcome.stdout || outcome.stderr;
	} else if (runner.reportPath) {
		try {
			content = await readFile(path.resolve(workBase(), runner.workingDir || '.', runner.reportPath), 'utf8');
		} catch {
			content = '';
		}
	}

	let results: CaseResult[];
	let orphanCount = 0;
	if (runner.reportFormat === 'exit-code') {
		results = exitCodeResults(cases, outcome.exitCode ?? 1, `${outcome.stdout}\n${outcome.stderr}`, runner.id);
	} else {
		const entries = parseReport(runner.reportFormat, content);
		const matched = matchEntries(entries, cases, runner.matchStrategy, runner.id);
		orphanCount = matched.orphans.length;
		results = [
			...matched.results,
			...matched.missing.map((c) => skippedResult(c, runner.id, `not reported by ${runner.name}`))
		];
	}

	// Copy the raw report in for a stable failure-export path.
	if (content) {
		try {
			await mkdir(reportsDir(runId), { recursive: true });
			await writeFile(path.join(reportsDir(runId), `${runner.id}.report`), content, 'utf8');
		} catch {
			/* best-effort */
		}
	}

	const invocation: RunnerInvocation = {
		runnerId: runner.id,
		command: substituteEnv(runner.command, environment),
		workingDir: runner.workingDir,
		exitCode: outcome.exitCode,
		startedAt: outcome.startedAt,
		finishedAt: outcome.finishedAt,
		reportPath: runner.reportPath,
		parsedCount: results.length,
		orphanCount,
		log: (outcome.stderr || outcome.stdout || '').slice(-2000) || undefined
	};
	return { invocation, results };
}

/** A manual case starts pending — `skipped` with a sentinel note until a tester marks it. */
export const PENDING_NOTE = 'pending';
export function pendingManualResult(testCaseId: string): CaseResult {
	return {
		testCaseId,
		runnerId: null,
		status: 'skipped',
		durationMs: null,
		message: null,
		stack: null,
		artifacts: [],
		notes: PENDING_NOTE
	};
}
