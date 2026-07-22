#!/usr/bin/env python3
"""Populate Checkpoint (the /qa workspace) with a realistic demo dataset.

Checkpoint seeds no test data of its own — the screens render honest empty
states. Run the app first (`npm run dev`), then run this to get the six
representative runners, a spread of test cases, two suites and a launched run:

    python simulators/checkpoint_simulator.py
    python simulators/checkpoint_simulator.py --base-url http://localhost:5173

It drives the same form actions the UI uses (no private API), so it is a faithful
end-to-end exercise of case authoring, suites, launching and manual marking.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BASE_URL = "http://localhost:5173"

RUNNERS = [
    ("API contract (pytest)", "api", "python", "pytest tests/api -q --junitxml=reports/api-junit.xml", "services/api", "junit-xml", "reports/api-junit.xml", "nodeid"),
    ("E2E (Playwright)", "e2e", "node", "npx playwright test --reporter=json", "apps/web", "playwright-json", "reports/e2e.json", "annotation"),
    ("Unit (Vitest)", "unit", "node", "npx vitest run --reporter=json --outputFile=reports/unit.json", ".", "vitest-json", "reports/unit.json", "testName"),
    ("Visual regression", "visual", "node", "npx playwright test --project=visual --reporter=json", "apps/web", "visual-diff", "reports/visual.json", "snapshotName"),
    ("Smoke (shell script)", "shell", "bash", "bash scripts/smoke.sh --env $ENV", "ops", "exit-code", "stdout", "tapName"),
    ("Manual execution", "manual", "other", "", "", "junit-xml", "", "nodeid"),
]

# (title, moduleId, kind, priority, specPath, externalTestId)
CASES = [
    ("Tax computed on the discounted subtotal", "accounting", "api", "critical", "tests/api/billing/test_tax.py", "test_tax.py::test_discounted_subtotal"),
    ("Invoice PDF matches the approved snapshot", "accounting", "visual", "medium", "tests/visual/invoice.spec.ts", "invoice-pdf-a4"),
    ("Account locks after 5 failed attempts", "accounting", "e2e", "very_high", "tests/e2e/auth.spec.ts", "@checkpoint TC-CHR-3"),
    ("Cart applies a percentage discount", "sales", "unit", "medium", "tests/unit/cart.test.ts", "cart applies a percentage discount"),
    ("Smoke: home page returns 200", "sales", "shell", "high", "scripts/smoke.sh", "smoke home page"),
    ("Manual: refund flow end to end", "accounting", "manual", "high", "", ""),
    ("Manual: export trial balance to Excel", "accounting", "manual", "medium", "", ""),
    ("Purchase order needs two approvals", "procurement", "api", "high", "tests/api/po/test_approval.py", "test_approval.py::test_two_approvers"),
]

SUITES = [
    ("Billing release", "staging", [1, 2, 6, 7]),  # 1-based indices into CASES
    ("Auth regression", "staging", [3]),
]


class Client:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def action(self, path: str, fields: dict) -> str:
        body = urllib.parse.urlencode(fields).encode()
        req = urllib.request.Request(
            self.base_url + path,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "x-sveltekit-action": "true",
                "Origin": self.base_url,
            },
        )
        return self._send(req)

    def json_post(self, path: str, payload: dict) -> str:
        req = urllib.request.Request(
            self.base_url + path,
            data=json.dumps(payload).encode(),
            method="POST",
            headers={"Content-Type": "application/json", "Origin": self.base_url},
        )
        return self._send(req)

    def _send(self, req) -> str:
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{req.full_url} → {e.code}: {e.read().decode('utf-8')[:200]}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Could not reach {self.base_url} — is the app running? ({e})") from e


def first(pattern: str, text: str) -> str | None:
    m = re.search(pattern, text)
    return m.group(0) if m else None


def main() -> None:
    p = argparse.ArgumentParser(description="Populate Checkpoint with a demo dataset.")
    p.add_argument("--base-url", default=DEFAULT_BASE_URL)
    p.add_argument("--app", default="charcoal", help="Application id for the cases/suites")
    args = p.parse_args()
    c = Client(args.base_url)
    app = args.app

    print(f"Seeding Checkpoint demo data at {c.base_url} …\n")

    print("Runners:")
    for name, kind, lang, cmd, wd, fmt, path, match in RUNNERS:
        r = c.action("/qa/runners?/upsertRunner", {
            "name": name, "kind": kind, "language": lang, "command": cmd,
            "workingDir": wd, "reportFormat": fmt, "reportPath": path,
            "matchBy": match, "matchTag": "@checkpoint", "enabled": "true",
        })
        print(f"  ✓ {first(r'RNR-\d+', r) or '?'}  {name}")

    print("\nCases:")
    case_ids: list[str] = []
    for title, module, kind, prio, spec, ext in CASES:
        steps = json.dumps([{"action": "Exercise the behaviour", "expected": "It holds"}])
        r = c.action("/qa/cases?/upsertCase", {
            "title": title, "appId": app, "moduleId": module, "priority": prio,
            "kind": kind, "status": "active", "specPath": spec, "externalTestId": ext,
            "steps": steps, "suiteIds": "[]", "tags": "demo",
        })
        cid = first(r"TC-[A-Z]+-\d+", r) or "?"
        case_ids.append(cid)
        print(f"  ✓ {cid}  [{kind}] {title}")

    print("\nSuites:")
    suite_ids: list[str] = []
    for name, env, idx in SUITES:
        ids = [case_ids[i - 1] for i in idx if case_ids[i - 1] != "?"]
        r = c.action("/qa/suites?/upsertSuite", {
            "name": name, "appId": app, "defaultEnv": env,
            "caseIds": json.dumps(ids), "tags": "demo",
        })
        sid = first(r"SUITE-[A-Z]+-\d+", r) or "?"
        suite_ids.append(sid)
        print(f"  ✓ {sid}  {name} ({len(ids)} cases)")

    if suite_ids and suite_ids[0] != "?":
        print("\nLaunching a run of the first suite (all kinds) …")
        r = c.json_post("/qa/runs/launch", {
            "suiteId": suite_ids[0], "environment": "staging",
            "kinds": ["api", "e2e", "unit", "visual", "shell", "manual"],
        })
        run_id = first(r"RUN-[A-Z]+-\d+", r)
        print(f"  ✓ {run_id or '?'} launched")
        # Mark the manual cases so the run reads honestly.
        manual_ids = [case_ids[i - 1] for i in SUITES[0][2] if CASES[i - 1][2] == "manual"]
        for cid in manual_ids:
            if cid != "?" and run_id:
                c.action(f"/qa/runs/{run_id}?/recordResult", {"caseId": cid, "status": "pass"})
        if manual_ids:
            print(f"  ✓ marked {len(manual_ids)} manual case(s)")

    print("\nDone — open the app and switch to Checkpoint.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(f"\nError: {e}", file=sys.stderr)
        sys.exit(1)
