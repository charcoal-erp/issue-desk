# IssueDesk Agent API

The HTTP interface a Claude Code session (or any other automated client) uses to pull issues out
of IssueDesk and work through them one at a time — replacing the manual **Copy for Claude Code**
round-trip.

The shape of it is deliberately small:

```
login → list a category → claim one → read it → fix it → mark to-be-verified → next
```

Nothing an agent does closes an issue. When a fix is ready the agent sets **to-be-verified** and a
human tester takes it from there.

---

## 1. Authentication

Every route in IssueDesk requires authentication — the UI through a session cookie, the API
through a JWT. Both carry the same token; there is one login path and one verifier.

### Getting a token

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "claude-agent", "password": "…" }
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "tokenType": "Bearer",
  "expiresAt": "2026-08-09T21:24:32.000Z",
  "expiresIn": 43200,
  "user": { "id": "claude-agent", "name": "Claude Agent", "username": "claude-agent",
            "kind": "agent", "admin": false }
}
```

Send it on every subsequent request:

```
Authorization: Bearer <token>
```

`401` is returned with a `message` explaining which of *absent / invalid / expired* applied. Tokens
last 12 hours by default (`AUTH_TOKEN_TTL_HOURS`).

| Route | Purpose |
|---|---|
| `POST /api/auth/login` | username + password → token. The only unauthenticated route. |
| `GET /api/auth/me` | Who the current token belongs to. Cheap token liveness check. |
| `POST /api/auth/refresh` | Valid token → fresh token, so a long run never re-sends the password. An **expired** token cannot be refreshed; log in again. |
| `POST /api/auth/logout` | Clears the session cookie. Bearer tokens are stateless — an agent logs out by discarding its token. |

**Revocation.** Changing an account's password invalidates every token it has outstanding. That is
the way to cut off an agent immediately (Config → Accounts → Password).

### Agent accounts

Agents get their own account (`kind: "agent"`) rather than borrowing a person's, so activity is
attributable. A fresh data directory seeds one named **claude-agent**; an admin gives it a password
under **Config → Accounts → Password** (leave the field blank to generate a strong one — it is
shown once).

Agent accounts differ from human ones in exactly one way: they cannot set an issue to `complete`
or `rejected`.

---

## 2. Discovering the vocabulary

```http
GET /api/agent/meta
```

Returns every value the filters accept — applications and their modules, categories, tags in use,
the status/priority/type/source enums, the `agentStatuses` subset, and assignable users. Fetch once
at the start of a session instead of guessing slugs.

---

## 3. Finding work

```http
GET /api/agent/issues?category=security&type=bug
```

| Parameter | Meaning |
|---|---|
| `category=<id>` | Category slug — what the issue is *about*. From `/api/agent/meta`. |
| `tag=<slug>` | Free-form tag. Independent of `category`; both may be given and they compose. |
| `type=bug\|feature` | Bugs or feature requests. |
| `app=<id>`, `module=<id>` | Where the issue lives. |
| `assignee=<userId>`, `reporter=<userId>` | Who holds or filed it. |
| `status=<s>` | Repeatable or comma-separated. **Defaults to `open,in-progress`.** `status=all` drops the constraint. |
| `priority=<p>` | Repeatable or comma-separated. |
| `source=<s>` | `manual-testing` \| `checkpoint-triggered` \| `agent-testing`. Repeatable or comma-separated. |
| `q=<text>` | Free text over id, title, description, module and tags. |
| `sort=`, `dir=` | Defaults to most-urgent-first. |
| `page=`, `pageSize=` | Default 50, maximum 200. |

```json
{
  "issues": [
    { "id": "CHR-1", "type": "bug", "title": "Tax computed on discounted subtotal",
      "status": "open", "priority": "critical", "source": "manual-testing",
      "app": { "id": "charcoal", "code": "CHR", "name": "Charcoal" },
      "module": { "id": "accounting", "code": "ACCT", "name": "Accounting" },
      "category": { "id": "security", "name": "Security" },
      "tags": ["auth"],
      "assignee": null,
      "reporter": { "id": "kiran", "name": "Kiran Kharade" },
      "createdAt": "…", "updatedAt": "…",
      "url": "http://localhost:5173/issues/CHR-1" }
  ],
  "page": 1, "pageSize": 50, "total": 1, "totalPages": 1, "hasMore": false,
  "filter": { "category": "security", "tag": null, "…": "…" }
}
```

The default status filter is the important detail: an agent asking for work gets things that still
need doing, without having to know to exclude completed issues.

**`module` is nullable.** An issue can be filed before anyone knows which module owns it, so treat a
`null` module as "not attributed yet" rather than an error.

**`source` says how the issue arrived** — `manual-testing` (a person), `checkpoint-triggered` (an
automated Checkpoint run) or `agent-testing` (an agent). It is derived on the server from the
account that filed it, so it cannot be spoofed by a request body. Issues an agent files under its
own token are automatically `agent-testing`.

**Backlog is excluded by default and deliberately so.** `backlog` is how a human parks an issue for
later; it is outside the default `open,in-progress` window, and `POST /api/agent/next` never hands
one out at all. Ask for `status=backlog` explicitly to read the parked set.

---

## 4. Working one issue at a time

### Claim the next one

```http
POST /api/agent/next?category=security
```

Takes the most urgent unclaimed issue matching the filter (oldest first within a priority),
assigns it to the caller, moves it to **in-progress**, and returns it in full.

- **`204 No Content`** when nothing is left — this is the loop's stop condition.
- Two agents calling at once never receive the same issue; the loser gets the next one down.
- `GET /api/agent/next?…` peeks at the same candidate **without** claiming it, and reports
  `remaining`.

### Or claim a specific issue

```http
POST /api/agent/issues/CHR-1/claim
{ "comment": "Picking this up." }        // optional
```

`409` with `reason: "taken"` if someone else holds it, or `reason: "not-claimable"` if it is
already verified or closed. Re-claiming an issue you already hold succeeds, so retries are safe.

### Read it

```http
GET /api/agent/issues/CHR-1
```

Everything needed to start: description, page/form context, attachments as absolute URLs,
comments, status history — plus:

```json
{ "issue": { "…": "…", "markdown": "## CHR-1 · [CRITICAL] Tax computed on discounted subtotal\n\n…" } }
```

`markdown` is the same brief the UI's *Copy for Claude Code* button produces. Paste it into the
working context and start; this field is what the manual copy-paste becomes.

### Report progress

```http
POST /api/agent/issues/CHR-1/comment
{ "message": "Root cause: rounding applied before the discount in tax.ts:88." }
```

### Hand it to a tester

```http
POST /api/agent/issues/CHR-1/status
{ "status": "to-be-verified", "comment": "Fixed in a1b2c3d; added a regression test." }
```

The comment is recorded before the transition, so the note and the status change read in order on
the timeline.

Agents may set `open`, `in-progress` and `to-be-verified`. Attempting `complete` or `rejected`
returns **403** — verification is the tester's call:

```json
{ "message": "Agents cannot set \"complete\" — verification is a tester's call. Set \"to-be-verified\" when the fix is ready for review.",
  "agentStatuses": ["open", "in-progress", "to-be-verified"] }
