# Checkpoint — Implementation Plan

**Goal:** add the *Checkpoint* test-management workspace to the IssueDesk repository as a
second, separate interface, switchable both from a **launcher at `/`** and a **top-left
workspace switcher** in each workspace's top bar.

**Prime directive:** *no regressions to IssueDesk* other than the switching mechanism. The
existing issue tracker must behave identically once it lives under `/desk`.

Source specs: [Checkpoint-Design-Document.md](./Checkpoint-Design-Document.md),
[Checkpoint-Mockups.html](./Checkpoint-Mockups.html), and the launcher/screens screenshots
under [mock-ui-screen-shots/](./mock-ui-screen-shots/).

---

## Regression safety net

Two gates run at the end of **every** task; a task is not "done" until both are green:

1. `npm test` — the existing Vitest suite (44 tests at baseline) plus the new Checkpoint tests.
2. `npm run check` — `svelte-check` (0 errors at baseline).

IssueDesk's `src/app.css` is treated as **frozen**. Only *new, inert* `:root` custom
properties may be appended (they cannot affect existing rendering). All Checkpoint styling
lives in a separate stylesheet scoped under a `.cp` root class, so it can never leak into
the IssueDesk DOM and always wins specificity over any globally-loaded IssueDesk rule.

Work happens on branch `feat/checkpoint`; each task ends with a commit **and** push.

---

## Architecture decisions

### Routes
```
src/routes/
├── +layout.server.ts        # SHARED data (users, apps, settings, currentUser) — stays at root
├── +layout.svelte           # BARE shell: app.css, global ToastHost, {@render children()}
├── +page.svelte / .server    # LAUNCHER (two cards, live stats)
├── desk/                     # IssueDesk — moved verbatim from root
│   ├── +layout.svelte        #   IssueDesk chrome (top bar + switcher, nav, modals)
│   ├── +page.*               #   issues list (+ all issue form-actions)
│   ├── board/ metrics/ admin/ issues/[id]/
├── qa/                       # Checkpoint
│   ├── +layout.svelte        #   Checkpoint chrome (teal, switcher, nav)
│   ├── +page.*               #   dashboard (landing)
│   ├── cases/ suites/ runs/ runners/
│   └── api/ import|export
└── api/                      # SHARED endpoints — unchanged (issues, uploads, export, files)
```
IssueDesk routes move `/ → /desk`. Bounded link updates: the `NAV` array, `actions.ts`
(`/?/x → /desk?/x`), `IssueModal.svelte` action, and a handful of `href="/"` / `goto('/')`.

### CSS isolation
- New tokens (teal `--ws*`, kind `--k-*`, result `--pass/--fail/...`) appended to global `:root`.
- `src/lib/checkpoint.css` — every selector prefixed `.cp `, imported only by the qa layout.
- Launcher styles are scoped under `.launcher` with bespoke class names (no `.btn`/`.card`).

### Backend reuse (additive only)
- `_sequence.json` gains counter keys `testCase` / `suite` / `run` (+ global `runners.json`, `RNR-n`).
- The store singleton gains `testCasesByApp`, `suitesByApp`, `runsByApp`, `runners`, `resultsByCase`.
- Keyed mutex, atomic tmp+rename writes, Zod-on-boot, uploads, taxonomy — reused verbatim.
- `Issue` gains two optional fields only: `testCaseId?`, `runId?`.

---

## Tasks (each = one commit + push, both gates green)

1. **Shell & switching** — bare root layout, launcher at `/`, move IssueDesk to `/desk`,
   add the workspace switcher to the IssueDesk top bar, stub `/qa`. IssueDesk unchanged.
2. **Domain types + schemas** — `TestCase`, `TestRunner`, `TestSuite`, `TestRun`, `CaseResult`,
   `RunnerInvocation`, enums; Zod parsers; `Issue.testCaseId?/runId?`.
3. **Storage layer** — fs paths for `tests/ suites/ runs/ runners.json reports/`; readers/writers;
   `_sequence.json` multi-counter extension.
4. **In-memory store** — indexes, per-app numbering for TC/SUITE/RUN + global RNR, CRUD,
   boot-sync, `resultsByCase`; unit tests.
5. **Runners & normalization** — adapters (junit-xml, playwright-json, vitest-json, pytest-json,
   tap, exit-code, visual-diff) → one `CaseResult` shape; match strategies; orphans/gaps; tests.
6. **Metrics & export** — pass-rate/coverage/flake/health math; failures→Markdown + JSON;
   result→issue prefill mapping; tests.
7. **Checkpoint chrome** — `/qa` layout, teal top bar + switcher + nav, `checkpoint.css` (`.cp`),
   Checkpoint UI store (drawer/modal/toast wiring).
8. **Dashboard** — KPI strip, recent-runs spark, system health, failing-now, coverage-by-module.
9. **Cases** — filter rail, table, detail drawer, new/edit case modal (exec block per kind).
10. **Suites** — suite cards, suite editor (details, live "runners this suite invokes", 2-pane picker).
11. **Runs** — run list, run detail grouped by runner, Launch dialog + execution/ingest endpoint.
12. **Runners** — runner cards, report-normalization explainer, run-now/edit actions.
13. **Import/export** — cases import (JSON/CSV/discover) & export (JSON/CSV/MD); failures modal + endpoints.
14. **IssueDesk integration** — fail→bug via the existing create service; bidirectional links; chips.
15. **Finish** — launcher live stats, seeds/empty states, full regression sweep, docs refresh.

---

## Non-goals (per design §3)
No auth, no test-framework reimplementation, no CI scheduler, no cross-project BI. Checkpoint
*invokes* and *reads* reports; it does not assert.
