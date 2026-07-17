# IssueDesk — Design Document

**A file-backed bug reporting & feature-request tool for QA, dev-testers and stakeholders**

| | |
|---|---|
| **Version** | 1.0 (Design) |
| **Author** | Kiran Kharade / Inflection Zone Lab |
| **Stack** | TypeScript · Svelte 5 (runes) · SvelteKit (Node adapter) |
| **Persistence** | JSON files + local filesystem (no database) |
| **Backend** | SvelteKit server runtime only — no separate API service |
| **Status** | Draft for review |

> "IssueDesk" is used as the working product name throughout this document. Rename freely — the name appears only in the wordmark, page `<title>`, and the export header template.

---

## Table of contents

1. [Overview](#1-overview)
2. [Goals & non-goals](#2-goals--non-goals)
3. [Personas & primary flows](#3-personas--primary-flows)
4. [Functional requirements](#4-functional-requirements)
5. [Non-functional requirements](#5-non-functional-requirements)
6. [High-level architecture](#6-high-level-architecture)
7. [Technology stack](#7-technology-stack)
8. [Data model](#8-data-model)
9. [On-disk storage layout](#9-on-disk-storage-layout)
10. [In-memory store & sync strategy](#10-in-memory-store--sync-strategy)
11. [Routing & server endpoints](#11-routing--server-endpoints)
12. [File uploads & public URLs](#12-file-uploads--public-urls)
13. [Filtering, sorting & pagination](#13-filtering-sorting--pagination)
14. [Export to Claude Code](#14-export-to-claude-code)
15. [UI / UX design](#15-ui--ux-design)
16. [Validation & error handling](#16-validation--error-handling)
17. [Concurrency, integrity & backups](#17-concurrency-integrity--backups)
18. [Security posture (no auth)](#18-security-posture-no-auth)
19. [Project structure](#19-project-structure)
20. [Request lifecycle walkthroughs](#20-request-lifecycle-walkthroughs)
21. [Configuration & environment](#21-configuration--environment)
22. [Testing strategy](#22-testing-strategy)
23. [Future enhancements](#23-future-enhancements)
24. [Appendix A — example data files](#appendix-a--example-data-files)
25. [Appendix B — example Markdown export](#appendix-b--example-markdown-export)

---

## 1. Overview

IssueDesk is a lightweight, self-hosted web application for capturing bugs and feature requests across a portfolio of software products. It is optimised for one workflow above all others: **filter a set of issues, then export them as a ready-to-paste prompt for a Claude Code session.** Everything else — the intake form, the triage table, the status board — exists to feed that export cleanly.

The tool deliberately avoids a database and authentication. Reference data (users, applications, modules, pages, forms) lives in JSON config files; issues live in per-app/per-module JSON files; uploaded screenshots and PDFs live on the local filesystem behind stable public URLs. On boot, the server loads everything into an in-memory index so that reads, filters and exports are instantaneous. Mutations are written through to the JSON files immediately so the on-disk copy is always the source of truth.

Because there is no separate backend service, the entire application is a single SvelteKit app. SvelteKit's own server runtime (running under `@sveltejs/adapter-node`) performs all file I/O through `load` functions, form actions, and a small number of `+server.ts` endpoints. The browser never touches the filesystem directly — that is not possible — but from the operator's perspective there is exactly one thing to run and deploy.

---

## 2. Goals & non-goals

### Goals

- Frictionless intake: a tester can file a well-structured issue in under a minute, choosing application → module → page → form from dropdowns.
- Rich attachments: images and PDFs uploaded per issue, each reachable at a permanent public URL.
- Fast triage: a dense, filterable, sortable table plus a status board (Open / Implemented / Complete).
- **First-class Claude Code export**: any filtered view can be serialised to JSON or Markdown and copied in one click, structured so it drops straight into a Claude Code prompt.
- Zero external dependencies at runtime: no DB, no auth provider, no object store. Files only.
- Human-readable, diffable, git-committable data: every issue is plain JSON you can inspect, grep, or version.

### Non-goals

- Multi-tenant SaaS, org/role management, or per-user permissions. IssueDesk is an internal single-tenant tool.
- Real authentication or authorization. A "current user" is selected from a dropdown, not authenticated.
- Horizontal scaling / multi-instance deployment. The in-memory store assumes a single Node process (see [§10](#10-in-memory-store--sync-strategy)).
- Workflow automation, SLAs, notifications, or email. Out of scope for v1 (see [§23](#23-future-enhancements)).

---

## 3. Personas & primary flows

| Persona | Needs | Primary action |
|---|---|---|
| **Test engineer** | File many precise bugs quickly with screenshots | Create Issue |
| **Dev-tester** | File bugs found while developing, cross-reference modules | Create Issue, Filter by app/module |
| **Stakeholder** | Raise feature requests and track status | Create Issue (Feature), watch the board |
| **Developer (you)** | Pull a filtered batch of open bugs into Claude Code | Filter → Export → Copy |

**Flow A — File a bug.** Pick current user → click *New Issue* → the modal opens → choose App, Module, Page, Form → type title + description → set priority → attach screenshots/PDF → *Create*. The issue receives a per-app ID (e.g. `CHR-14`) and appears in the table with a red status rail (Open).

**Flow B — Triage.** Open the table → filter by App = Charcoal ERP, Status = Open, Priority ≥ High → sort by priority → open an issue to read detail, reassign, or move status to Implemented (yellow) / Complete (green).

**Flow C — Feed Claude Code.** With the same filter applied → click *Export* → toggle Markdown → review the generated prompt → *Copy for Claude Code* → paste into a Claude Code session. Attachment public URLs travel with the text, so Claude Code can reference the screenshots.

---

## 4. Functional requirements

**Intake**

- FR-1 Create an issue with: application, module, page, form (all from configured lists), issue type (Bug / Feature), title, description (Markdown-capable), priority, status, reporter, optional assignee, optional tags.
- FR-2 Upload one or more attachments (images: png/jpg/webp/gif; documents: pdf) per issue, with client-side size/type checks and server-side validation.
- FR-3 Edit any field of an existing issue; add/remove attachments; append comments (activity log).
- FR-4 Priority is one of: **Critical, Very High, High, Medium, Low**.
- FR-5 Status is one of: **Open (Red), Implemented (Yellow), Complete (Green)**.

**Reference data**

- FR-6 A user dropdown in the top bar sets the "current user", sourced from `users.json`. No password.
- FR-7 Applications, modules, pages, and forms are sourced from config files and surfaced as dependent dropdowns (choosing an app filters modules; choosing a module filters pages; etc.).
- FR-8 An admin view lets the operator view/add/edit reference data (writes back to the config files).

**Listing & triage**

- FR-9 A table lists issues with columns: status, ID, title, app, module, priority, reporter, assignee, attachments count, updated-at, and row actions.
- FR-10 Filter by any combination of: app, module, page, form, status, priority, type, reporter, assignee, tag, free-text search, and updated-date range.
- FR-11 Sort by ID, priority, status, updated-at; paginate or virtualise long lists.
- FR-12 A board view groups issues into three columns by status.

**Attachments & URLs**

- FR-13 Every uploaded file is reachable at a stable, public URL of the form `/{files}/{app}/{issueId}/{filename}` that can be referenced from anywhere (e.g. pasted into Claude Code, Slack, or a doc).

**Export**

- FR-14 Any filtered result set can be exported as **JSON** or **Markdown**.
- FR-15 The export is copy-to-clipboard in one click and download-to-file as a secondary action.
- FR-16 The Markdown export is templated specifically for Claude Code (task framing, context block, reproduction steps, attachment URLs).

---

## 5. Non-functional requirements

- NFR-1 **Performance.** All reads/filters/exports served from memory; p95 filter render < 50 ms for up to ~20k issues. Writes flush to disk asynchronously without blocking the response beyond the single-file write.
- NFR-2 **Durability.** On-disk JSON is the source of truth; the in-memory store is a cache rebuildable from disk at any time. No data lives only in memory.
- NFR-3 **Portability.** The entire `/data` directory is self-contained and can be zipped, git-committed, or rsynced to move the whole system.
- NFR-4 **Transparency.** Data files are human-readable and stable-ordered so diffs are meaningful.
- NFR-5 **Accessibility.** Keyboard-navigable table and modals, visible focus, ARIA on dialogs, `prefers-reduced-motion` respected, WCAG-AA contrast.
- NFR-6 **Resilience.** A malformed config or issue file is logged and skipped, never crashing boot.

---

## 6. High-level architecture

There is **one** deployable: the SvelteKit app. It contains both the UI (Svelte 5 components rendered on server + hydrated on client) and the server logic (file I/O, in-memory store, upload/serve endpoints). "No backend API service" means there is no second process — not that there is no server. The server is SvelteKit itself.

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser (client)                          │
│   Svelte 5 components · runes · dependent dropdowns · modals       │
│   Table/board rendering · export preview · clipboard copy          │
└───────────────▲───────────────────────────────┬───────────────────┘
                │ hydration / fetch              │ form actions, GET/POST
                │                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                 SvelteKit server (Node adapter)                    │
│                                                                    │
│   +page.server.ts (load)      +page.server.ts (actions)            │
│   +server.ts (/api/uploads)   +server.ts (/files/[...path])        │
│   +server.ts (/api/export)                                         │
│                    │                                               │
│                    ▼                                               │
│        ┌───────────────────────────┐                              │
│        │   IssueStore (singleton)   │  in-memory indexes           │
│        │   Map<id, Issue> + idx     │  read-through / write-through │
│        └───────────┬───────────────┘                              │
│                    │ read on boot / write on mutation              │
└────────────────────┼───────────────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Local filesystem  (/data)                      │
│   /config/*.json     reference data (users, apps, taxonomy)        │
│   /issues/<app>/<module>.json     issues, grouped                  │
│   /issues/<app>/_sequence.json    per-app counter                  │
│   /uploads/<app>/<issueId>/*      attachments                      │
└──────────────────────────────────────────────────────────────────┘
```

Key architectural decisions:

1. **SvelteKit form actions** are the write path for issues (progressive-enhancement friendly, no hand-rolled fetch layer needed). `load` functions are the read path. Uploads and file-serving need streaming/binary handling, so those are the only dedicated `+server.ts` endpoints.
2. **A module-level singleton store** (`src/lib/server/store/index.ts`) holds the in-memory state. Because Node keeps module singletons alive for the process lifetime, the store persists across requests. This is safe only for a single instance — an explicit, accepted constraint.
3. **Write-through, not write-behind.** A mutation updates memory and awaits the file write before the action returns success, so a client never sees a "saved" state that isn't on disk. Writes are serialised per file via an async mutex ([§17](#17-concurrency-integrity--backups)).

---

## 7. Technology stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **SvelteKit** (latest) | Full-stack, file-based routing, form actions, server + client from one codebase |
| Language | **Svelte 5** with runes (`$state`, `$derived`, `$props`, `$effect`) | Fine-grained reactivity for the table/filters without a store library |
| Types | **TypeScript** (strict) | End-to-end types shared between server store and UI |
| Adapter | **@sveltejs/adapter-node** | Long-lived Node process so the in-memory store survives; direct fs access |
| Validation | **Zod** | One schema per entity, reused for form parsing, file validation, and config loading |
| IDs (internal) | **UUID v7** for a stable `uuid` field; human ID is the per-app sequence code | Sortable UUIDs for internal refs; readable `CHR-14` for humans |
| File watching (optional) | **chokidar** | Re-sync memory if JSON files are edited out-of-band |
| Markdown render | **marked** + **DOMPurify** (client) | Render issue descriptions safely in detail view |
| Styling | Plain CSS with design tokens (CSS custom properties) | No framework needed; matches the mockup |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Store logic and full flows |

No database driver, no ORM, no auth library. (TypeORM/Postgres from your usual stack are intentionally absent here — the whole point is file portability.)

---

## 8. Data model

All types live in `src/lib/types.ts` and are shared by client and server.

```ts
// ---------- Enums ----------
export const PRIORITIES = ['critical', 'very_high', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['open', 'implemented', 'complete'] as const;
export type Status = (typeof STATUSES)[number]; // open→Red, implemented→Yellow, complete→Green

export const ISSUE_TYPES = ['bug', 'feature'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

// ---------- Reference data ----------
export interface User {
  id: string;            // slug, e.g. "kiran"
  name: string;          // "Kiran Kharade"
  role?: string;         // "Architect", "QA", "Stakeholder"
  avatarColor?: string;  // hex, for the avatar chip
  active?: boolean;
}

export interface FormRef  { id: string; name: string; }              // e.g. "otp-verification" / "OTP Verification"
export interface PageRef  { id: string; name: string; path?: string; forms: FormRef[]; }
export interface ModuleRef{ id: string; code: string; name: string; pages: PageRef[]; }

export interface Application {
  id: string;            // slug, e.g. "charcoal-erp"
  code: string;          // short code used in issue IDs, e.g. "CHR"
  name: string;          // "Charcoal ERP"
  color?: string;        // accent for app chips
  modules: ModuleRef[];
}

// ---------- Attachments ----------
export interface Attachment {
  id: string;            // uuid v7
  filename: string;      // stored (sanitised) filename
  originalName: string;  // as uploaded
  mime: string;          // "image/png" | "application/pdf" | ...
  kind: 'image' | 'pdf';
  size: number;          // bytes
  url: string;           // public URL: /files/<app>/<issueId>/<filename>
  uploadedBy: string;    // user id
  uploadedAt: string;    // ISO 8601
}

// ---------- Activity / comments ----------
export interface Activity {
  id: string;
  at: string;            // ISO
  by: string;            // user id
  kind: 'created' | 'comment' | 'status' | 'priority' | 'assignee' | 'edit' | 'attachment';
  message?: string;      // for comments
  from?: string;         // for field changes
  to?: string;
}

// ---------- The core entity ----------
export interface Issue {
  id: string;            // human ID, per-app sequence, e.g. "CHR-14"
  uuid: string;          // uuid v7, stable internal reference
  seq: number;           // 14 (the per-app number behind the ID)

  type: IssueType;
  title: string;
  description: string;   // Markdown

  // Location context (all denormalised for fast filtering + export)
  appId: string;   appCode: string;   appName: string;
  moduleId: string; moduleCode: string; moduleName: string;
  pageId?: string;  pageName?: string;  pagePath?: string;
  formId?: string;  formName?: string;

  priority: Priority;
  status: Status;

  reporterId: string;
  assigneeId?: string;
  tags: string[];

  attachments: Attachment[];
  activity: Activity[];

  createdAt: string;     // ISO
  updatedAt: string;     // ISO
}
```

**Why denormalise app/module names onto the issue?** Filtering, sorting and export all run against issues alone, with no joins. It also means an exported Markdown file is self-describing even if reference data later changes. Reference data remains the editable source; issues carry a snapshot of the labels at write time (labels refreshed on edit).

Query/filter types:

```ts
export interface IssueFilter {
  q?: string;                 // free text over title + description + id
  appId?: string;
  moduleId?: string;
  pageId?: string;
  formId?: string;
  type?: IssueType;
  status?: Status[];          // multi-select
  priority?: Priority[];      // multi-select
  reporterId?: string;
  assigneeId?: string;
  tag?: string;
  updatedFrom?: string;       // ISO date
  updatedTo?: string;
  sort?: 'id' | 'priority' | 'status' | 'updated';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
```

---

## 9. On-disk storage layout

Everything lives under a single `DATA_DIR` (default `./data`, overridable by env).

```
data/
├── config/
│   ├── users.json                 # User[]
│   ├── applications.json          # Application[]  (apps → modules → pages → forms)
│   └── settings.json              # app-wide settings (product name, defaults)
│
├── issues/
│   ├── charcoal-erp/
│   │   ├── _sequence.json         # { "code": "CHR", "next": 15 }
│   │   ├── auth.json              # Issue[]  (all issues in Charcoal › Auth)
│   │   ├── billing.json
│   │   └── inventory.json
│   ├── amrutm/
│   │   ├── _sequence.json         # { "code": "AMR", "next": 8 }
│   │   ├── opd.json
│   │   └── pharmacy.json
│   └── drishti/
│       └── ...
│
└── uploads/
    ├── charcoal-erp/
    │   ├── CHR-14/
    │   │   ├── 01-login-screen.png
    │   │   └── 02-network-trace.pdf
    │   └── CHR-09/
    │       └── 01-error.png
    └── amrutm/
        └── AMR-07/
            └── 01-opd-form.png
```

### Numbering scheme (per-app sequence)

The requirement is *numbering per app*, with issues *organised into files by module*. These two facts are separated cleanly:

- **The sequence counter is per application**, stored in `issues/<app>/_sequence.json`. Charcoal's counter is shared across all its modules, so IDs run `CHR-1, CHR-2, CHR-3 …` regardless of whether each issue is a login bug or a billing bug.
- **The storage file is chosen by module**: `CHR-14` (an Auth bug) is appended to `issues/charcoal-erp/auth.json`; `CHR-15` (a billing bug) goes to `billing.json`. The number does not restart per module.
- The canonical human ID is therefore `` `<APP_CODE>-<SEQ>` `` → `CHR-14`. The module is shown as a separate column, not baked into the number (so an issue can, in principle, be moved between modules — i.e. between files — without changing its ID).

**Allocating a new number** is the one operation that must be atomic across modules of the same app: read `_sequence.json`, take `next`, increment and write it back, then write the issue into the module file. Both writes happen under the app-level mutex ([§17](#17-concurrency-integrity--backups)) so two simultaneous "create" actions can never collide on a number.

Each module JSON file is simply a stable-sorted `Issue[]`. Files are written with 2-space indentation and issues sorted by `seq` so git diffs stay minimal.

---

## 10. In-memory store & sync strategy

`src/lib/server/store/index.ts` exposes a singleton `IssueStore`.

**On boot (lazy, on first access):**

1. Read and Zod-validate `config/*.json` into memory.
2. Walk `issues/*/*.json`, validate each `Issue[]`, and populate:
   - `byId: Map<string, Issue>` — primary index.
   - Secondary indexes for fast filtering: `byApp`, `byModule`, `byStatus`, `byPriority`, `byAssignee` (each a `Map<key, Set<issueId>>`).
   - A lightweight inverted token index over title+description for `q` search (optional; linear scan is fine at this scale too).
3. Load each app's `_sequence.json` into `sequences: Map<appId, {code, next}>`.

**Reads** (`list(filter)`, `get(id)`) run entirely in memory. `list` intersects the relevant index sets, then applies residual predicates (text, date range), then sorts and paginates.

**Writes** (`create`, `update`, `remove`, `addAttachment`) follow write-through:

```
mutate memory  →  serialise the affected file(s)  →  await fs.writeFile  →  return
                                                   (all under a per-file async mutex)
```

Only the touched module file (and, on create, the app's `_sequence.json`) is rewritten — never the whole dataset.

**External edits (optional).** If you hand-edit a JSON file, a `chokidar` watcher (enabled by `WATCH_FILES=true`) re-reads just that file and refreshes the affected indexes, so the running app and the files stay consistent. In dev this is convenient; in production it can stay off.

**Single-instance constraint.** Because the store is process-local, running two instances behind a load balancer would give each its own cache and its own idea of the next sequence number. IssueDesk is therefore single-instance by design. If multi-instance ever becomes necessary, the sequence allocation and cache invalidation must move to a shared component (out of scope; see [§23](#23-future-enhancements)).

**Store interface (server-only):**

```ts
export interface IssueStore {
  // reference data
  users(): User[];
  applications(): Application[];
  settings(): Settings;

  // issues
  list(filter: IssueFilter): { rows: Issue[]; total: number };
  get(id: string): Issue | undefined;
  create(input: CreateIssueInput, actor: string): Promise<Issue>;
  update(id: string, patch: UpdateIssueInput, actor: string): Promise<Issue>;
  remove(id: string, actor: string): Promise<void>;
  addAttachment(id: string, a: Attachment, actor: string): Promise<Issue>;
  removeAttachment(id: string, attachmentId: string, actor: string): Promise<Issue>;
  comment(id: string, message: string, actor: string): Promise<Issue>;

  // reference-data mutations (admin)
  upsertApplication(app: Application): Promise<void>;
  upsertUser(user: User): Promise<void>;
}
```

---

## 11. Routing & server endpoints

SvelteKit file-based routes. `+page.server.ts` provides `load` (reads) and `actions` (writes); binary/stream work lives in `+server.ts`.

```
src/routes/
├── +layout.server.ts        # load users, applications, current-user cookie
├── +layout.svelte           # top bar (user dropdown, nav), modal host, toasts
│
├── +page.server.ts          # load: list(filter) from query params
├── +page.svelte             # ISSUES table view (default screen)
│      actions: createIssue, updateIssue, deleteIssue, comment,
│               changeStatus, changePriority, changeAssignee
│
├── board/
│   ├── +page.server.ts      # load: issues grouped by status
│   └── +page.svelte         # BOARD view
│
├── issues/[id]/
│   ├── +page.server.ts      # load a single issue (detail, if deep-linked)
│   └── +page.svelte         # detail (also usable as modal content)
│
├── admin/
│   ├── +page.server.ts      # load reference data
│   └── +page.svelte         # ADMIN: users / applications / modules editors
│                 actions: upsertUser, upsertApplication, ...
│
└── api/
    ├── uploads/+server.ts    # POST multipart → save file(s) → return Attachment[]
    ├── files/[...path]/+server.ts  # GET → stream an upload (public URL target)
    └── export/+server.ts     # GET ?format=json|md&<filter> → text/markdown or json
```

Notes:

- **Filters live in the URL query string** (`/?appId=charcoal-erp&status=open&priority=high`). This makes any filtered view shareable/bookmarkable and lets `load` be the single source of the current result set. The Export button simply mirrors the current query to `/api/export`.
- **Form actions return typed results**; the client uses `use:enhance` for optimistic UI and toast feedback, falling back to full-page POST if JS is off.
- **`/api/files/[...path]`** is what gives uploads their public URL. It resolves the path safely against `DATA_DIR/uploads`, guards against traversal, sets `Content-Type` and long-lived cache headers, and streams the file.

---

## 12. File uploads & public URLs

**Upload endpoint** — `POST /api/uploads` (multipart):

1. Parse the multipart body (SvelteKit `request.formData()`); read `appId`, `issueId` (or `pending` for pre-create), and the file blobs.
2. Validate each file server-side with Zod + magic-byte sniffing: allowed MIME set `{png, jpeg, webp, gif, pdf}`, max size (default 15 MB, configurable), max count per issue.
3. Sanitise the filename (`slugify` + numeric prefix `01-`, `02-` for ordering) to prevent collisions and traversal.
4. Ensure `uploads/<app>/<issueId>/` exists; stream the blob to disk.
5. Build the `Attachment` record and return it (the create/edit form then persists these onto the issue).

For the **pre-create** case (attaching before the issue has an ID), files are written to `uploads/<app>/_pending/<draftId>/…` and moved to `uploads/<app>/<issueId>/…` when the issue is created and its ID is known. A nightly/boot sweep clears stale `_pending` folders.

**Public URLs** — every attachment gets:

```
/api/files/{appSlug}/{issueId}/{filename}
e.g.  /api/files/charcoal-erp/CHR-14/01-login-screen.png
```

Served by `api/files/[...path]/+server.ts`, which:

- Rejects any path containing `..` or leading `/` after normalisation.
- Resolves strictly under `DATA_DIR/uploads`; returns 404 if the resolved path escapes or doesn't exist.
- Infers `Content-Type` from extension, sets `Cache-Control: public, max-age=31536000, immutable` (filenames are content-stable), supports `Range` for large PDFs.

Because these URLs are plain HTTP GETs with no auth, they are exactly the "reference from anywhere" URLs the export embeds. (Anyone with the URL and network access can fetch the file — an accepted consequence of the no-auth posture; see [§18](#18-security-posture-no-auth).)

*Alternative considered:* writing uploads into SvelteKit's `static/` directory to get root-level URLs for free. Rejected because `static/` is a build-time concept, mixing runtime data into it complicates deploys and backups, and the streaming route gives cleaner separation and traversal safety. The dedicated route wins.

---

## 13. Filtering, sorting & pagination

Filtering is a two-stage process in the store:

1. **Index intersection** for the equality facets present in the filter (`appId`, `moduleId`, `status[]`, `priority[]`, `assigneeId`, `tag`). Each contributes a `Set<issueId>`; the store intersects the smallest sets first.
2. **Residual predicates** applied to the surviving rows: free-text `q` (case-insensitive over id/title/description), `updatedFrom/To` date range, `pageId`/`formId`.

Then **sort** (default `updated` desc; priority sort uses the enum's intrinsic order Critical→Low) and **paginate** (`page`, `pageSize`, default 50). For very large datasets the client table virtualises rows; the server still returns a bounded page.

The UI keeps filter state in `$state` and pushes it to the URL (`goto` with `keepFocus`/`noScroll`) so the `load` re-runs and the table + export stay in lockstep. A "filter summary" chip row shows active filters with one-click removal, and an issue count ("37 issues match").

---

## 14. Export to Claude Code

This is the feature the rest of the app serves. The **export always reflects the current filter** — what you see is what you export.

**Endpoint:** `GET /api/export?format=md|json&<same filter params as the table>`
**UI:** an *Export* button opens the Export panel (styled as a code/terminal surface) with a JSON ⇄ Markdown toggle, a live preview, **Copy for Claude Code**, and **Download**.

### 14.1 JSON format

A compact, machine-friendly array — the same `Issue` shape, optionally trimmed of `activity` for brevity, with attachment URLs absolutised (host-qualified) so they resolve from a Claude Code session:

```json
{
  "generatedAt": "2026-07-17T09:20:00+05:30",
  "filter": { "appId": "charcoal-erp", "status": ["open"], "priority": ["critical","very_high","high"] },
  "count": 3,
  "issues": [
    {
      "id": "CHR-14",
      "type": "bug",
      "title": "Login fails with a valid OTP",
      "app": "Charcoal ERP",
      "module": "Auth",
      "page": "/login",
      "form": "OTP Verification",
      "priority": "critical",
      "status": "open",
      "reporter": "Priya Nair",
      "assignee": "Kiran Kharade",
      "description": "Entering the correct 6-digit OTP returns 'Invalid code'...",
      "attachments": [
        "https://issuedesk.internal/api/files/charcoal-erp/CHR-14/01-login-screen.png",
        "https://issuedesk.internal/api/files/charcoal-erp/CHR-14/02-network-trace.pdf"
      ]
    }
  ]
}
```

### 14.2 Markdown format (Claude Code prompt)

Templated for a coding agent: a short task instruction, then one self-contained section per issue with a stable heading, a context table, description, reproduction steps, and clickable attachment URLs. A full example is in [Appendix B](#appendix-b--example-markdown-export). The template:

```
# Fix batch — {appName} ({count} {issue|issues})
_Exported from IssueDesk on {date}. Filter: {human-readable filter}._

You are fixing reported issues in **{appName}**. Address each issue below.
For every fix, reference the issue ID in your commit message.

---

## {id} · [{PRIORITY}] {title}

| | |
|---|---|
| **App / Module** | {appName} / {moduleName} |
| **Page / Form**  | {pagePath or pageName} · {formName} |
| **Type**         | {Bug|Feature} |
| **Status**       | {Open|Implemented|Complete} |
| **Reporter**     | {reporterName} |

**Description**
{description}

**Attachments**
- {url1}
- {url2}
```

The generator lives in `src/lib/server/export/toMarkdown.ts` / `toJson.ts` and is pure (issues in, string out) so it is trivially unit-tested and reused by both the endpoint and a future CLI.

---

## 15. UI / UX design

The accompanying HTML/CSS/JS mockup (`IssueDesk-Mockups.html`) is the visual source of truth. This section records the design system and the screen inventory it implements.

### 15.1 Design language

The tool is a **precision instrument for engineers**, so the work surface is light, cool and dense; the one bold moment is the **export panel rendered as a dark terminal-style surface** — a deliberate "this is what you feed the machine" contrast.

- **Two independent visual dimensions, separated by *form* not just colour** so they never clash:
  - **Status** = a coloured **dot + word** and a **left colour rail** on each table row. Open → red `#E5484D`, Implemented → amber `#F5A623`, Complete → green `#30A46C`.
  - **Priority** = a **pip meter** (five squares, N filled) + word, on a warm-to-cool ramp. Critical (5) → Low (1). Because status is always a dot and priority is always a meter, the eye never confuses them even where both use warm hues.
- **Mono issue IDs** (`CHR-14`) in JetBrains Mono tie the table, the detail header, and the export together, and echo the export-to-code purpose.
- **Palette:** cool paper `#F6F7F9`, white surfaces, near-navy ink `#0E1726`, slate muted `#64748B`, hairline `#E2E6EC`, electric-indigo interactive accent `#5B4BFF` (kept distinct from all status/priority hues, used only for actions, active states and focus).
- **Type:** Space Grotesk (display/headings), IBM Plex Sans (body/UI, chosen for table legibility and a technical register), JetBrains Mono (IDs, code, export).
- **Motion:** modal fade+scale, row hover, filter-chip transitions, copy-success state — all gated behind `prefers-reduced-motion`.

### 15.2 Screen inventory

1. **Issues (default).** Top bar (wordmark, primary nav, user dropdown). Left filter rail (app → module → page/form, status, priority, type, reporter/assignee, tags, date range). Toolbar (search, sort, *New Issue*, *Export*). Dense table with status rail, mono ID, title, app/module chips, priority pip meter, reporter/assignee avatars, attachment count, updated-at, row actions. Filter-summary chip row + result count.
2. **New Issue modal.** Two-column layout: left = context (dependent App→Module→Page→Form selects, type, priority, status, assignee, tags); right = title, Markdown description, attachment dropzone with thumbnails. Primary *Create issue*, secondary *Cancel*. Inline validation.
3. **Edit Issue modal.** Same layout pre-filled; adds the activity/comment log and add/remove attachments.
4. **Issue detail drawer.** Right-hand slide-over: full description (rendered Markdown), attachment gallery (image lightbox, PDF open), context table, activity timeline, quick status/priority/assignee controls, and a per-issue *Copy for Claude Code*.
5. **Board.** Three status columns (Open / Implemented / Complete) with priority-sorted cards; drag a card to change status.
6. **Export panel.** Dark terminal surface. JSON ⇄ Markdown segmented toggle, filename header (`fix-batch-charcoal-erp.md`), live preview, big **Copy for Claude Code**, **Download**, and an issue count.
7. **Dashboard (optional).** Stat cards (open by status, by priority, per app), recent activity, "oldest open critical" call-outs.
8. **Admin / Config.** Editors for users, applications, modules, pages, forms — writing back to the config files (with a clear "these edits change your config files" note).

### 15.3 Components (Svelte 5)

`TopBar`, `UserSwitcher`, `FilterRail`, `FilterChips`, `IssueTable`, `IssueRow`, `PriorityMeter`, `StatusDot`, `AppChip`, `Avatar`, `Modal` (focus-trapped dialog host), `IssueForm`, `AttachmentDropzone`, `AttachmentThumb`, `IssueDetailDrawer`, `ActivityTimeline`, `BoardColumn`, `BoardCard`, `ExportPanel`, `Toast`. State is local `$state`/`$derived`; cross-cutting bits (current user, toast queue, open-modal) sit in a couple of tiny runes-based context modules rather than a store library.

---

## 16. Validation & error handling

- **One Zod schema per entity** (`issueSchema`, `userSchema`, `applicationSchema`, `attachmentSchema`) used in three places: parsing form actions, validating uploads, and validating files on load. A single source of truth for shape.
- **Form actions** return `fail(400, { fieldErrors })` on invalid input; the modal renders inline errors next to fields and keeps the user's entries.
- **Load-time resilience:** a file that fails validation is logged with its path and skipped, so one corrupt module file cannot take down the whole app (NFR-6).
- **Upload errors** (too large, wrong type, too many) return structured messages the dropzone shows inline.
- **Interface voice** per the writing guidance: errors state what happened and how to fix it — "That file is 22 MB. The limit is 15 MB." — never a vague apology.

---

## 17. Concurrency, integrity & backups

- **Per-file async mutex.** Every write to a given JSON file goes through a keyed lock (`Map<filePath, Promise>` chain). Concurrent writes to the *same* file serialise; writes to *different* files proceed in parallel.
- **App-level lock for numbering.** Allocating a sequence number + writing the issue is done under a lock keyed on the app, guaranteeing unique, gap-tolerant IDs even under simultaneous creates.
- **Atomic file writes.** Write to `file.json.tmp` then `rename` over `file.json` (rename is atomic on the same filesystem) so a crash mid-write never leaves a half-written file.
- **Stable serialisation.** Issues sorted by `seq`, keys in a fixed order, 2-space indent — so git diffs show only real changes.
- **Backups.** Because `/data` is self-contained: (a) commit it to a private git repo for full history and trivial rollback; and/or (b) a scheduled `tar`/rsync snapshot. A restore is just replacing `/data` and restarting.

---

## 18. Security posture (no auth)

IssueDesk is designed for a trusted network (LAN / VPN / internal host). The no-auth decision is explicit; the following keep it safe within that boundary:

- **Deploy behind a network boundary** — bind to a private interface, put it behind the company VPN or an authenticating reverse proxy (nginx basic-auth / SSO proxy) if any exposure is possible. Auth, if ever wanted, is added at the proxy, leaving the app unchanged.
- **The "current user" is an attribution label, not a credential.** It sets reporter/assignee and stamps activity; it grants nothing.
- **Upload hardening regardless of auth:** strict MIME allow-list + magic-byte sniff, size/count caps, filename sanitisation, and serving from a path strictly confined under `DATA_DIR/uploads` with traversal rejection. Files are served with `Content-Disposition` sensible defaults; consider `X-Content-Type-Options: nosniff`.
- **Public attachment URLs are unguessable-ish but not secret** (they contain the issue ID). Treat them as public within the trusted network. If confidentiality is needed later, add signed URLs or gate `/api/files` behind the proxy.
- **Input is untrusted even without auth:** Zod-validate everything; render user Markdown through `marked` + DOMPurify to prevent stored XSS in the detail view.

---

## 19. Project structure

```
issuedesk/
├── data/                         # runtime data (git-ignored or committed as backup)
│   ├── config/ · issues/ · uploads/
├── src/
│   ├── lib/
│   │   ├── types.ts              # shared types + enums (§8)
│   │   ├── schemas.ts            # Zod schemas (§16)
│   │   ├── priority.ts           # ordering, labels, pip counts
│   │   ├── status.ts             # labels, colours, order
│   │   ├── components/           # all Svelte 5 components (§15.3)
│   │   ├── stores/               # runes-based UI context (currentUser, toasts, modal)
│   │   └── server/               # server-only (never shipped to client)
│   │       ├── store/
│   │       │   ├── index.ts      # IssueStore singleton (§10)
│   │       │   ├── indexes.ts    # secondary indexes + intersection
│   │       │   └── mutex.ts      # per-file / per-app locks (§17)
│   │       ├── fs/
│   │       │   ├── paths.ts      # DATA_DIR resolution, path helpers
│   │       │   ├── read.ts       # load + validate config/issues on boot
│   │       │   └── write.ts      # atomic tmp+rename writers
│   │       ├── uploads.ts        # save/move/validate attachments (§12)
│   │       └── export/
│   │           ├── toMarkdown.ts # (§14.2)
│   │           └── toJson.ts     # (§14.1)
│   ├── routes/                   # (§11)
│   ├── app.html
│   └── app.css                   # design tokens (§15.1)
├── static/                       # logo, favicon — build-time assets only
├── tests/                        # vitest + playwright
├── svelte.config.js              # adapter-node
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 20. Request lifecycle walkthroughs

**Create an issue (Flow A).**
1. Client opens the New Issue modal; dependent selects populate from `+layout` data (applications tree).
2. User attaches files → `POST /api/uploads` (issueId = `pending`) → files land in `_pending/<draftId>` → returns `Attachment[]`.
3. User submits → `?/createIssue` form action with fields + attachment records.
4. Action → `store.create()`: under the app lock, read `_sequence.json`, take `next=14` → ID `CHR-14`, increment/write sequence, move `_pending/<draftId>/*` → `uploads/charcoal-erp/CHR-14/*`, build the `Issue`, insert into memory + indexes, write `auth.json` atomically.
5. Action returns the new issue; `use:enhance` closes the modal, prepends the row, toasts "Created CHR-14".

**Serve an attachment (FR-13).** `GET /api/files/charcoal-erp/CHR-14/01-login-screen.png` → normalise + confine under `DATA_DIR/uploads` → 404 if escaping/missing → set content-type + cache headers → stream.

**Export (Flow C).** Table filter = `{appId, status:[open], priority:[critical,very_high,high]}` lives in the URL. *Export* opens the panel → panel fetches `GET /api/export?format=md&…same params`. Endpoint runs `store.list(filter)` (memory), pipes rows through `toMarkdown`, absolutises attachment URLs using `PUBLIC_BASE_URL`, returns `text/markdown`. Panel shows preview; **Copy for Claude Code** writes to clipboard.

---

## 21. Configuration & environment

| Var | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | Root of all config/issues/uploads |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Host used to absolutise attachment URLs in exports |
| `MAX_UPLOAD_MB` | `15` | Per-file size cap |
| `MAX_ATTACHMENTS` | `10` | Per-issue attachment cap |
| `WATCH_FILES` | `false` | Enable chokidar re-sync of externally edited files |
| `PORT` | `3000` | adapter-node port |

First-run bootstrap: if `DATA_DIR` is empty, seed `config/users.json` (one "System" user), an empty `applications.json`, and the directory skeleton, so the app is usable immediately and the operator fills reference data via Admin.

---

## 22. Testing strategy

- **Unit (Vitest):** store filtering/intersection correctness, sequence allocation under simulated concurrency, atomic-write behaviour, `toMarkdown`/`toJson` output snapshots, Zod schema edge cases, upload validation/sanitisation.
- **Component:** dependent dropdown logic, priority meter rendering per level, modal focus-trap, filter → URL round-trip.
- **E2E (Playwright):** full create-with-attachment flow, filter → export → clipboard contents, status change reflected in table + board, admin edit persisted to config file.
- **Fixture dataset:** a seeded `/data` with the sample apps (Charcoal, Amrutm, Drishti, …) used by e2e and for local demos.

---

## 23. Future enhancements

- Optional auth at the reverse proxy or a pluggable SSO front.
- Full-text search upgrade (MiniSearch/lunr) if the linear scan ever bites.
- Saved filters / named views; per-user default view.
- Bulk actions (multi-select rows → change status / export subset).
- Webhook or Slack notification on new critical issues.
- CLI companion (`issuedesk export --app charcoal --status open`) reusing the pure export generators.
- Signed attachment URLs for confidential deployments.
- Multi-instance mode (shared sequence + cache invalidation) — only if scale demands it.

---

## Appendix A — example data files

**`data/config/users.json`**
```json
[
  { "id": "kiran",  "name": "Kiran Kharade", "role": "Architect",   "avatarColor": "#5B4BFF" },
  { "id": "priya",  "name": "Priya Nair",    "role": "QA Lead",     "avatarColor": "#30A46C" },
  { "id": "arjun",  "name": "Arjun Mehta",   "role": "Dev-tester",  "avatarColor": "#F5A623" },
  { "id": "sara",   "name": "Sara Khan",     "role": "Stakeholder", "avatarColor": "#E5484D" }
]
```

**`data/config/applications.json`** (abbreviated)
```json
[
  {
    "id": "charcoal-erp", "code": "CHR", "name": "Charcoal ERP", "color": "#5B4BFF",
    "modules": [
      { "id": "auth", "code": "AUTH", "name": "Auth",
        "pages": [
          { "id": "login", "name": "Login", "path": "/login",
            "forms": [ { "id": "otp", "name": "OTP Verification" },
                       { "id": "password", "name": "Password Sign-in" } ] }
        ] },
      { "id": "billing", "code": "BILL", "name": "Billing", "pages": [] }
    ]
  },
  { "id": "amrutm", "code": "AMR", "name": "Amrutm", "color": "#30A46C", "modules": [ /* OPD, IPD, Pharmacy… */ ] }
]
```

**`data/issues/charcoal-erp/_sequence.json`**
```json
{ "code": "CHR", "next": 15 }
```

**`data/issues/charcoal-erp/auth.json`** (one issue)
```json
[
  {
    "id": "CHR-14", "uuid": "018f...7b2a", "seq": 14,
    "type": "bug",
    "title": "Login fails with a valid OTP",
    "description": "Entering the correct 6-digit OTP returns 'Invalid code'. Reproduces on Chrome + Edge...",
    "appId": "charcoal-erp", "appCode": "CHR", "appName": "Charcoal ERP",
    "moduleId": "auth", "moduleCode": "AUTH", "moduleName": "Auth",
    "pageId": "login", "pageName": "Login", "pagePath": "/login",
    "formId": "otp", "formName": "OTP Verification",
    "priority": "critical", "status": "open",
    "reporterId": "priya", "assigneeId": "kiran", "tags": ["auth", "regression"],
    "attachments": [
      { "id": "018f...aa10", "filename": "01-login-screen.png", "originalName": "Screenshot.png",
        "mime": "image/png", "kind": "image", "size": 184320,
        "url": "/api/files/charcoal-erp/CHR-14/01-login-screen.png",
        "uploadedBy": "priya", "uploadedAt": "2026-07-16T14:03:00+05:30" }
    ],
    "activity": [
      { "id": "018f...c0", "at": "2026-07-16T14:03:00+05:30", "by": "priya", "kind": "created" }
    ],
    "createdAt": "2026-07-16T14:03:00+05:30",
    "updatedAt": "2026-07-16T14:03:00+05:30"
  }
]
```

---

## Appendix B — example Markdown export

````markdown
# Fix batch — Charcoal ERP (2 issues)
_Exported from IssueDesk on 2026-07-17 09:20 IST. Filter: App = Charcoal ERP · Status = Open · Priority ≥ High._

You are fixing reported issues in **Charcoal ERP**. Address each issue below.
For every fix, reference the issue ID in your commit message.

---

## CHR-14 · [CRITICAL] Login fails with a valid OTP

| | |
|---|---|
| **App / Module** | Charcoal ERP / Auth |
| **Page / Form**  | /login · OTP Verification |
| **Type**         | Bug |
| **Status**       | Open |
| **Reporter**     | Priya Nair |

**Description**
Entering the correct 6-digit OTP returns "Invalid code". Reproduces on Chrome and Edge.
The network call to `POST /auth/verify-otp` returns 200 but the client treats it as failure.

**Attachments**
- https://issuedesk.internal/api/files/charcoal-erp/CHR-14/01-login-screen.png
- https://issuedesk.internal/api/files/charcoal-erp/CHR-14/02-network-trace.pdf

---

## CHR-11 · [HIGH] Invoice total ignores line-item discounts

| | |
|---|---|
| **App / Module** | Charcoal ERP / Billing |
| **Page / Form**  | /billing/invoice · Invoice Editor |
| **Type**         | Bug |
| **Status**       | Open |
| **Reporter**     | Arjun Mehta |

**Description**
When a per-line discount is applied, the invoice grand total still uses the pre-discount
subtotal. Tax is then computed on the wrong base.

**Attachments**
- https://issuedesk.internal/api/files/charcoal-erp/CHR-11/01-invoice.png
````

---

*End of design document.*