```

A human account calling the same endpoint keeps the full range.

---

## 5. The loop, end to end

```bash
BASE=http://localhost:5173

TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"claude-agent","password":"'"$ISSUEDESK_AGENT_PASSWORD"'"}' \
  | jq -r .token)

while :; do
  ISSUE=$(curl -s -X POST "$BASE/api/agent/next?category=security" \
    -H "authorization: Bearer $TOKEN")
  [ -z "$ISSUE" ] && break          # 204: queue drained

  ID=$(echo "$ISSUE" | jq -r .issue.id)
  echo "$ISSUE" | jq -r .issue.markdown   # ← the brief to work from

  # … make the fix …

  curl -s -X POST "$BASE/api/agent/issues/$ID/status" \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d '{"status":"to-be-verified","comment":"Fixed; see commit."}' > /dev/null
done
```

---

## 6. Status reference

| Status | Set by | Meaning |
|---|---|---|
| `backlog` | humans (agents may not park work) | Parked for later — outside every default queue |
| `open` | anyone | Filed, nobody working on it |
| `in-progress` | anyone (set automatically on claim) | Being worked on |
| `to-be-verified` | anyone — **an agent's terminal state** | Fix landed, awaiting a tester |
| `complete` | humans only | Verified |
| `rejected` | humans only | Won't implement |

## 7. Error responses

Every error is JSON with a `message`.

| Code | When |
|---|---|
| `400` | Malformed body, or a value outside the accepted set |
| `401` | Missing, invalid, expired or revoked token |
| `403` | Authenticated, but not allowed — e.g. an agent setting `complete` |
| `404` | Unknown issue id |
| `409` | Claim conflict (`reason`: `taken` \| `not-claimable`) |

## 8. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_JWT_SECRET` | _(generated)_ | Token signing secret. Unset = one is generated and persisted to `data/auth/jwt-secret.json`. **Set it explicitly when running more than one instance**, or the two will reject each other's tokens. |
| `AUTH_TOKEN_TTL_HOURS` | `12` | Token lifetime. |
| `ISSUEDESK_ADMIN_PASSWORD` | _(generated)_ | First-boot admin password. Unset = one is generated and printed to the server log **once**. |

Password digests (scrypt) live in `data/auth/credentials.json` at mode 0600, outside the directories
that `/api/data/export` collects — credentials are never part of a data export.

## 9. Note on the Checkpoint ingest path

`POST /api/issues` still accepts `ISSUEDESK_INGEST_TOKEN` as a bearer token when that variable is
set, so an existing Checkpoint deployment keeps filing bugs without a JWT. With the variable unset
there is no exemption and a token is required like everywhere else.
