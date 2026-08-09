# IssueDesk API

The HTTP interface for reading and changing issues and feature requests without going through the
browser. It is the same interface whether you are a person with `curl`, a script, or an AI agent
working a queue — one login, one token, one set of endpoints.

- **Base URL** — wherever IssueDesk is running (`http://localhost:5173` in dev). Set
  `PUBLIC_BASE_URL` in production so the `url` fields in responses are correct.
- **Format** — JSON in, JSON out, UTF-8. Errors always carry a `message`.
- **Auth** — a bearer token on every request. There are exactly two exceptions, both named below.

> **Terminology.** An *issue* and a *feature request* are the same record with a different `type`
> (`bug` | `feature`). Everything here applies to both; filter on `type` when you want one.

**Contents** — [Authentication](#1-authentication) · [Vocabulary](#2-vocabulary) ·
[Reading](#3-reading-issues) · [Creating](#4-creating-an-issue-or-feature) ·
[Modifying](#5-modifying-an-issue) · [Attachments](#6-attachments) ·
[Bulk export](#7-bulk-export) · [Errors](#8-errors) · [Reference](#9-reference) ·
[Recipes](#10-recipes)

---

## 1. Authentication

Every route requires a token. The two exceptions:

- `POST /api/auth/login` — how you get one.
- `POST /api/issues` when `ISSUEDESK_INGEST_TOKEN` is set — see [Checkpoint ingest](#checkpoint-ingest).

### Get a token

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "claude-agent", "password": "…" }
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "tokenType": "Bearer",
  "expiresAt": "2026-08-10T00:07:47.000Z",
  "expiresIn": 43200,
  "user": { "id": "kiran", "name": "Kiran Kharade", "username": "kiran",
            "kind": "human", "admin": true }
}
```

Send it on everything else:

```
Authorization: Bearer <token>
```

The same token is also set as an httpOnly session cookie, so signing in from a browser `fetch`
leaves a working session behind.

A wrong password and an unknown username return the same `401` — which of the two it was is not
something an unauthenticated caller gets to learn.

| Route | Purpose |
|---|---|
| `POST /api/auth/login` | username + password → token |
| `GET /api/auth/me` | Who this token belongs to. Cheap liveness check before a batch of work |
| `POST /api/auth/refresh` | Valid token → fresh token, so a long run never re-sends the password. An **expired** token cannot be refreshed — log in again |
| `POST /api/auth/logout` | Clears the session cookie. Bearer tokens are stateless; a script logs out by forgetting its token |

Tokens last 12 hours (`AUTH_TOKEN_TTL_HOURS`). Unauthenticated calls to `/api/*` get a `401` with a
`message` naming which of *absent / invalid / expired* applied — browsers get redirected to the
login form instead, so a `401` body is always machine-readable.

**Revocation.** Changing an account's password invalidates every token it has outstanding. That is
how you cut off a client immediately: **Config → Accounts → Password**.

### Accounts and what they may do

Give each automated client its own account (`kind: "agent"`) rather than borrowing a person's, so
activity is attributable and revocable on its own. A fresh data directory seeds one called
**claude-agent**; an admin sets its password under Config → Accounts (leave the field blank to
generate a strong one — it is shown once).

Agent accounts differ from human ones in exactly one way: **they cannot set an issue to `complete`
or `rejected`.** Everything else in this document is identical for both.

> The `/api/agent/*` routes are named for their purpose, not for a permission level. A human account
> may call every one of them, and does so with the full status range.

---

## 2. Vocabulary

```http
GET /api/agent/meta
```

Every value the filters accept: applications and their modules, categories, tags in use, the
status / priority / type / source enums, the `agentStatuses` subset, and the users you can assign to.

Fetch it once at the start of a session instead of guessing slugs — ids like `charcoal` or
`org-hub` are per-installation.

```json
{
  "applications": [{ "id": "charcoal", "code": "CHR", "name": "Charcoal",
                     "modules": [{ "id": "org-hub", "code": "ORGH", "name": "Organization Hub" }] }],
  "categories":   [{ "id": "security", "name": "Security", "description": "…", "color": "#…" }],
  "tags":         ["auth", "regression"],
  "types":        ["bug", "feature"],
  "priorities":   ["critical", "very_high", "high", "medium", "low"],
  "statuses":     ["backlog", "open", "in-progress", "to-be-verified", "complete", "rejected"],
  "sources":      ["manual-testing", "checkpoint-triggered", "agent-testing"],
  "agentStatuses":["open", "in-progress", "to-be-verified"],
  "users":        [{ "id": "kiran", "name": "Kiran Kharade", "kind": "human", "assignable": true }]
}
```

---

## 3. Reading issues

### The main list

```http
GET /api/agent/issues?category=security&type=bug&priority=critical,very_high
```

All parameters are optional and combinable.

| Parameter | Meaning |
|---|---|
| `q=<text>` | Free text over id, title, description, module name and tags |
| `type=bug\|feature` | Bugs or feature requests |
| `app=<id>` · `module=<id>` | Where it lives. `appId` / `moduleId` also accepted |
| `category=<id>` | What it is *about*. `categoryId` also accepted |
| `tag=<slug>` | Free-form tag. Independent of `category`; both compose |
| `assignee=<userId>` · `reporter=<userId>` | Who holds it / who filed it |
| `status=<s>` | Repeatable **or** comma-separated. **Defaults to `open,in-progress`**; `status=all` drops the constraint |
| `priority=<p>` | Repeatable or comma-separated |
| `source=<s>` | `manual-testing` \| `checkpoint-triggered` \| `agent-testing`. Repeatable or comma-separated |
| `sort=` · `dir=` | `id`, `title`, `priority`, `status`, `updated`, `created`. Defaults to most-urgent-first |
| `page=` · `pageSize=` | Default page 1, size 50, **maximum 200** |

```json
{
  "issues": [
    { "id": "CHR-1", "type": "bug", "title": "Tax computed on discounted subtotal",
      "status": "open", "priority": "critical", "source": "manual-testing",
      "app":      { "id": "charcoal", "code": "CHR", "name": "Charcoal" },
      "module":   { "id": "accounting", "code": "ACCT", "name": "Accounting" },
      "category": { "id": "security", "name": "Security" },
      "tags": ["auth"],
      "assignee": null,
      "reporter": { "id": "kiran", "name": "Kiran Kharade" },
      "createdAt": "…", "updatedAt": "…",
      "url": "https://issuedesk.example.com/issues/CHR-1" }
  ],
  "page": 1, "pageSize": 50, "total": 1, "totalPages": 1, "hasMore": false,
  "filter": { "category": "security", "tag": null, "…": "…" }
}
```

Three things worth knowing:

- **The default status filter is the point.** Ask for work and you get things that still need
  doing, without having to remember to exclude finished issues.
- **`backlog` is excluded by that default, deliberately.** Parking an issue is how a person says
  "not now". Ask for `status=backlog` explicitly to read the parked set.
- **`module` is nullable.** An issue can be filed before anyone knows which module owns it. Treat
  `null` as "not attributed yet", not as an error.

### One issue, in full

```http
GET /api/agent/issues/CHR-1
```

Everything needed to start work: `description`, `page` / `form` context, attachments as absolute
URLs, `comments`, status `history` — plus a `markdown` field carrying the same brief the UI's
**Copy for Claude Code** button produces:

```json
{ "issue": { "…": "…",
    "markdown": "## CHR-1 · [CRITICAL] Tax computed on discounted subtotal\n\n…" } }
```

If you are an agent, that field is your working brief — paste it into context and start.

### Two lightweight lookups

These exist for Checkpoint's parent-issue picker and are narrower on purpose:

| Route | Returns |
|---|---|
| `GET /api/issues[?app=<id>]` | **Open issues only**, as `{ id, title, appId, status }`. Not a general list — use `/api/agent/issues` for that |
| `GET /api/issues/<id>` | `{ id, title, status, appId }`, or `404` |

---

## 4. Creating an issue or feature

```http
POST /api/issues
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "bug",
  "title": "Login fails with a valid OTP",
  "description": "Steps:\n1. Go to /login\n2. Enter a valid OTP\n3. …",
  "appId": "charcoal",
  "moduleId": "org-hub",
  "priority": "high",
  "status": "open",
  "page": "/login",
  "tags": ["auth", "regression"]
}
```

→ `201` with the complete stored record, including its assigned id:

```json
{ "issue": { "id": "CHR-42", "seq": 42, "uuid": "019fe6…", "source": "manual-testing", "…": "…" } }
```

| Field | Required | Notes |
|---|---|---|
| `type` | ✅ | `bug` \| `feature` |
| `title` | ✅ | 1–200 characters |
| `appId` | ✅ | From `/api/agent/meta` |
| `priority` | ✅ | `critical` \| `very_high` \| `high` \| `medium` \| `low` |
| `status` | ✅ | Usually `open`, or `backlog` to file it parked |
| `description` | — | Markdown. Defaults to `""` |
| `moduleId` | — | Omit when nobody knows yet — better than a wrong guess |
| `page` · `form` | — | Free text, ≤200 chars each: where in the app it happened |
| `assigneeId` · `categoryId` | — | Must exist, or `400` |
| `tags` | — | Array of strings, defaults to `[]` |
| `attachments` | — | Array of Attachment objects from [`POST /api/uploads`](#6-attachments) |
| `testCaseId` · `runId` | — | Provenance from an automated run |
| `reporterId` | — | Defaults to the signed-in caller. An ingest-token caller has no session and **must** name one |
| `draftId` | — | Claims pre-create uploads staged under that draft |

**The id is assigned by the server** — `<APP-CODE>-<n>`, counted per application. Do not send one.

**`source` is derived server-side from the calling account** (`human` → `manual-testing`,
`agent` → `agent-testing`, ingest token → `checkpoint-triggered`) and cannot be set from the body.
An issue's origin is therefore trustworthy.

---

## 5. Modifying an issue

### Claim it

```http
POST /api/agent/issues/CHR-1/claim
{ "comment": "Picking this up." }          // optional
```

Assigns the issue to you and moves it to `in-progress`. Returns the full detail object.

- `409` `reason: "taken"` — someone else holds it.
- `409` `reason: "not-claimable"` — already verified or closed.
- Re-claiming something you already hold succeeds, so retries are safe.

### Comment on it

```http
POST /api/agent/issues/CHR-1/comment
{ "message": "Root cause: rounding applied before the discount in tax.ts:88." }
```

1–5000 characters, attributed to your account.

### Change its status

```http
POST /api/agent/issues/CHR-1/status
{ "status": "to-be-verified", "comment": "Fixed in a1b2c3d; added a regression test." }
```

The optional `comment` is recorded *before* the transition, so the note and the status change read
in order on the timeline.

| Status | Who may set it |
|---|---|
| `backlog`, `open`, `in-progress`, `to-be-verified` | anyone |
| `complete`, `rejected` | **humans only** — an agent gets `403` |

```json
{ "message": "Agents cannot set \"complete\" — verification is a tester's call. Set \"to-be-verified\" when the fix is ready for review.",
  "agentStatuses": ["open", "in-progress", "to-be-verified"] }
```

An agent's terminal state is `to-be-verified`. Nothing an agent does closes an issue.

### Work through a queue

```http
POST /api/agent/next?category=security
```

Takes the most urgent unclaimed issue matching the filter (oldest first within a priority), assigns
it to you, moves it to `in-progress`, and returns it in full.

- **`204 No Content` when nothing is left** — that is the loop's stop condition.
- Two clients calling at once never get the same issue; the loser is handed the next one down.
- `GET /api/agent/next?…` peeks at the same candidate **without** claiming, and reports `remaining`.
- It accepts the same filters as the list, with one clamp: only `open` and `in-progress` work can
  be handed out, so any other `status` value is ignored here.

### Editing other fields

There is **no REST endpoint** for changing a title, description, priority, assignee, category or
tags. Those go through the SvelteKit form actions the UI itself uses. They are authenticated the
same way — a bearer token works — and take form-encoded fields with an `x-sveltekit-action: true`
header:

```bash
curl -X POST "$BASE/issues?/changePriority" \
  -H "authorization: Bearer $TOKEN" -H 'x-sveltekit-action: true' \
  -F id=CHR-1 -F priority=critical
```

| Action | Fields |
|---|---|
| `POST /issues?/changeStatus` | `id`, `status` |
| `POST /issues?/changePriority` | `id`, `priority` |
| `POST /issues?/changeAssignee` | `id`, `assigneeId` (empty string unassigns) |
| `POST /issues?/comment` | `id`, `message` |
| `POST /issues?/updateIssue` | `id` **+ the complete record** — see below |
| `POST /issues?/deleteIssue` | `id` |
| `POST /issues?/createIssue` | Same fields as `POST /api/issues`, form-encoded |

Two caveats, both worth reading before you script against these:

1. **`updateIssue` takes the whole record, not a patch.** It rebuilds the issue from the fields
   posted, exactly as the edit dialog sends them. A partial post is rejected rather than applied —
   `{"type":"failure","status":400,"data":"…Application is required…"}` — so nothing is silently
   wiped, but you must send every field you want to keep: `type`, `title`, `description`, `appId`,
   `moduleId`, `page`, `form`, `priority`, `status`, `assigneeId`, `categoryId`, `tags`,
   `attachments`. Read the issue first, merge your change, post the result.
2. **The response is a SvelteKit `ActionResult`,** not a plain object — `{"type":"success",
   "status":200,"data":"<devalue-encoded>"}`. Check `type` for `success` / `failure` and read the
   issue back from `/api/agent/issues/<id>` rather than trying to decode `data`.

These actions are the app's own internal interface and may change with the UI. For anything you
intend to keep running, prefer the `/api/*` endpoints above.

---

## 6. Attachments

### Upload

```http
POST /api/uploads
Content-Type: multipart/form-data

appId=charcoal
issueId=CHR-1              # or "pending" for a not-yet-created issue
draftId=<uuid>             # required when issueId=pending; pass the same value to POST /api/issues
files=@screenshot.png      # repeatable
```

```json
{ "attachments": [
  { "id": "019fe66f-…", "filename": "01-screenshot.png", "originalName": "screenshot.png",
    "mime": "image/png", "kind": "image", "size": 20480,
    "url": "/api/files/charcoal/_pending/<draftId>/01-screenshot.png",
    "uploadedBy": "kiran", "uploadedAt": "2026-08-09T12:11:04.375Z" } ] }
```

Pass that array straight into the `attachments` field of `POST /api/issues`, along with the same
`draftId`. Files staged under `_pending/<draftId>` are moved into the new issue's folder on create,
and the stored `url` becomes `/api/files/<app>/<issueId>/<filename>`.

- **Accepted:** PNG, JPEG, WebP, GIF, PDF, HTML, ZIP, DOC, DOCX. Content is sniffed, not trusted
  from the extension.
- **Limits:** 15 MB per file (`MAX_UPLOAD_MB`), 10 attachments per issue (`MAX_ATTACHMENTS`).
- `issueId=pending` **requires** a `draftId`, or the upload is refused with
  `400 Missing draftId for a pending upload.`

### Download

`GET /api/files/<app>/<issueId>/<filename>` — authenticated like everything else, supports Range
requests for large PDFs. On `GET /api/agent/issues/<id>` the attachments come back as
`{ filename, mime, kind, url }` with the `url` already absolute, so an agent can fetch a screenshot
without reassembling anything.

---

## 7. Bulk export

```http
GET /api/export?format=md|json&<filter>
```

The whole filtered set (never a pagination window) as either a Markdown fix-batch brief — the same
document the UI's Export panel produces — or JSON.

> **Different parameter spelling.** This endpoint takes the *UI's* filter params, not the agent
> API's short ones: `appId`, `moduleId`, `categoryId`, `assigneeId`, `reporterId`, `tag`, `type`,
> `q`, repeatable `status` / `priority` / `source`, `updatedFrom`, `updatedTo`, `sort`, `dir`.
> A filter copied out of the browser's address bar works as-is.

```bash
curl -H "authorization: Bearer $TOKEN" \
  "$BASE/api/export?format=json&status=open&priority=critical" > critical.json
```

### Whole-instance snapshot

| Route | Purpose |
|---|---|
| `GET /api/data/export` | Zip of config + issues + uploads with a manifest. `curl -o issuedesk-data.zip` |
| `POST /api/data/import` | Restore one. Multipart field `file`, or a raw zip body. **Replaces** config/issues/uploads; the previous state is kept in `.backups/pre-import-<stamp>/` |

Credentials are never included in a data export.

---

## 8. Errors

Every error is JSON with a `message`.

| Code | When |
|---|---|
| `400` | Malformed body, or a value outside the accepted set. Validation failures on `POST /api/issues` also carry `issues[]` with the offending paths |
| `401` | Missing, invalid, expired or revoked token |
| `403` | Authenticated but not allowed — an agent setting `complete` or `rejected` |
| `404` | Unknown issue id |
| `409` | Claim conflict — `reason` is `taken` or `not-claimable` |
| `502` | An AI helper's upstream model call failed |

`204` on `POST /api/agent/next` is not an error: it means the queue is empty.

---

## 9. Reference

### Status

| Status | Meaning |
|---|---|
| `backlog` | Parked for later — outside every default queue |
| `open` | Filed, nobody working on it |
| `in-progress` | Being worked on (set automatically on claim) |
| `to-be-verified` | Fix landed, awaiting a tester — **an agent's terminal state** |
| `complete` | Verified. Humans only |
| `rejected` | Won't implement. Humans only |

### Priority

`critical` · `very_high` · `high` · `medium` · `low` — that is also the sort order when
`sort=priority`.

### Source

Derived from the account that filed the issue, never from the request body.

| Source | Origin |
|---|---|
| `manual-testing` | A person |
| `checkpoint-triggered` | An automated Checkpoint run (ingest token) |
| `agent-testing` | An agent account |

### AI helpers

Suggestion endpoints — neither writes anything, so a rejected suggestion costs only the call.
Both need a provider key configured under Config → API keys.

| Route | Body → response |
|---|---|
| `POST /api/ai/refine` | `{ description, mode, instruction? }` → `{ refined, model }`. `mode` is one of `clarify`, `itemize`, `repro`, `structure`, `concise`, `strengthen`, `custom` |
| `POST /api/ai/extract-tags` | `{ title, description }` → `{ tags: [{ slug, label }], model }` |

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Absolute URLs in API responses and exports |
| `AUTH_JWT_SECRET` | *(generated)* | Token signing secret, persisted to `data/auth/jwt-secret.json`. **Set it explicitly across multiple instances**, or they reject each other's tokens |
| `AUTH_TOKEN_TTL_HOURS` | `12` | Token lifetime |
| `ISSUEDESK_ADMIN_PASSWORD` | *(generated)* | First-boot admin password; otherwise printed to the log once |
| `MAX_UPLOAD_MB` | `15` | Per-file upload limit |
| `MAX_ATTACHMENTS` | `10` | Attachments per issue |
| `ISSUEDESK_INGEST_TOKEN` | *(unset)* | See below |

### Checkpoint ingest

When `ISSUEDESK_INGEST_TOKEN` is set, `POST /api/issues` also accepts it as a bearer token in place
of a login, so an existing Checkpoint deployment keeps filing bugs without a JWT. Issues arriving
that way are marked `checkpoint-triggered` and must name a `reporterId`. With the variable unset
there is no exemption and that route needs a token like every other.

---

## 10. Recipes

### An agent working a queue

```bash
BASE=https://issuedesk.example.com

TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"claude-agent","password":"'"$ISSUEDESK_AGENT_PASSWORD"'"}' \
  | jq -r .token)

while :; do
  ISSUE=$(curl -s -X POST "$BASE/api/agent/next?category=security" \
    -H "authorization: Bearer $TOKEN")
  [ -z "$ISSUE" ] && break                  # 204: queue drained

  ID=$(echo "$ISSUE" | jq -r .issue.id)
  echo "$ISSUE" | jq -r .issue.markdown     # ← the brief to work from

  # … make the fix …

  curl -s -X POST "$BASE/api/agent/issues/$ID/status" \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"status":"to-be-verified","comment":"Fixed; see commit a1b2c3d."}' > /dev/null
done
```

### Filing a bug from a script

```bash
curl -s -X POST $BASE/api/issues \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"type":"bug","title":"Checkout total ignores the discount",
       "description":"Repro:\n1. Add two items\n2. Apply SAVE10\n3. Total is wrong",
       "appId":"charcoal","moduleId":"accounting",
       "priority":"critical","status":"open","tags":["billing"]}' | jq .issue.id
```

### Pulling this week's critical bugs

```bash
curl -s -H "authorization: Bearer $TOKEN" \
  "$BASE/api/agent/issues?priority=critical&type=bug&status=all&sort=updated" \
  | jq -r '.issues[] | "\(.id)\t\(.status)\t\(.title)"'
```

### Reading a whole feature backlog

```bash
curl -s -H "authorization: Bearer $TOKEN" \
  "$BASE/api/agent/issues?type=feature&status=backlog&pageSize=200" | jq '.total, .issues[].title'
```

---

## See also

- **[docs/AGENT-API.md](docs/AGENT-API.md)** — the same agent endpoints told as a narrative, with
  the reasoning behind the loop.
- **[README.md](README.md)** — what IssueDesk is and how to run it.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — production configuration, backups and data layout.
