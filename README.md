# IssueDesk

A file-backed bug reporting & feature-request tool for QA, dev-testers and stakeholders — and a
companion for the Claude Code sessions that fix the issues. Two workflows sit at its centre:

- **For people:** filter a set of issues, then export them as a ready-to-paste prompt.
- **For agents:** the [Agent API](docs/AGENT-API.md) — a Claude Code session signs in, pulls the
  open issues in a category, and works through them one at a time, marking each **to-be-verified**
  for a human tester. No copy-paste in the loop.

Built with **TypeScript · Svelte 5 (runes) · SvelteKit (adapter-node)**. No database: reference
data and issues live in human-readable JSON files under `data/`, uploads live on the local
filesystem, and everything is served from an in-memory write-through store. Access is
authenticated — username and password for the browser, JWT for the API, one login path for both.
See [docs/IssueDesk-Design-Document.md](docs/IssueDesk-Design-Document.md) for the full design,
[docs/AGENT-API.md](docs/AGENT-API.md) for the agent interface, and [DEPLOYMENT.md](DEPLOYMENT.md)
for exposing a custom domain, running in production, and starting the app on boot via systemd.

## Run

```bash
npm install
npm run dev        # dev server on http://localhost:5173
```

On first run, an empty `DATA_DIR` is seeded with **reference data only** — five
applications (Charcoal, Chattr, Coffee-ops, Relay, Drishti), their modules, a starter set of
**categories**, four people (Kiran Kharade, Anant Kharade, Aadinath Kharade, Tushar Kulange) and
one **agent account**, `claude-agent`. Any user can be a reporter; only users marked
**assignable** (Kiran, Tushar, the agent) appear in the assignee dropdown. **No issues are
seeded** — create them in the app.

### First sign-in

Nobody can sign in until an account has a password, so the first boot creates one: it promotes the
first account to admin and either uses `ISSUEDESK_ADMIN_PASSWORD` or generates a password and
prints it to the server log **once**.

```
[issuedesk] ──────────────────────────────────────────────────────────
[issuedesk]  First run: sign in as "kiran" with password:
[issuedesk]      xK7mQp2vRt9wLnBc4hYs
[issuedesk]  Shown once. Change it under Config → Accounts.
[issuedesk] ──────────────────────────────────────────────────────────
```

Sign in, then give everyone else — including `claude-agent` — a password under
**Config → Accounts → Password** (leave the field blank to generate one; it is shown once).
This bootstrap runs only while no account has a password, so it can never reset a live deployment.

