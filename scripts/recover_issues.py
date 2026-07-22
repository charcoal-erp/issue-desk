#!/usr/bin/env python3
"""Reconstruct IssueDesk issues from a Markdown export.

Reverses the `toMarkdown` fix-batch export (docs/IssueDesk-Design-Document §14.2)
back into the on-disk issue files, remapping application/module/reporter names
to their ids and re-attaching the surviving upload files by matching the
attachment URLs to data/uploads/<app>/<issueId>/<file>.

Losses are unavoidable and explicit: assignee, tags, activity history and exact
timestamps are not in the export. createdAt/updatedAt fall back to the upload
mtimes (or the export date); a single 'created' activity entry is synthesised.

    python scripts/recover_issues.py <export.md> [--data-dir data] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone

PRIORITY = {"CRITICAL": "critical", "VERY HIGH": "very_high", "HIGH": "high", "MEDIUM": "medium", "LOW": "low"}
STATUS = {"Open": "open", "Implemented": "implemented", "Complete": "complete", "Rejected": "rejected"}
TYPE = {"Bug": "bug", "Feature": "feature"}
MIME = {".png": ("image/png", "image"), ".jpg": ("image/jpeg", "image"), ".jpeg": ("image/jpeg", "image"),
        ".webp": ("image/webp", "image"), ".gif": ("image/gif", "image"), ".pdf": ("application/pdf", "pdf")}


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def load_config(data_dir: str):
    apps = json.load(open(os.path.join(data_dir, "config", "applications.json")))
    users = json.load(open(os.path.join(data_dir, "config", "users.json")))
    app_by_name = {a["name"]: a for a in apps}
    mod_by_name = {a["name"]: {m["name"]: m for m in a["modules"]} for a in apps}
    user_by_name = {u["name"]: u["id"] for u in users}
    return app_by_name, mod_by_name, user_by_name


def parse_sections(md: str):
    # Split on issue headers, keep the header with its body.
    parts = re.split(r"(?m)^## (CHR-\d+) · \[([A-Z ]+)\] ", md)
    # parts = [preamble, id1, prio1, body1, id2, prio2, body2, ...]
    for i in range(1, len(parts), 3):
        yield parts[i], parts[i + 1], parts[i + 2]


def field(body: str, key: str) -> str | None:
    m = re.search(rf"\|\s*\*\*{re.escape(key)}\*\*\s*\|\s*(.*?)\s*\|", body)
    return m.group(1).strip() if m else None


def section_block(body: str, header: str) -> str | None:
    m = re.search(rf"\*\*{re.escape(header)}\*\*\n(.*?)(?=\n\*\*|\n---|\Z)", body, re.S)
    return m.group(1).strip() if m else None


def main() -> None:
    ap = argparse.ArgumentParser(description="Recover IssueDesk issues from a Markdown export.")
    ap.add_argument("markdown")
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    md = open(args.markdown, encoding="utf-8").read()
    app_by_name, mod_by_name, user_by_name = load_config(args.data_dir)
    uploads_root = os.path.join(args.data_dir, "uploads")

    m = re.search(r"Exported from IssueDesk on ([\d-]+ [\d:]+)", md)
    export_iso = "2026-01-01T00:00:00Z"
    if m:
        try:
            export_iso = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError:
            pass

    by_module: dict[tuple[str, str], list] = {}
    seq_max: dict[str, int] = {}
    warnings: list[str] = []
    total = 0

    for iid, prio_label, body in parse_sections(md):
        # Title is the remainder of the header line (up to the first newline).
        title = body.split("\n", 1)[0].strip()
        rest = body.split("\n", 1)[1] if "\n" in body else ""
        seq = int(iid.split("-")[1])

        appmod = field(rest, "App / Module") or ""
        app_name, _, mod_name = appmod.partition(" / ")
        app = app_by_name.get(app_name.strip())
        mod = mod_by_name.get(app_name.strip(), {}).get(mod_name.strip())
        if not app or not mod:
            warnings.append(f"{iid}: could not map App/Module '{appmod}' — skipped")
            continue

        pageform = field(rest, "Page / Form") or "—"
        page_raw, _, form_raw = pageform.partition(" · ")
        page = None if page_raw.strip() in ("—", "") else page_raw.strip()
        form = form_raw.strip() or None

        itype = TYPE.get(field(rest, "Type") or "Bug", "bug")
        istatus = STATUS.get(field(rest, "Status") or "Open", "open")
        reporter = user_by_name.get((field(rest, "Reporter") or "").strip(), "kiran")
        priority = PRIORITY.get(prio_label.strip(), "medium")
        description = section_block(rest, "Description") or ""

        # Attachments — reattach the surviving files.
        attachments = []
        att_mtimes: list[float] = []
        att_block = section_block(rest, "Attachments") or ""
        for line in att_block.splitlines():
            u = line.strip().lstrip("- ").strip()
            fm = re.search(r"/api/files/([^/]+)/([^/]+)/(.+)$", u)
            if not fm:
                continue
            a_app, a_iid, fname = fm.group(1), fm.group(2), fm.group(3)
            disk = os.path.join(uploads_root, a_app, a_iid, fname)
            ext = os.path.splitext(fname)[1].lower()
            mime, kind = MIME.get(ext, ("application/octet-stream", "image"))
            if os.path.exists(disk):
                st = os.stat(disk)
                att_mtimes.append(st.st_mtime)
                size, up_at = st.st_size, iso(st.st_mtime)
            else:
                warnings.append(f"{iid}: attachment file missing on disk: {disk}")
                size, up_at = 0, export_iso
            attachments.append({
                "id": str(uuid.uuid4()), "filename": fname, "originalName": re.sub(r"^\d+-", "", fname),
                "mime": mime, "kind": kind, "size": size,
                "url": f"/api/files/{a_app}/{a_iid}/{fname}", "uploadedBy": reporter, "uploadedAt": up_at,
            })

        created = iso(min(att_mtimes)) if att_mtimes else export_iso
        updated = iso(max(att_mtimes)) if att_mtimes else export_iso

        issue = {
            "id": iid, "uuid": str(uuid.uuid4()), "seq": seq, "type": itype, "title": title,
            "description": description, "appId": app["id"], "appCode": app["code"], "appName": app["name"],
            "moduleId": mod["id"], "moduleCode": mod["code"], "moduleName": mod["name"],
            "priority": priority, "status": istatus, "reporterId": reporter, "tags": [],
            "attachments": attachments,
            "activity": [{"id": str(uuid.uuid4()), "at": created, "by": reporter, "kind": "created"}],
            "createdAt": created, "updatedAt": updated,
        }
        if page:
            issue["pageName"] = page
            issue["pagePath"] = page
        if form:
            issue["formName"] = form

        by_module.setdefault((app["id"], mod["id"]), []).append(issue)
        seq_max[app["id"]] = max(seq_max.get(app["id"], 0), seq)
        total += 1

    print(f"Parsed {total} issues into {len(by_module)} module files.")
    for (app_id, mod_id), issues in sorted(by_module.items()):
        issues.sort(key=lambda x: x["seq"])
        ids = ", ".join(i["id"] for i in issues)
        print(f"  {app_id}/{mod_id}.json  ({len(issues)}): {ids}")
    for w in warnings:
        print(f"  ! {w}", file=sys.stderr)

    if args.dry_run:
        print("\nDry run — nothing written.")
        return

    # Clear stale scratch module files for the apps we are restoring, then write.
    for app_id in {a for a, _ in by_module}:
        app_dir = os.path.join(args.data_dir, "issues", app_id)
        if os.path.isdir(app_dir):
            for f in os.listdir(app_dir):
                if f.endswith(".json"):
                    os.remove(os.path.join(app_dir, f))
    for (app_id, mod_id), issues in by_module.items():
        app_dir = os.path.join(args.data_dir, "issues", app_id)
        os.makedirs(app_dir, exist_ok=True)
        with open(os.path.join(app_dir, f"{mod_id}.json"), "w", encoding="utf-8") as f:
            json.dump(issues, f, indent=2, ensure_ascii=False)
            f.write("\n")
    for app_id, mx in seq_max.items():
        app = next(a for a in app_by_name.values() if a["id"] == app_id)
        with open(os.path.join(args.data_dir, "issues", app_id, "_sequence.json"), "w", encoding="utf-8") as f:
            json.dump({"code": app["code"], "next": mx + 1}, f, indent=2)
            f.write("\n")

    print(f"\nRestored {total} issues to {args.data_dir}/issues.")


if __name__ == "__main__":
    main()
