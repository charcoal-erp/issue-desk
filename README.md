# IssueDesk

A file-backed bug reporting & feature-request tool for QA, dev-testers and stakeholders —
optimised for one workflow above all others: **filter a set of issues, then export them as a
ready-to-paste prompt for a Claude Code session.**

Built with **TypeScript · Svelte 5 (runes) · SvelteKit (adapter-node)**. No database, no auth:
reference data and issues live in human-readable JSON files under `data/`, uploads live on the
local filesystem behind stable public URLs, and everything is served from an in-memory
write-through store. See [docs/IssueDesk-Design-Document.md](docs/IssueDesk-Design-Document.md)
for the full design, and [DEPLOYMENT.md](DEPLOYMENT.md) for exposing a custom domain, running in
production, and starting the app on boot via systemd.

## Run

```bash
npm install
npm run dev        # dev server on http://localhost:5173
```

On first run, an empty `DATA_DIR` is seeded with **reference data only** — five
applications (Charcoal, Chattr, Coffee-ops, Relay, Drishti), their modules, and four users
(Kiran Kharade, Anant Kharade, Aadinath Kharade, Tushar Kulange). Any user can be a reporter;
only users marked **assignable** (Kiran, Tushar) appear in the assignee dropdown. **No issues
are seeded** — create them in the app. Everything under `data/` is real data, not disposable
fixtures; back it up with `npm run backup:data`, and note the automatic rotating snapshots the
server writes to `data/.backups/` on each boot (see [Backups](#backups)).

Production:

```bash
npm run build
node build         # adapter-node server on PORT (default 3000)
```

For exposing a custom domain, loading `.env` into `node build`, and running IssueDesk as a
systemd service that starts on boot, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Two workspaces — IssueDesk + Checkpoint

The app hosts **two separate interfaces from one codebase, one backend and one deployment**:

- **IssueDesk** (`/desk`) — the bug & feature tracker described here (indigo).
- **Checkpoint** (`/qa`) — a test-management workspace (teal): test cases, suites, runners and
  runs across mixed frameworks (pytest, Playwright, Vitest, shell, manual), with failures
  exported as a ready-to-paste Claude Code prompt or filed as an IssueDesk bug next door. See
  [docs/Checkpoint-Design-Document.md](docs/Checkpoint-Design-Document.md).

  Runs execute **in the background**: launching returns immediately and the run page follows
  along, so a suite may take hours without a browser tab holding it open. Cases are dispatched
  **per runner** — a suite spanning a dozen module-level unit runners invokes each of them —
  and a run that a restart interrupts says so and can be closed or relaunched. Because suites
  are usually mutually destructive, **one automated run executes at a time**; a second launch is
  refused with a message naming the run in flight. A timed-out runner is killed by process
  group, so a wrapper that started a service does not leave it holding a port.

A launcher at `/` chooses a workspace; a switcher in the top-left of each moves between them.
The two never mix content on a screen. Checkpoint seeds nothing (honest empty states) —
populate a demo dataset (six runners, a spread of cases, two suites and a launched run) on
demand, with the app running:

```bash
python simulators/checkpoint_simulator.py
```

## Screens

- **Issues** — filter rail (app / status / priority / type), free-text search, sortable table,
  filter chips. Filters live in the URL, so any view is shareable.
- **New / Edit issue** — dependent App → Module dropdowns; Page and Form are free-text
  inputs (not seeded taxonomy); priority pip picker, status picker, drag-and-drop attachments
  (PNG/JPG/WEBP/GIF/PDF, validated server-side).
- **Detail drawer** — rendered Markdown, attachment gallery with public URLs, activity
  timeline, quick status advance, per-issue *Copy for Claude Code*.
- **Board** — Open / Implemented / Complete columns; drag a card to change status.
- **Metrics** — stat cards, open-by-application and by-priority bars, recent activity.
- **Config** — edit users and applications; writes back to `data/config/*.json`.
- **Export** — the current filter as Markdown (a templated Claude Code fix-batch prompt) or
  JSON, with one-click copy and download. `GET /api/export?format=md|json&<filter>`.

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | Root of all config / issues / uploads |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Host used to absolutise attachment URLs in exports |
| `MAX_UPLOAD_MB` | `15` | Per-file size cap |
| `MAX_ATTACHMENTS` | `10` | Per-issue attachment cap |
| `WATCH_FILES` | `false` | Re-sync the store when data files are edited by hand (covers Checkpoint dirs too) |
| `CHECKPOINT_DATA_DIR` | `DATA_DIR` | Separate root for Checkpoint content (`tests/`, `suites/`, `runs/`, `runners.json`, `reports/`) — point it at a git-versioned content repo while issues stay under `DATA_DIR` |
| `CHECKPOINT_WORKDIR` | `process.cwd()` | Base directory runner working-dirs resolve from when a Checkpoint run executes |
| `DATA_SNAPSHOTS` | `true` | Write a rotating boot snapshot of the JSON data to `data/.backups/` |
| `DATA_SNAPSHOT_KEEP` | `10` | How many boot snapshots to retain |
| `PORT` | `3000` | adapter-node port |

## Data layout

```
data/                  # DATA_DIR — the issue tracker's data
├── config/            users.json · applications.json · settings.json
├── issues/<app>/      _sequence.json (per-app counter) · <module>.json (Issue[])
├── uploads/<app>/<issueId>/  attachments, served at /api/files/<app>/<issueId>/<file>
│
│                      # Checkpoint — under CHECKPOINT_DATA_DIR, same root by default
├── runners.json       runner definitions (global, RNR-n)
├── tests/<app>/       _sequence.json (testCase/suite/run counters) · <module>.json (TestCase[])
├── suites/<app>.json  TestSuite[] per app
├── runs/<app>/        <runId>.json (one immutable file per run)
└── reports/<runId>/   captured raw reports & artifacts
```

Issue IDs are per-application (`CHR-14`); Checkpoint mirrors this (`TC-CHR-12`, `SUITE-CHR-4`,
`RUN-CHR-31`). Storage files are per-module. The whole `data/` directory is self-contained —
zip it, commit it, or rsync it to move the system.

With `CHECKPOINT_DATA_DIR` set, the Checkpoint half of the tree (`runners.json`, `tests/`,
`suites/`, `runs/`, `reports/`) lives under that root instead — e.g. a git-versioned test-content
repo — while `config/`, `issues/` and `uploads/` stay under `DATA_DIR`. Each root then keeps its
own `.backups/` boot snapshots, and the `WATCH_FILES` watcher covers both.

## Backups

The `data/` files are the database. Two safety nets protect them:

- **Automatic boot snapshots.** On every server start, the small structured data (config +
  all issue/Checkpoint JSON) is copied to a rotating restore point under `data/.backups/<ts>/`
  (last 10 kept; `DATA_SNAPSHOTS=false` to disable, `DATA_SNAPSHOT_KEEP` to tune). `.backups`
  is outside every reader and the watcher, so it never feeds back into the store. To restore,
  copy a snapshot's folders back over `data/` and restart.
- **On-demand full archive.** `npm run backup:data` tars all of `data/` (uploads included) to
  `backups/data-<timestamp>.tar.gz`.

> **Testing tip:** never run the app against `./data` for throwaway experiments and never
> `rm` a `data/` subdirectory blindly — point `DATA_DIR` at a scratch dir instead
> (`DATA_DIR=/tmp/scratch npm run preview`). If you must delete Checkpoint data, remove only
> `data/tests`, `data/suites`, `data/runs`, `data/reports`, `data/runners.json`.

## Tests

```bash
npm test           # vitest: store filtering/sequencing, export generators, upload validation
npm run check      # svelte-check, strict TS
```

IssueDesk is a single-instance, trusted-network tool by design — deploy it behind a VPN or an
authenticating reverse proxy.
