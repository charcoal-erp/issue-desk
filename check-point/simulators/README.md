# Checkpoint demo-data simulator

> **IssueDesk seeds no test data and needs none — it is stable, and its `data/`
> files are real data, not disposable fixtures.** The former IssueDesk issue
> simulators were removed to avoid ever treating real issues as throwaway.
> To back up or move real data, see `npm run backup:data` and the automatic
> boot snapshots under `data/.backups/`.

The one remaining script populates the **Checkpoint** (`/qa`) workspace, which
*does* start empty by design, with a representative dataset so you can explore
it. Standard library only (Python 3.9+); it drives the same form actions the UI
uses, so it is a faithful end-to-end exercise — not a private back door.

## Usage

1. Start the app so it is reachable:

   ```bash
   npm run dev          # http://localhost:5173
   # or: npm run build && node build   (PORT=3000)
   ```

2. Run the simulator from the repo root:

   ```bash
   python simulators/checkpoint_simulator.py
   python simulators/checkpoint_simulator.py --base-url http://localhost:3000
   ```

It creates the six representative runners, a spread of test cases
(api / e2e / unit / visual / shell / manual), two suites, and one launched run
with its manual cases marked. Re-running adds another set (ids increment).

To clear Checkpoint data without touching IssueDesk, remove only the Checkpoint
directories: `data/tests`, `data/suites`, `data/runs`, `data/reports`,
`data/runners.json`. **Never** delete `data/issues`, `data/config` or
`data/uploads`.
