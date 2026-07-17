#!/usr/bin/env python3
"""Populate IssueDesk with realistic Drishti test issues.

Drishti is a governance/inspection platform with six portals. Run the app
first, then:

    python simulators/drishti_simulator.py
    python simulators/drishti_simulator.py --count 24 --attachments
"""

from common import IssueTemplate, run

APP_ID = "drishti"

TEMPLATES: list[IssueTemplate] = [
    IssueTemplate("admin-system", "bug", "System Admin login locks out after one wrong OTP",
        "A single incorrect OTP locks the System Admin account for 30 minutes instead of allowing retries.",
        page="/admin/system/login", form="OTP Verification", tags=["auth", "admin"]),
    IssueTemplate("admin-system", "feature", "Audit log export for System Admin actions",
        "Compliance wants a downloadable audit trail of all System Admin configuration changes.",
        page="/admin/system/audit", form="Audit Export", tags=["admin", "compliance"]),
    IssueTemplate("admin-ward", "bug", "Ward Admin sees wards outside their jurisdiction",
        "A Ward Admin's dashboard lists wards they are not assigned to, a data-scoping issue.",
        page="/admin/ward/dashboard", form="Ward Filter", tags=["admin", "permissions"]),
    IssueTemplate("admin-ward", "bug", "Reassigning a complaint drops its attachments",
        "When a Ward Admin reassigns a complaint to another officer, the photo attachments disappear.",
        page="/admin/ward/complaints", form="Reassign", tags=["admin", "data-integrity"]),
    IssueTemplate("agency-portal", "bug", "Agency work-order PDF missing the QR on reprint",
        "First print of a work order has the verification QR; a reprint of the same order drops it.",
        page="/agency/work-orders", form="Work Order", tags=["agency", "pdf"]),
    IssueTemplate("agency-portal", "feature", "Bulk-close completed work orders",
        "Agencies want to select several completed work orders and close them in one action.",
        page="/agency/work-orders", form="Bulk Close", tags=["agency"]),
    IssueTemplate("public-portal", "bug", "Public complaint form loses photos on validation error",
        "If the public complaint form fails validation, the uploaded photos are cleared and must be re-added.",
        page="/public/complaint", form="Complaint Intake", tags=["public", "ux"]),
    IssueTemplate("public-portal", "feature", "Track complaint status by reference number",
        "Citizens want to look up the status of a complaint using its reference number without logging in.",
        page="/public/track", form="Status Lookup", tags=["public"]),
    IssueTemplate("field-officer-web", "bug", "Inspection checklist can be submitted half-empty",
        "The web inspection form submits even when mandatory checklist items are blank.",
        page="/field/web/inspection", form="Inspection Checklist", tags=["field", "validation"]),
    IssueTemplate("field-officer-mobile", "bug", "GPS pin drifts ~40m after saving on Android",
        "On Android the captured inspection location drifts about 40 metres from the actual pin after saving.",
        page="/field/mobile/capture", form="Site Inspection", tags=["field", "mobile", "gis"]),
    IssueTemplate("field-officer-mobile", "bug", "Offline inspections don't sync when back online",
        "Inspections captured offline stay stuck locally and never upload once connectivity returns.",
        page="/field/mobile/sync", form="Sync", tags=["field", "mobile", "sync"]),
    IssueTemplate("field-officer-mobile", "feature", "Attach multiple photos per inspection point",
        "Field officers want to attach several photos to a single inspection point, not just one.",
        page="/field/mobile/capture", form="Photo Attach", tags=["field", "mobile"]),
]

if __name__ == "__main__":
    run(APP_ID, "Drishti", TEMPLATES, default_count=12)
