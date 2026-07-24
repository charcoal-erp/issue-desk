# Platform Quality — IssueDesk + Checkpoint

Two **entirely separate, independently-deployable** applications for platform quality
management. They share no code. They live in one repository for convenience, but each has its
own `package.json`, dependencies, build and deploy, and either runs with the other absent.

| App | Folder | What it is | Runs |
|---|---|---|---|
| **IssueDesk** | [`issue-desk/`](issue-desk/) | The central bug & feature tracker — one source of truth for all issues, with export straight into a Claude Code session. | One shared instance for everyone. |
| **Checkpoint** | [`check-point/`](check-point/) | Test management — author test cases, group them into suites, run manual or automated runs, and turn failures into a Claude Code prompt. | Per test machine / developer / environment, pointed at a git-versioned content repo. |

## Why two apps

IssueDesk is a **central source of truth**: one instance, reached by everyone, holding the
canonical list of issues. Checkpoint is **distributed**: it runs on many test machines, for
many developers, across many environments, against whatever content repo that box is testing.
Governing both from one process and one deploy fought both roles — a Checkpoint on a test box
should not depend on the tracker being in the same process, and updating one should not force a
redeploy of the other. So they are two apps.

## The optional link between them

Their one relationship — filing a bug from a failure, and resolving issue links — is an
**optional HTTP integration**, never an in-process call:

- Set `ISSUEDESK_URL` in Checkpoint and its "file a bug" button POSTs to IssueDesk's
  `/api/issues`, issue references resolve to real titles, and the parent-issue picker is
  populated. Leave it unset and Checkpoint is fully standalone — those affordances hide and
  failures still export as a Claude Code prompt.
- Optionally set `CHECKPOINT_URL` in IssueDesk to link an issue filed from a test back to its
  case in Checkpoint, and `ISSUEDESK_INGEST_TOKEN` to require a bearer token on issue creation.

## Running each

```bash
# IssueDesk — the tracker
cd issue-desk && npm install && npm run dev     # http://localhost:5173  (DATA_DIR=../data)

# Checkpoint — test management (separate terminal)
cd check-point && npm install && npm run dev    # http://localhost:5174
```

Each app's own `README.md` and `DEPLOYMENT.md` cover it in full. The live issue dataset lives
at [`data/`](data/) in the repo root, shared with nothing; IssueDesk points at it via
`DATA_DIR`.
