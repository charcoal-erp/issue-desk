# Checkpoint

Test management for the platform: author test cases, group them into suites, run manual or
automated runs across mixed frameworks (pytest, Playwright, Vitest, shell, manual), and turn
failures into a ready-to-paste Claude Code prompt.

Checkpoint is one of two separate apps in this repo — see the [root README](../README.md).
It shares no code with IssueDesk; the only link is an optional HTTP call (below).

## Why it runs everywhere

Unlike the central issue tracker, Checkpoint is **distributed**: one instance per test machine,
developer or environment, each pointed at whatever content it is testing. Its content —
`tests/`, `suites/`, `runs/`, `runners.json`, `reports/` and its own `config/` — lives under
`DATA_DIR`. Point that at a checked-out, git-versioned content repo (e.g. charcoal's
`platform-testing`) and the catalogue travels with the code under test; leave it at the default
and Checkpoint seeds an empty catalogue locally.

## Running

```bash
cd check-point
npm install
DATA_DIR=/path/to/content-repo npm run dev      # http://localhost:5174
```

Runs execute **in the background**: launching returns immediately and the run page follows
along, so a suite may take hours without a browser tab holding it open. Cases are dispatched
**per runner**; because suites are usually mutually destructive, one automated run executes at
a time. A timed-out runner is killed by process group, so a wrapper that started a service does
not leave it holding a port.

Seed a demo dataset on demand, with the app running:

```bash
python simulators/checkpoint_simulator.py --base-url http://localhost:5174
```

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./checkpoint-data` | Root of this Checkpoint's content + config. Point at a content repo. |
| `CHECKPOINT_WORKDIR` | `process.cwd()` | Base a runner's `workingDir` resolves against when a run executes |
| `PORT` | `3000` | adapter-node port |
| `WATCH_FILES` | `false` | Re-sync when content JSON changes on disk (e.g. a `git pull` in the content repo) |
| `ISSUEDESK_URL` | _(unset)_ | Optional — a central IssueDesk. Enables filing a bug from a failure and resolving issue links. |
| `ISSUEDESK_TOKEN` | _(unset)_ | Optional — bearer token sent to IssueDesk if it requires one |

## The optional IssueDesk link

With `ISSUEDESK_URL` set, a failing result gets a **File bug** button that POSTs to IssueDesk's
`/api/issues`, filed-bug and parent-issue chips link into that IssueDesk, and the parent-issue
picker is populated from it. With it unset, Checkpoint is **fully standalone** — those
affordances hide and failures still export as a Claude Code prompt / Markdown / JSON. Nothing
about running tests depends on the tracker being reachable.
