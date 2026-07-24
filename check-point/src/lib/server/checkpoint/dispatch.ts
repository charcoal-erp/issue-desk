import { spawn, type ChildProcess } from 'node:child_process';
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
	timedOut: boolean;
	startedAt: string;
	finishedAt: string;
}

export const DEFAULT_TIMEOUT_SEC = 120;
/**
 * How long to keep waiting for stdio after the command itself has exited.
 * `close` normally follows `exit` immediately, but a runner that leaves
 * grandchildren behind (a wrapper that started a server, say) leaks the pipe
 * write-end to them and `close` may never fire — which would hang the run.
 */
const STDIO_DRAIN_MS = 2000;

/**
 * SIGKILL the whole process tree. `shell: true` means the direct child is
 * `/bin/sh`; killing it alone leaves whatever it spawned running — still
 * holding its ports and still writing to the database. Spawning detached puts
 * the command in its own process group so one negative-pid kill reaps all of
 * it (the pattern the platform's own Python harness uses for the same reason).
 */
function killTree(child: ChildProcess, ownGroup: boolean): void {
	if (ownGroup && child.pid) {
		try {
			process.kill(-child.pid, 'SIGKILL');
			return;
		} catch {
			/* group already gone — fall through to the direct kill */
		}
	}
	try {
		child.kill('SIGKILL');
	} catch {
		/* already exited */
	}
}

function runCommand(runner: TestRunner, environment: string, startedAt: string): Promise<CommandOutcome> {
	return new Promise((resolve) => {
		const cwd = path.resolve(workBase(), runner.workingDir || '.');
		const ownGroup = process.platform !== 'win32';
		let child: ChildProcess;
		try {
			child = spawn(substituteEnv(runner.command, environment), {
				cwd,
				shell: true,
				detached: ownGroup,
				env: { ...process.env, ...runner.env, ENV: environment }
			});
		} catch (e) {
			resolve({
				exitCode: null,
				stdout: '',
				stderr: String(e),
				timedOut: false,
				startedAt,
				finishedAt: new Date().toISOString()
			});
			return;
		}

		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let settled = false;
		let drain: ReturnType<typeof setTimeout> | undefined;

		const timer = setTimeout(() => {
			timedOut = true;
			killTree(child, ownGroup);
		}, (runner.timeoutSec ?? DEFAULT_TIMEOUT_SEC) * 1000);

		const settle = (exitCode: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(drain);
			resolve({ exitCode, stdout, stderr, timedOut, startedAt, finishedAt: new Date().toISOString() });
		};

		child.stdout?.on('data', (d) => (stdout += d));
		child.stderr?.on('data', (d) => (stderr += d));
		child.on('error', (e) => {
			stderr = `${stderr}\n${e.message}`;
			settle(null);
		});
		// Prefer `close` (all output collected), but never wait on it forever.
		child.on('exit', (code) => {
			drain = setTimeout(() => settle(code), STDIO_DRAIN_MS);
		});
		child.on('close', (code) => settle(code));
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

	const timeoutNote = outcome.timedOut
		? `[checkpoint] timed out after ${runner.timeoutSec ?? DEFAULT_TIMEOUT_SEC}s — process group killed\n`
		: '';
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
		log: `${timeoutNote}${(outcome.stderr || outcome.stdout || '').slice(-2000)}` || undefined
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
