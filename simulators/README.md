# IssueDesk test-data simulators

The app itself seeds **no issues** — only reference data (apps, modules, users).
These Python scripts populate an IssueDesk instance with realistic test issues
on demand, by POSTing to the app's JSON API. **For testing only.**

No third-party packages — standard library only (Python 3.9+).

## Usage

1. Start the app so its API is reachable:

   ```bash
   npm run dev          # http://localhost:5173
   # or: npm run build && node build   (PORT=3000)
   ```

2. Run a simulator from the repo root:

   ```bash
   python simulators/charcoal_simulator.py
   python simulators/drishti_simulator.py
   ```

### Options

| Flag | Default | Meaning |
|---|---|---|
| `--base-url URL` | `http://localhost:5173` | Where IssueDesk is running |
| `--count N` | 18 (Charcoal) / 12 (Drishti) | How many issues to create (templates cycle if N exceeds the pool) |
| `--seed N` | 42 | RNG seed, so runs are reproducible |
| `--attachments` | off | Attach a placeholder screenshot to ~half the issues |

Examples:

```bash
python simulators/charcoal_simulator.py --count 40 --attachments
python simulators/drishti_simulator.py --base-url http://localhost:3000
```

## How it works

Each script defines a pool of module-appropriate issue templates, then for each
issue picks a random reporter (any of the four users), a random assignee
(only the assignable users — Kiran or Tushar — or unassigned), a priority and a
status, and POSTs it to `POST /api/issues`. With `--attachments`, it first
stages a 1×1 PNG via `POST /api/uploads` (pending draft) and passes the returned
attachment records to the create call, which moves them into the issue's folder.

- `common.py` — shared HTTP client, CLI parsing, and the create/upload flow.
- `charcoal_simulator.py` — Charcoal ERP issues across all 14 modules.
- `drishti_simulator.py` — Drishti issues across its six portals.

To reset, stop the app, delete `data/`, and restart — it reseeds reference data
(no issues), and you can run the simulators again.
