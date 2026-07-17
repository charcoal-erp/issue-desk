"""Shared helpers for the IssueDesk test-data simulators.

These scripts populate an IssueDesk instance with realistic test issues by
POSTing to the app's JSON API. They are for TESTING ONLY — the app itself
seeds no issues. Run the app first (`npm run dev`), then run a simulator.
"""

from __future__ import annotations

import argparse
import base64
import random
import sys
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from typing import Optional

DEFAULT_BASE_URL = "http://localhost:5173"

# Reporters may be anyone; assignees must be marked assignable in the app.
REPORTERS = ["kiran", "anant", "aadinath", "tushar"]
ASSIGNEES = ["kiran", "tushar"]

PRIORITIES = ["critical", "very_high", "high", "medium", "low"]
STATUSES = ["open", "implemented", "complete", "rejected"]
STATUS_WEIGHTS = [5, 2, 3, 1]  # mostly open; a few rejected (won't implement)

# A 1x1 transparent PNG — a valid image the upload endpoint accepts.
_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPlfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


@dataclass
class IssueTemplate:
    module_id: str
    type: str  # "bug" | "feature"
    title: str
    description: str
    page: str = ""
    form: str = ""
    tags: list[str] = field(default_factory=list)


class Client:
    """Minimal HTTP client for the IssueDesk API (stdlib only, no deps)."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def _post(self, path: str, data: bytes, content_type: str) -> dict:
        req = urllib.request.Request(
            self.base_url + path,
            data=data,
            method="POST",
            headers={"Content-Type": content_type},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{path} → {e.code}: {e.read().decode('utf-8')}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"Could not reach {self.base_url} — is the app running? ({e})"
            ) from e
        import json

        return json.loads(body) if body else {}

    def upload(self, app_id: str, draft_id: str, filename: str) -> list[dict]:
        """Stage a placeholder screenshot as a pending upload; returns Attachment[]."""
        boundary = "----issuedesk" + uuid.uuid4().hex
        parts: list[bytes] = []

        def field(name: str, value: str) -> None:
            parts.append(f"--{boundary}\r\n".encode())
            parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
            parts.append(value.encode())
            parts.append(b"\r\n")

        field("appId", app_id)
        field("issueId", "pending")
        field("draftId", draft_id)
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(
            f'Content-Disposition: form-data; name="files"; filename="{filename}"\r\n'.encode()
        )
        parts.append(b"Content-Type: image/png\r\n\r\n")
        parts.append(_TINY_PNG)
        parts.append(b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())

        body = b"".join(parts)
        result = self._post(
            "/api/uploads", body, f"multipart/form-data; boundary={boundary}"
        )
        return result.get("attachments", [])

    def create_issue(self, payload: dict) -> dict:
        import json

        result = self._post(
            "/api/issues", json.dumps(payload).encode("utf-8"), "application/json"
        )
        return result["issue"]


def parse_args(app_label: str, default_count: int) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=f"Populate IssueDesk with {app_label} test issues."
    )
    p.add_argument("--base-url", default=DEFAULT_BASE_URL, help="IssueDesk base URL")
    p.add_argument(
        "--count",
        type=int,
        default=default_count,
        help=f"Number of issues to create (default {default_count})",
    )
    p.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    p.add_argument(
        "--attachments",
        action="store_true",
        help="Attach a placeholder screenshot to some issues",
    )
    return p.parse_args()


def run(
    app_id: str,
    app_label: str,
    templates: list[IssueTemplate],
    default_count: int = 18,
) -> None:
    args = parse_args(app_label, default_count)
    rng = random.Random(args.seed)
    client = Client(args.base_url)

    # Sample up to `count` issues, cycling templates if more are requested.
    chosen: list[IssueTemplate] = []
    pool = list(templates)
    rng.shuffle(pool)
    while len(chosen) < args.count:
        if not pool:
            pool = list(templates)
            rng.shuffle(pool)
        chosen.append(pool.pop())

    print(f"Creating {len(chosen)} {app_label} issues at {client.base_url} …")
    created = 0
    for i, tpl in enumerate(chosen, 1):
        reporter = rng.choice(REPORTERS)
        assignee = rng.choice(ASSIGNEES + [None, None])  # ~1/3 unassigned
        payload: dict = {
            "type": tpl.type,
            "title": tpl.title,
            "description": tpl.description,
            "appId": app_id,
            "moduleId": tpl.module_id,
            "page": tpl.page,
            "form": tpl.form,
            "priority": rng.choice(PRIORITIES),
            "status": rng.choices(STATUSES, weights=STATUS_WEIGHTS)[0],
            "reporterId": reporter,
            "assigneeId": assignee or "",
            "tags": tpl.tags,
            "attachments": [],
        }
        if args.attachments and rng.random() < 0.5:
            draft_id = uuid.uuid4().hex
            payload["draftId"] = draft_id
            payload["attachments"] = client.upload(
                app_id, draft_id, f"{i:02d}-screenshot.png"
            )
        try:
            issue = client.create_issue(payload)
            created += 1
            print(f"  ✓ {issue['id']:<8} {issue['title']}")
        except RuntimeError as e:
            print(f"  ✗ {tpl.title}: {e}", file=sys.stderr)

    print(f"\nDone — {created}/{len(chosen)} issues created for {app_label}.")
