# Checkpoint — Design Document

**Test management for the Inflection Zone platform**

| | |
|---|---|
| **Version** | 2.0 — consolidated |
| **Author** | Kiran Kharade / Inflection Zone Lab |
| **Status** | Draft for review |
| **Supersedes** | *Checkpoint — Design Addendum to IssueDesk* (v1.0) and *Checkpoint — Runners, Suite Authoring, Dashboard & Failure Export* (Addendum II, v1.0). Both are folded into this document; neither needs to be read alongside it. |
| **Companion documents** | *IssueDesk Design Document* (the issue tracker Checkpoint shares a codebase with) · *IssueDesk + Checkpoint — One Repo, Two Interfaces* (the shell and workspace-switching architecture) |

---

## Table of contents

1. [What Checkpoint is](#1-what-checkpoint-is)
2. [Relationship to IssueDesk](#2-relationship-to-issuedesk)
3. [Scope and non-goals](#3-scope-and-non-goals)
4. [Personas and core flows](#4-personas-and-core-flows)
5. [Functional requirements](#5-functional-requirements)
6. [Domain model](#6-domain-model)
7. [Runners and report normalization](#7-runners-and-report-normalization)
8. [Launching and executing a run](#8-launching-and-executing-a-run)
9. [Storage, numbering and the in-memory store](#9-storage-numbering-and-the-in-memory-store)
10. [Screens](#10-screens)
11. [Authoring flows](#11-authoring-flows)
12. [Import and export](#12-import-and-export)
13. [Integration with IssueDesk](#13-integration-with-issuedesk)
14. [Coverage and metric definitions](#14-coverage-and-metric-definitions)
15. [Routes and actions](#15-routes-and-actions)
16. [UI and design system](#16-ui-and-design-system)
17. [What is reused unchanged](#17-what-is-reused-unchanged)
18. [Migration and rollout](#18-migration-and-rollout)
19. [Testing Checkpoint itself](#19-testing-checkpoint-itself)
20. [Open questions and later work](#20-open-questions-and-later-work)

---

## 1. What Checkpoint is

IssueDesk answers *"what is broken, and what should we build?"* Checkpoint answers *"what did we verify, does it still pass, and is the test infrastructure itself healthy?"*

Checkpoint is a test-management workspace for the platform's products (Charcoal ERP, Amrutm, Drishti, EventHive, Hubble, Relay, Quick Help, NoteBox). It holds the **test cases** that define correct behaviour, the **suites** that group them for repeatable execution, the **runners** that know how each class of test is executed, and the **runs** that record what happened. When something fails it hands the failure onward — either as a bug in IssueDesk, or as a Markdown prompt for Claude Code to analyse and fix.

Three properties shape the whole design:

- **Tests are heterogeneous.** Python API-client tests, Playwright e2e tests, unit tests, visual-regression tests and plain shell scripts all coexist. They are invoked differently and report differently. Checkpoint models that difference explicitly rather than pretending everything is "automated".
- **Manual testing is a first-class kind, not a fallback.** A release suite legitimately mixes an API test, an e2e test, a visual check and a human sign-off, and they belong in the same run under one pass rate.
- **A failure is only useful if it travels well.** Every failure carries the command that reproduces it, the spec file, the expected behaviour in the author's words, and the actual error — enough for a person or an LLM to act without opening the tool.

---

## 2. Relationship to IssueDesk

Checkpoint and IssueDesk ship from **one repository, one backend, one deployment**, but present as **two separate interfaces** that never mix each other's content on a screen. A launcher chooses between them at start; a workspace switcher in the top bar moves between them. That architecture is specified in *IssueDesk + Checkpoint — One Repo, Two Interfaces*; this document assumes it.

What that means here:

| Shared (one of) | Separate (Checkpoint's own) |
|---|---|
| Repository, SvelteKit server, deployment | Interface, navigation, screens |
| `/data` JSON store and write mechanics | `tests/`, `suites/`, `runs/`, `runners.json` directories |
| Per-app numbering in `_sequence.json` | `testCase` / `suite` / `run` / `runner` counter keys |
| Application → module → page → form taxonomy | — |
| Priority union and pip-meter rendering | Result colours, runner-kind badges |
| Uploads and file serving | Failure artifacts (traces, diffs, logs) |
| Design tokens and components | Teal workspace identity (IssueDesk is indigo) |
| The issue-creation service | Called via the integration seam, never embedded |

Because both run in one process, filing a bug from a failed test is a **function call**, not a network integration — the single strongest reason the two live in one codebase.

---

## 3. Scope and non-goals

**In scope.** Test-case authoring; suites and suite authoring; runner definitions and report normalization; launching and recording runs across mixed runners; manual execution; a dashboard of run statistics and system health; coverage views; import and export of cases; failure export as a Claude Code prompt; the bug-filing integration with IssueDesk.

**Non-goals for v1.**

- **Authentication.** None, as in IssueDesk — single-tenant behind a trusted boundary.
- **Being a test framework.** Checkpoint *invokes* pytest, Playwright, Vitest and shell scripts and *reads* their reports. It does not implement assertions or replace any framework.
- **CI orchestration.** Checkpoint can be triggered by CI and can ingest CI-produced reports, but it is not a scheduler or a build system. Deeper CI wiring is later work (§20).
- **Test data management.** Fixtures and seed data remain the runners' concern.
- **Cross-project analytics.** Coverage and trends are per-platform, not a BI surface.

---

## 4. Personas and core flows

Same people as IssueDesk, wearing a QA hat: the product owner/architect (Kiran), dev-testers, and whoever is on manual verification for a release.

**Flow A — Author a test case.** Cases → **New case** → title; application; module / page / form (the same pickers as a new issue); priority; **parent issue** if this test exists to verify a specific bug or request; **test type** (unit / API / e2e / visual / shell / manual); for non-manual kinds a **runner**, **spec file** and **test identifier**; preconditions; ordered steps as *action → expected*; optional suite membership. Saves as `TC-CHR-13`.

**Flow B — Author a suite.** Suites → **New suite** → name, description, application, default environment, tags → add cases from the library (filterable by application and type), reorder them, remove them → a live panel shows **which runners this suite will invoke** and what each contributes → **Save** or **Save & launch**.

**Flow C — Launch a run.** From a suite card, the suite editor, the Runs screen or the dashboard → choose suite, environment, and **which runners take part** → read the **execution plan** (the literal `cd … && command` per runner, and which report file will be parsed) → start. Automated runners execute and stream results; manual cases become a checklist.

**Flow D — Execute manually.** In the run, each manual case shows its steps and a pass / fail / blocked / skipped toggle plus notes. Failures expose **File bug**.

**Flow E — Triage failures.** Dashboard → **Failing now** lists every currently failing case with its kind, spec path and parent issue. From there: open the case, file a bug, or export.

**Flow F — Hand failures to Claude Code.** **Failures → Markdown** from the dashboard, a run, the filtered case list, or a single case → a self-sufficient prompt (reproduce command, spec, expected, actual, artifacts) → copy → paste into Claude Code.

**Flow G — Check coverage and health.** Dashboard → pass-rate trend, per-runner health (flake rate, average duration, last outcome), coverage by module, and the modules with no tests at all.

---

## 5. Functional requirements

**Test cases**

- **FR-1** CRUD test cases using the shared application / module / page / form taxonomy, sourced from the same config as issues.
- **FR-2** A case has ordered steps, each `{ action, expected }`; plus preconditions, priority (the five IssueDesk levels), status (`active` | `draft` | `deprecated`) and tags.
- **FR-3** Per-app numbering — `TC-<APP>-<n>`, e.g. `TC-CHR-12`.
- **FR-4** A case declares a **kind**: `unit` | `api` | `e2e` | `visual` | `shell` | `manual`. Non-manual kinds additionally declare a **runner**, a **spec path** and an **external test identifier**.
- **FR-5** A case may declare a **parent issue** — the issue it was written to verify (optional; empty for general regression cases).

**Runners**

- **FR-6** Define runners with: name, kind, language, command, working directory, environment substitutions, report format, report path, match strategy, timeout, enabled flag.
- **FR-7** Each report format has an adapter that parses it into one normalized result shape.
- **FR-8** Report entries that match no case are surfaced as **orphans**; cases in a run with no matching entry are recorded `skipped` with a reason.
- **FR-9** Derive per-runner health: last invocation and outcome, average duration, flake rate, consecutive-failure streak.

**Suites**

- **FR-10** Create, edit, duplicate and delete suites; membership is **ordered**; a case may belong to several suites; deleting a suite never deletes cases.
- **FR-11** A suite may mix kinds; the editor shows which runners the current membership will invoke and how many cases each contributes.
- **FR-12** A suite carries a default environment and tags.

**Runs**

- **FR-13** Launch a run from a suite, choosing environment and a subset of participating runners, with an execution-plan preview before starting.
- **FR-14** A run records one **invocation** per participating runner: command executed, working dir, exit code, report path, parsed count, orphan count, timing.
- **FR-15** Each case result records status (`pass` | `fail` | `blocked` | `skipped`), duration, failure message, stack/diff summary, artifacts and optional notes.
- **FR-16** Manual cases appear as a checklist in the same run and are marked by a person.
- **FR-17** A run rolls up counts and a pass rate; a completed run is immutable history.
- **FR-18** Run detail groups results **by runner**, showing that runner's command and report format.

**Dashboard**

- **FR-19** Opening Checkpoint lands on a **dashboard**, not the case list.
- **FR-20** The dashboard shows KPIs, a recent-run trend, per-runner **system health**, the currently failing cases, and coverage by module.

**Integration**

- **FR-21** From a `fail` or `blocked` result, create an IssueDesk issue prefilled with the test's target, steps as reproduction, expected vs actual, priority and artifacts; store bidirectional links.
- **FR-22** A case shows its parent issue and the issues it has produced; an issue shows the test it was filed from.

**Coverage, import and export**

- **FR-23** Coverage per application × module: case counts split manual/automated, latest pass rate, open-issue count, and modules with zero cases.
- **FR-24** Import cases from JSON or CSV, or discover them from a runner's report.
- **FR-25** Export cases as JSON, CSV or Markdown.
- **FR-26** Export **failures** as a Markdown prompt for Claude Code (or JSON for tooling), scoped to: all failing cases, one run, the current case filter, or a single case.

---

## 6. Domain model

Types live in `src/lib/types.ts` beside `Issue`, deliberately mirroring it where they overlap so pickers, filters and rendering are shared.

```ts
// Shared with IssueDesk:
//   IssueTarget = { application, module, page, form }
//   Priority    = 'critical' | 'veryHigh' | 'high' | 'medium' | 'low'

export interface TestStep {
  action: string;            // "POST /invoices with a 10% line discount"
  expected: string;          // "tax is computed on the post-discount subtotal"
}

export type TestKind = 'unit' | 'api' | 'e2e' | 'visual' | 'shell' | 'manual';
export type TestCaseStatus = 'active' | 'draft' | 'deprecated';

export interface TestCase {
  id: string;                // "TC-CHR-12"
  seq: number;               // 12
  application: string;       // "charcoal" — drives the id prefix
  target: IssueTarget;       // SHARED taxonomy
  title: string;
  preconditions?: string;
  steps: TestStep[];
  priority: Priority;        // SHARED union
  status: TestCaseStatus;
  tags: string[];

  kind: TestKind;
  runnerId: string | null;         // null only when kind === 'manual'
  specPath: string | null;         // "tests/api/billing/test_tax.py"
  externalTestId: string | null;   // "test_tax.py::test_discounted_subtotal"

  parentIssueId: string | null;    // "CHR-15" — the issue this test verifies
  suiteIds: string[];
  issueIds: string[];              // bugs filed FROM this case

  createdBy: string;
  createdAt: string; updatedAt: string;
}

export type ReportFormat =
  | 'junit-xml'        // pytest and many others
  | 'playwright-json'
  | 'vitest-json'      // Vitest / Jest JSON reporters
  | 'pytest-json'
  | 'tap'              // shell scripts emitting TAP on stdout
  | 'exit-code'        // shell scripts with no structured output
  | 'visual-diff'      // playwright-json plus an image-diff manifest
  | 'custom';          // user-supplied parser module

export type MatchStrategy =
  | { by: 'nodeid' }                    // pytest: tests/x.py::test_y
  | { by: 'annotation'; tag: string }   // Playwright: "@checkpoint TC-CHR-08"
  | { by: 'testName' }                  // Vitest / Jest full test name
  | { by: 'snapshotName' }              // visual: "invoice-pdf-a4"
  | { by: 'tapName' }                   // TAP assertion description
  | { by: 'explicitMap' };              // curated map when nothing else is stable

export interface TestRunner {
  id: string;                // "RNR-1"
  name: string;              // "API contract (pytest)"
  kind: TestKind;
  language: 'python' | 'node' | 'bash' | 'other';
  command: string;           // "pytest tests/api -q --junitxml=reports/api-junit.xml"
  workingDir: string;        // "services/api"
  env?: Record<string, string>;   // substituted into the command ($ENV, $BASE_URL)
  reportFormat: ReportFormat;
  reportPath: string;        // "reports/api-junit.xml" | "stdout"
  matchStrategy: MatchStrategy;
  timeoutSec?: number;
  enabled: boolean;
}

export interface TestSuite {
  id: string;                // "SUITE-CHR-1"
  application: string;
  name: string;              // "Billing release"
  description?: string;
  caseIds: string[];         // ORDERED
  defaultEnv: 'local' | 'ci' | 'staging' | 'prod';
  tags: string[];
  createdAt: string; updatedAt: string;
}

export type ResultStatus = 'pass' | 'fail' | 'blocked' | 'skipped';

export interface CaseResult {
  testCaseId: string;        // "TC-CHR-12"
  runnerId: string | null;
  status: ResultStatus;
  durationMs: number | null;
  message: string | null;    // assertion text / first error line
  stack: string | null;      // trimmed stack or diff summary
  artifacts: string[];       // trace.zip, screenshot.png, diff.png, stdout.log
  notes?: string;            // tester's note on a manual result
  issueId?: string;          // if a bug was filed from this result
  flaky?: boolean;           // flipped without an intervening commit
}

export interface RunnerInvocation {
  runnerId: string;
  command: string;           // as executed, after env substitution
  workingDir: string;
  exitCode: number | null;
  startedAt: string; finishedAt?: string;
  reportPath: string;
  parsedCount: number;
  orphanCount: number;
  log?: string;
}

export interface TestRun {
  id: string;                // "RUN-CHR-31"
  application: string;
  suiteId?: string;          // or ad-hoc
  environment: string;       // "staging"
  startedBy: string;
  startedAt: string; completedAt?: string;
  invocations: RunnerInvocation[];   // one per participating runner
  results: CaseResult[];
  // derived at read time: counts { pass, fail, blocked, skipped }, passRate
}
```

The IssueDesk `Issue` gains **two optional fields** — the only change to an existing entity:

```ts
export interface Issue {
  // …all existing fields unchanged…
  testCaseId?: string;   // set when the issue was filed from a failed test
  runId?: string;        // the run the failure came from
}
```

### 6.1 Parent issue vs. filed issues

Two distinct links, easy to conflate:

- **`TestCase.parentIssueId`** — *"this test exists because of that issue."* Points **backwards**: a regression test written for a bug, or a test written for a feature request.
- **`TestCase.issueIds`** / **`CaseResult.issueId`** — *"this test failed and these bugs came out of it."* Points **forwards**.

Both render as chips that navigate into the IssueDesk workspace. Neither embeds IssueDesk content, per the two-interface separation rule.

---

## 7. Runners and report normalization

A **runner** is the single place that knows about a framework: how to invoke it, where its report lands, how to read it, and how its entries map back to Checkpoint cases.

A representative configuration for the platform:

| Runner | Kind | Command | Working dir | Reports as | Matched by |
|---|---|---|---|---|---|
| API contract (pytest) | api | `pytest tests/api -q --junitxml=reports/api-junit.xml` | `services/api` | JUnit XML | nodeid |
| E2E (Playwright) | e2e | `npx playwright test --reporter=json` | `apps/web` | Playwright JSON | `@checkpoint` annotation |
| Unit (Vitest) | unit | `npx vitest run --reporter=json --outputFile=reports/unit.json` | `.` | Vitest JSON | full test name |
| Visual regression | visual | `npx playwright test --project=visual --reporter=json` | `apps/web` | Playwright JSON + diff manifest | snapshot name |
| Smoke (shell script) | shell | `bash scripts/smoke.sh --env $ENV` | `ops` | exit code + TAP on stdout | TAP assertion name |
| Manual execution | manual | *(performed by a person)* | — | tester marks each case | case id |

### 7.1 Normalization

Every adapter parses its own format into one shape — `{ caseId, status, durationMs, message, stack, artifacts[], raw? }`. That is what gets stored as a `CaseResult`. This is why a run spanning pytest, Playwright and a bash script still yields **one** progress bar, **one** pass rate and **one** failure export.

Format-specific notes:

- **junit-xml** — `<testcase>` classname/name → nodeid; `<failure>` message and body → message/stack; `time` → duration.
- **playwright-json** — walks suites/specs/tests; takes the last attempt's status (earlier attempts mark the result `flaky`); attachments (trace, screenshot, video) become artifacts.
- **visual-diff** — playwright-json plus the diff manifest; message becomes the pixel-difference summary and the diff/actual images become artifacts.
- **vitest-json / pytest-json** — assertion results with their failure messages.
- **tap** — `ok` / `not ok` lines with the description as the identifier; YAML diagnostics become the message.
- **exit-code** — one synthetic result per mapped case: exit `0` → pass, non-zero → fail with the tail of stdout/stderr as the message.

### 7.2 Orphans and gaps

- A report entry matching no case → an **orphan**, listed on the run with a one-click "create a case from this" (prefilled with the identifier, spec path and runner).
- A case in the run with no matching entry → recorded `skipped` with the reason (`not reported by <runner>`), which surfaces stale identifiers quickly.

### 7.3 Health metrics

Derived from run history, never hand-maintained: last invocation time and outcome, average duration, **flake rate** (share of runs where a case flipped result without an intervening commit), and consecutive-failure streak. These drive the health dot — `ok`, `warn` (flake ≥ 5%), `bad` (last invocation failed or exit code ≠ 0), `idle`.

---

## 8. Launching and executing a run

The **Launch** dialog is the single entry point, reachable from a suite card, the suite editor, the Runs screen and the dashboard. It collects:

1. **Suite** — which suite to run.
2. **Environment** — `local` / `ci` / `staging` / `prod`, substituted into commands as `$ENV`.
3. **Participating runners** — every kind present in the suite, each tickable. Untick *visual* to skip the slow pass; untick everything but *manual* for a pure manual session.
4. **Execution plan** — a preview of exactly what will happen:

```
$ cd services/api && pytest tests/api -q --junitxml=reports/api-junit.xml
  → parse reports/api-junit.xml (junit-xml) → 1 case
$ cd apps/web && npx playwright test --reporter=json
  → parse reports/e2e.json (playwright-json) → 1 case
# 1 manual case(s) → checklist for the runner
```

On start Checkpoint creates the `TestRun`, dispatches each enabled runner (sequentially by default; parallel is a per-runner flag), ingests each report as it lands, and leaves manual cases `pending` for a person. The run is complete when every automated invocation has finished and every manual case has been marked; at that point it becomes immutable history.

There is deliberately **no `mode` field** on a run. A run is not "manual" or "automated" — it is whatever mix of runners took part.

---

## 9. Storage, numbering and the in-memory store

**Storage.** JSON files on disk, git-committable, no database — the same model as IssueDesk, with new directories:

```
/data
├── issues/<app>/<module>.json      # EXISTING — unchanged
├── uploads/…                       # EXISTING — reused
├── _sequence.json                  # EXISTING — extended with new counters
│
├── runners.json                    # runner definitions
├── tests/<app>/<module>.json       # TestCase[] per app/module
├── suites/<app>.json               # TestSuite[] per app
├── runs/<app>/<runId>.json         # one file per run (immutable history)
└── reports/<runId>/                # captured raw reports & artifacts
```

Test cases live beside the code they verify and diff cleanly in review. Runs are written once, so a file-per-run keeps history append-only and prunable. Raw reports and artifacts are copied into `/data/reports/<runId>/` at ingest so a failure export can reference a stable path after the workspace is cleaned.

**Numbering.** The same per-app sequence mechanism as issues — per-file async mutex plus atomic tmp+rename write — with extra counter keys:

```json
{
  "charcoal": { "issue": 15, "testCase": 12, "suite": 4, "run": 31 },
  "amrutm":   { "issue": 7,  "testCase": 4,  "suite": 1, "run": 11 }
}
```

So a Charcoal case is `TC-CHR-12`, its suite `SUITE-CHR-4`, its run `RUN-CHR-31`. Runners are numbered globally (`RNR-1`), since they are not app-scoped.

**In-memory store.** The existing module-level singleton (synced from JSON on boot, write-through on mutation) is extended with test indexes — `testCasesByApp`, `suitesByApp`, `runsByApp`, `runners`, plus a `resultsByCase` reverse index for coverage and flake computation. One store, one sync path.

---

## 10. Screens

Five screens in the Checkpoint workspace nav, in this order.

### 10.1 Dashboard — the landing screen

Opening Checkpoint lands here, not on the case list.

- **KPI strip** — pass rate across the recent window with week-over-week direction; failing cases; total cases split automated/manual; runs in the last 7 days; flaky runners.
- **Recent runs** — a pass/fail column per run; clicking a column opens that run.
- **System health** — one row per runner: health dot, name, kind, the actual command, flake bar, average duration, last invocation and outcome. This is the "is the test infrastructure itself healthy" view — a broken command or a climbing flake rate shows up here before it wastes a morning.
- **Failing now** — every currently failing case with id, application, spec path, kind and parent issue; header carries **Export N → Markdown**.
- **Coverage by module** — manual/automated split and latest pass rate per application × module.

### 10.2 Cases

A filterable table: id, title with spec path or target, application · module, **kind badge**, priority pip-meter, **parent issue** chip, last result. The filter rail covers application, test type, status and last result. Toolbar carries **Import**, **Failures → Markdown** and **New case**.

The **detail drawer** shows the parent-issue note, metadata (application, target, priority, last result, suite membership), the last failure with its error output and artifact chips, an **execution** block (runner, command, spec, test id, report format) for non-manual kinds or a manual note otherwise, preconditions, and the steps table. Footer: Edit, Run this test, and — when failing — Failure → Markdown.

### 10.3 Suites

Cards showing the suite id, application, default environment, name, description, the **kinds it spans**, case counts (total / manual / automated) and last-run pass rate. Each card offers **Launch**, **Edit**, **Duplicate** and **Delete**. Clicking a card opens the editor (§11.2).

### 10.4 Runs

A list of runs — id, suite, the kind badges that took part, environment, who and when, a pass/fail/blocked/skipped progress bar and pass rate.

**Run detail** groups results **by runner**: each group header shows the kind, runner name, its own pass/fail tally and its report format, followed by the exact command as executed, then each case with duration, and for failures the error box and artifact chips. Manual cases form their own group with pass / fail / blocked / skipped toggles and notes. A banner at the top offers **Failures → Claude Code** when anything failed.

### 10.5 Runners

One card per runner: kind badge, name, id, language, health dot, the command in a terminal-styled block, then working dir, report format, report path and match strategy. Footer shows average duration, flake rate, last invocation, and offers **Run now** and **Edit**. Below the grid, a short explainer of report normalization.

---

## 11. Authoring flows

### 11.1 New / edit test case

A single form covering:

- **Title**, **application**, **priority**.
- **Module / page / form** — the shared taxonomy, same pickers as a new issue.
- **Parent issue** — a dropdown of issues, defaulting to none. Labelled as *the bug or request this test verifies*, so it is not confused with bugs the test later files.
- **Test type** — the six kinds as a segmented control.
- **Execution block** (non-manual kinds only) — runner (filtered to that kind), spec file, test identifier, plus a live hint spelling out what will run: *"Runs `pytest tests/api -q --junitxml=reports/api-junit.xml` in `services/api`, reads `reports/api-junit.xml` (junit-xml), matched by nodeid."* Manual kind shows instead what will happen: the case becomes a checklist item in any run that includes it.
- **Preconditions** and **steps** — action / expected pairs, added and removed inline.
- **Suite membership** — toggle chips.

Saving allocates the next per-app id (`TC-CHR-13`) and, if a parent issue was chosen, records the link.

### 11.2 Suite editor

A dedicated screen rather than a modal, because authoring needs room:

- **Details** — name, description, application, default environment, tags.
- **Runners this suite will invoke** — recomputed live as membership changes: each distinct kind, its runner, that runner's command, its health dot, and how many cases it contributes. This answers *"what actually happens when I launch this"* before anything runs.
- **Case library ↔ In this suite** — a two-pane picker. The library filters by application and test type; `+` adds. The right pane shows ordered membership with up/down reordering and removal.
- **Launch bar** — a persistent footer summarising *"N cases across M runners, default env X"*, with **Save suite** and **Save & launch**.

Duplicating a suite copies its membership (useful for variants); deleting a suite removes only the grouping — cases stay in the library.

---

## 12. Import and export

**Import cases** — paste or upload **JSON** or **CSV**, or **discover from a runner report**: point at a JUnit XML / Playwright JSON / Vitest JSON file and Checkpoint lists the tests it found, with their last results, ready to import as automated cases with their runner, spec path and identifier prefilled. Duplicate ids are skipped.

**Export cases** — the current filter, a suite, or a single case, as **JSON** (full fidelity, round-trippable), **CSV** (spreadsheet triage) or **Markdown** (review and documentation).

**Export failures → Claude Code** — the counterpart to IssueDesk's issue export, and the most-used path.

*Scopes:* all failing cases · this run · the current case filter · a single case.
*Formats:* Markdown (a ready prompt) or JSON (for tooling).

The Markdown document opens with generation context (time, run, suite, environment, failure count) and a short instruction paragraph, then one section per failure:

````markdown
## 1. `TC-CHR-12` — Tax computed on discounted subtotal

- **Application:** Charcoal ERP
- **Target:** Billing › Invoice › Line items
- **Test type:** API
- **Priority:** Critical
- **Runner:** API contract (pytest) (python)
- **Reproduce:** `cd services/api && pytest tests/api -q --junitxml=reports/api-junit.xml`
- **Spec file:** `tests/api/billing/test_tax.py`
- **Test id:** `test_tax.py::test_discounted_subtotal`
- **Report:** `reports/api-junit.xml` (junit-xml)
- **Parent issue:** CHR-15 — Tax computed on pre-discount subtotal

**Preconditions:** An invoice exists with a discounted line item.

**Expected**

1. POST /invoices with a 10% line discount, then read the tax block → _tax is computed on the post-discount subtotal (1620.00)_

**Actual**

```
AssertionError: assert 1800.0 == 1620.0
  tests/api/billing/test_tax.py:48: in test_discounted_subtotal
```

**Artifacts:** `reports/api-junit.xml`
````

and closes with what is wanted back: root cause per failure, real defect vs flaky or incorrect test, the minimal fix and which file to change, and anything needing a decision first. Manual failures use the same structure minus the runner block, with the tester's note as *Actual*.

The design goal is **self-sufficiency**: whoever reads the prompt has the spec path, the exact reproduce command, the expected behaviour in the author's words and the actual error, without opening Checkpoint.

---

## 13. Integration with IssueDesk

**Fail → bug.** On a `fail` or `blocked` result, **Create bug in IssueDesk** invokes the standard issue-creation service, prefilled:

- `application`, `module`, `page`, `form` ← copied from the case's `target`; no re-selection.
- **Description** ← assembled reproduction: preconditions + numbered steps (action → expected) + the actual error or tester note + environment + the reproduce command for automated kinds.
- `priority` ← the case's priority, editable before save.
- `testCaseId` + `runId` ← set for traceability.
- Failure artifacts attached via the existing uploads.

**Bidirectional links.** On save the new issue id is written to `CaseResult.issueId` and `TestCase.issueIds`; the issue carries `testCaseId` / `runId`. Checkpoint renders a linked-issue chip; IssueDesk shows a "filed from test TC-CHR-12" note. Crossing the seam is always a **navigation** into the other workspace, never embedded content.

**No duplication.** Filing a bug does not copy the test into the issue store. The case remains the source of truth for its steps; the issue is a normal IssueDesk issue that knows where it came from.

---

## 14. Coverage and metric definitions

Everything below is derived at read time from the in-memory indexes; nothing extra is persisted.

| Metric | Definition |
|---|---|
| **Pass rate** | `pass / (pass + fail)` over the scope in question — a run, a module, or the recent window. Blocked and skipped are excluded from the denominator so they cannot flatter or punish the number. |
| **Latest pass rate (module)** | Pass rate of the most recent run containing at least one case in that module. |
| **Coverage** | Count of `active` cases per application × module, split manual vs automated. |
| **Untested modules** | Modules present in the taxonomy with zero cases — the gaps worth closing. |
| **Flake rate (runner)** | Share of runs in the window where a case under that runner flipped result with no intervening commit. |
| **Runner health** | `ok` · `warn` (flake ≥ 5%) · `bad` (last invocation failed or non-zero exit) · `idle` (no recent invocation). |
| **Risk highlight** | Modules with many open IssueDesk issues but low or no coverage; reads the existing issue index, stores nothing new. |

---

## 15. Routes and actions

Checkpoint occupies the `(qa)` route group of the shared SvelteKit app, with its own layout and chrome (see the shell document). Paths are placeholders and rename-able.

```
src/routes/
├── +page.svelte                         # launcher (chooses IssueDesk or Checkpoint)
├── (desk)/desk/…                        # IssueDesk workspace — unchanged
└── (qa)/qa/
    ├── +layout.svelte                   # Checkpoint chrome + nav
    ├── +page.server.ts / +page.svelte   # DASHBOARD (landing)
    ├── cases/
    │   ├── +page.server.ts              # case table
    │   └── [testId]/+page.server.ts     # case detail
    │       (actions: upsertCase, deprecateCase, addToSuite,
    │                 setParentIssue, createBugFromCase)
    ├── suites/
    │   ├── +page.server.ts              # suite cards
    │   └── [suiteId]/+page.server.ts    # suite editor
    │       (actions: upsertSuite, reorderCases, duplicateSuite, deleteSuite)
    ├── runs/
    │   ├── +page.server.ts              # run list
    │   ├── launch/+server.ts            # launch: dispatch runners, ingest reports
    │   └── [runId]/+page.server.ts      # run detail
    │       (actions: recordResult, createBugFromResult, completeRun, createCaseFromOrphan)
    ├── runners/+page.server.ts          # runner config
    │       (actions: upsertRunner, runNow, toggleEnabled)
    └── api/
        ├── import/tests/+server.ts      # JSON | CSV | discovery from a report
        ├── export/tests/+server.ts      # cases → json | csv | md
        └── export/failures/+server.ts   # failures → md | json
```

`createBugFromResult` / `createBugFromCase` call the existing issue-creation service directly — same process, same store.

---

## 16. UI and design system

Checkpoint uses the shared design system (Space Grotesk display, IBM Plex Sans body, JetBrains Mono for ids and commands; the same surfaces, tables, drawers, modals and toasts), with a **teal** workspace identity against IssueDesk's indigo.

**Test-kind colours** — each kind is consistently coloured across badges, filters, suite cards and run groups:

| Kind | Colour |
|---|---|
| Unit | violet |
| API | cyan |
| E2E | indigo |
| Visual | pink |
| Shell | slate |
| Manual | teal |

**Result colours** extend IssueDesk's traffic-light vocabulary: pass = green (its "Complete"), fail = red (its "Open"), blocked = amber (its "Implemented"), skipped = grey, flaky = purple.

**Reused components:** the priority pip-meter, the filter rail with checkbox facets, the table, drawers, modals, toasts and the top-bar user control — all straight from IssueDesk. **Checkpoint-specific components:** kind badges, the runner health row, the two-pane suite picker, the run-group panel with its command strip, the error box with artifact chips, and the dark export/prompt panel.

Motion is subtle and `prefers-reduced-motion` is honoured throughout.

---

## 17. What is reused unchanged

- **Storage engine** — JSON files on disk, no database (adds directories only).
- **In-memory store** — the singleton synced-from-JSON, write-through store (adds indexes).
- **Numbering** — per-app sequence with atomic increment (adds counter keys).
- **Taxonomy** — application / module / page / form from the same config.
- **Priority** — the same five levels and the same pip-meter.
- **Uploads** — the same endpoint and public-URL scheme, for failure artifacts.
- **Export pipeline** — the same "copy for Claude Code" mechanism, with a failures variant.
- **Shell and design system** — per the two-interface architecture.
- **Stack** — SvelteKit (adapter-node), Svelte 5 runes, TypeScript, Zod. No separate backend, no React.

The only change to an existing entity remains two optional fields on `Issue`.

---

## 18. Migration and rollout

- **Additive.** New directories and sequence keys; existing issue files and behaviour untouched. Deploying Checkpoint cannot break IssueDesk.
- **Kind migration.** Where an earlier `type` field exists: `manual` → `kind: 'manual'`; `automated` → kind inferred from its framework (Playwright → `e2e`, Vitest/Jest → `unit`), defaulting to `e2e`, with `runnerId` matched by framework name. No data is lost.
- **Landing-screen change.** `/qa` now resolves to the dashboard rather than the case list; `/qa/cases` is unchanged.
- **Empty-state first.** With no data the screens render honest empty states and the dashboard shows a "configure a runner / author a case" path.
- **Incremental adoption.** Start with one runner and a handful of smoke cases per app; health and coverage numbers accrue from the first run.

---

## 19. Testing Checkpoint itself

- **Unit** — id generation for `TC` / `SUITE` / `RUN` / `RNR` prefixes; pass-rate and coverage math; flake detection; the prefill mapping from a failed result to an issue payload.
- **Adapters** — a fixture report per format (JUnit XML, Playwright JSON, Vitest JSON, TAP, exit code, visual diff) parsed into the normalized shape, including malformed and partial reports.
- **Matching** — each `MatchStrategy` against realistic identifiers; orphan and missing-case handling.
- **Integration** — `createBugFromResult` creates a real issue and sets links on both sides; coverage reflects the latest run.
- **Store** — boot-sync loads new files into the indexes; runs persist immutably.
- **E2E** — author a case with a parent issue → add it to a new suite → launch across two runners → fail one, mark a manual one → file a bug → confirm bidirectional links → export failures and assert the prompt contains the reproduce command, expected steps and actual error.

---

## 20. Open questions and later work

- **CI triggering.** A webhook or CLI (`checkpoint run --suite SUITE-CHR-1 --env ci`) so pipelines create runs directly, plus a status badge back to the commit.
- **Scheduled runs.** Nightly regression suites without a person pressing launch.
- **Parallel dispatch.** Currently sequential by default; per-runner parallelism needs a concurrency cap and interleaved log handling.
- **Flake quarantine.** Auto-tagging a case as quarantined after N flips, excluded from pass rate until reviewed.
- **Requirements traceability.** Whether to link cases upward to a release or epic as well as to a parent issue.
- **Retention.** How long to keep raw reports and artifacts under `/data/reports/` before pruning.
- **Naming.** *Checkpoint*, *IssueDesk*, route prefixes and runner ids are all placeholders and rename-able.

---

*End of document. This consolidates the Checkpoint QA addendum and the runners/authoring addendum into a single specification. For base architecture and the issue lifecycle see the IssueDesk design document; for how the two workspaces coexist in one repository see the shell document.*
