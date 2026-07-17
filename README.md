# IssueDesk

A file-backed bug reporting & feature-request tool for QA, dev-testers and stakeholders —
optimised for one workflow above all others: **filter a set of issues, then export them as a
ready-to-paste prompt for a Claude Code session.**

Built with **TypeScript · Svelte 5 (runes) · SvelteKit (adapter-node)**. No database, no auth:
reference data and issues live in human-readable JSON files under `data/`, uploads live on the
local filesystem behind stable public URLs, and everything is served from an in-memory
write-through store. See [docs/IssueDesk-Design-Document.md](docs/IssueDesk-Design-Document.md)
for the full design.

## Run

```bash
npm install
npm run dev        # dev server on http://localhost:5173
```

On first run, an empty `DATA_DIR` is seeded with a demo dataset (8 applications, 5 users,
15 issues) matching the reference mockups.

Production:

```bash
npm run build
node build         # adapter-node server on PORT (default 3000)
```

## Screens

- **Issues** — filter rail (app / status / priority / type), free-text search, sortable table,
  filter chips. Filters live in the URL, so any view is shareable.
- **New / Edit issue** — dependent App → Module → Page → Form dropdowns, priority pip picker,
  status picker, drag-and-drop attachments (PNG/JPG/WEBP/GIF/PDF, validated server-side).
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
| `WATCH_FILES` | `false` | Re-sync the store when data files are edited by hand |
| `PORT` | `3000` | adapter-node port |

## Data layout

```
data/
├── config/            users.json · applications.json · settings.json
├── issues/<app>/      _sequence.json (per-app counter) · <module>.json (Issue[])
└── uploads/<app>/<issueId>/  attachments, served at /api/files/<app>/<issueId>/<file>
```

Issue IDs are per-application (`CHR-14`); storage files are per-module. The whole `data/`
directory is self-contained — zip it, commit it, or rsync it to move the system.

## Tests

```bash
npm test           # vitest: store filtering/sequencing, export generators, upload validation
npm run check      # svelte-check, strict TS
```

IssueDesk is a single-instance, trusted-network tool by design — deploy it behind a VPN or an
authenticating reverse proxy.