Everything under `data/` is real data, not disposable fixtures; back it up with
`npm run backup:data`, and note the automatic rotating snapshots the server writes to
`data/.backups/` on each boot (see [Backups](#backups)).

Production:

```bash
npm run build
node build         # adapter-node server on PORT (default 3000)
```

For exposing a custom domain, loading `.env` into `node build`, and running IssueDesk as a
systemd service that starts on boot, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Relationship to Checkpoint

Checkpoint (test management) is a **separate application in its own repository** — it shares no
code with IssueDesk and is deployed independently, per test machine / environment.

The one link is optional and one-directional over HTTP. Checkpoint files bugs into IssueDesk
through the JSON API below when its `ISSUEDESK_URL` points here. IssueDesk needs nothing to
receive them, but two optional settings sweeten the link:

- `CHECKPOINT_URL` — when set, an issue filed from a test shows a "view test case" link into
  that Checkpoint instance.
- `ISSUEDESK_INGEST_TOKEN` — when set, `POST /api/issues` also accepts it as a bearer token in
  place of a login, so a Checkpoint that predates authentication keeps filing bugs. Unset, that
  route needs a token from `POST /api/auth/login` like every other.

## For Claude Code agents

An agent works the queue over HTTP instead of being handed pasted text. In short:

```bash
# 1. sign in with the agent account's username and password → JWT
TOKEN=$(curl -s -X POST localhost:5173/api/auth/login -H 'content-type: application/json' \
  -d '{"username":"claude-agent","password":"…"}' | jq -r .token)

# 2. claim the most urgent open issue in a category (204 = queue drained)
curl -s -X POST "localhost:5173/api/agent/next?category=security" -H "authorization: Bearer $TOKEN"

# 3. work from issue.markdown — the same brief "Copy for Claude Code" produces

# 4. hand it to a tester
curl -s -X POST localhost:5173/api/agent/issues/CHR-1/status -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"status":"to-be-verified","comment":"Fixed in a1b2c3d."}'
```

Agents cannot mark work `complete` or `rejected` — verification stays with a human tester.
Full reference: **[docs/AGENT-API.md](docs/AGENT-API.md)**.

## Screens

- **Sign in** — username and password; the session is a JWT in an httpOnly cookie. Every screen
  and every API route is behind it.
- **Issues** — filter rail (app, module, category, status, priority, source, tags and an updated-in
  date range), a prominent **Backlog** button for parked work, free-text search, sortable table and
  filter chips. Filters live in the URL, so any view is shareable.
- **New / Edit issue** — App is required, Module optional ("All modules / not sure yet"); Page and
  Form are free-text inputs (not seeded taxonomy); category picker, priority pip picker, status
  picker, drag-and-drop attachments (PNG/JPG/WEBP/GIF/PDF, validated server-side). Closing a form
  with unsaved changes asks first and can park them as a local draft.
- **Detail drawer** — rendered Markdown, attachment gallery with public URLs, activity
  timeline, quick status advance, per-issue *Copy for Claude Code*.
- **Board** — one column per status, Backlog through Rejected; drag a card to change status.
- **Metrics** — stat cards, open-by-application and by-priority bars, recent activity.
- **Config** (admin only) — accounts (usernames, human/agent kind, admin rights, passwords),
  applications, categories, data export/import and API keys. Writes back to `data/config/*.json`;
  password digests go to `data/auth/`, never to config or an export.
- **Export** — the current filter as Markdown (a templated Claude Code fix-batch prompt) or
  JSON, with one-click copy and download. `GET /api/export?format=md|json&<filter>`.

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | Root of all config / issues / uploads |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Host used to absolutise attachment URLs in exports |
| `MAX_UPLOAD_MB` | `15` | Per-file size cap |
| `MAX_ATTACHMENTS` | `10` | Per-issue attachment cap |
| `WATCH_FILES` | `false` | Re-sync the store when config / issue files are edited by hand |
| `AUTH_JWT_SECRET` | _(generated)_ | Signing secret for sessions and API tokens. Unset = generated once into `data/auth/jwt-secret.json`. Set it explicitly when running more than one instance |
| `AUTH_TOKEN_TTL_HOURS` | `12` | How long an issued token stays valid |
| `ISSUEDESK_ADMIN_PASSWORD` | _(generated)_ | First-boot admin password. Unset = generated and printed to the log once |
| `CHECKPOINT_URL` | _(unset)_ | Optional — base URL of a Checkpoint instance, for the "view test case" back-link on issues filed from a test |
| `ISSUEDESK_INGEST_TOKEN` | _(unset)_ | Optional — when set, `POST /api/issues` also accepts this bearer token instead of a login, for an existing Checkpoint |
| `DATA_SNAPSHOTS` | `true` | Write a rotating boot snapshot of the JSON data to `data/.backups/` |
| `DATA_SNAPSHOT_KEEP` | `10` | How many boot snapshots to retain |
| `PORT` | `3000` | adapter-node port |

## Data layout

```
data/                  # DATA_DIR — the issue tracker's data
├── config/            users.json · applications.json · categories.json · settings.json
├── auth/              credentials.json (scrypt digests) · jwt-secret.json — 0600, never exported
├── issues/<app>/      _sequence.json (per-app counter) · <module>.json (Issue[])
└── uploads/<app>/<issueId>/  attachments, served at /api/files/<app>/<issueId>/<file>
```

Issue IDs are per-application (`CHR-14`). Storage files are per-module. The whole `data/`
directory is self-contained — zip it, commit it, or rsync it to move the system. (Checkpoint's
content is a separate app with its own data root; nothing test-related is stored here.)

## Backups

The `data/` files are the database. Two safety nets protect them:

- **Automatic boot snapshots.** On every server start, the small structured data (config +
  all issue JSON) is copied to a rotating restore point under `data/.backups/<ts>/`
  (last 10 kept; `DATA_SNAPSHOTS=false` to disable, `DATA_SNAPSHOT_KEEP` to tune). `.backups`
  is outside every reader and the watcher, so it never feeds back into the store. To restore,
  copy a snapshot's folders back over `data/` and restart.
- **On-demand full archive.** `npm run backup:data` tars all of `data/` (uploads included) to
  `backups/data-<timestamp>.tar.gz`.
- **In-app export / import** (Admin → Data, or the API). `GET /api/data/export` downloads a
  single zip with every issue across all applications — full details, activity, sequence
  counters, config and all attachment binaries (Checkpoint content excluded). `POST
  /api/data/import` (multipart field `file`, or a raw zip body) validates the archive, moves
  the current `config/` + `issues/` + `uploads/` to `data/.backups/pre-import-<ts>/`, extracts
  the snapshot and reloads the running app. Curl-friendly:
  `curl -o ~/issuedesk-data.zip http://localhost:3000/api/data/export`.

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
