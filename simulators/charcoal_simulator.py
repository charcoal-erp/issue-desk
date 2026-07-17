#!/usr/bin/env python3
"""Populate IssueDesk with realistic Charcoal test issues.

Charcoal is an ERP with 14 modules. Run the app first, then:

    python simulators/charcoal_simulator.py                 # ~18 issues
    python simulators/charcoal_simulator.py --count 40      # more, cycling templates
    python simulators/charcoal_simulator.py --attachments   # some with a screenshot
"""

from common import IssueTemplate, run

APP_ID = "charcoal"

TEMPLATES: list[IssueTemplate] = [
    IssueTemplate("org-hub", "bug", "Switching organization keeps the previous org's sidebar",
        "After switching org from the Organization Hub, the left nav still lists the prior org's modules until a hard refresh.",
        page="/org/hub", form="Organization Switcher", tags=["org", "navigation"]),
    IssueTemplate("company-hub", "feature", "Bulk-invite employees to a company via CSV",
        "Admins want to onboard a whole company at once by uploading a CSV of employees instead of adding them one by one.",
        page="/company/employees", form="Employee Import", tags=["onboarding"]),
    IssueTemplate("my-desk", "bug", "My Desk task count doesn't clear after completing a task",
        "The pending-task badge on My Desk stays at the old number until the page is reloaded.",
        page="/my-desk", form="Task List", tags=["dashboard"]),
    IssueTemplate("platform-console", "bug", "Feature flag toggle silently fails for tenant admins",
        "A tenant admin toggling a feature flag in the Platform Console gets a success toast but the flag does not persist.",
        page="/platform/flags", form="Feature Flag Editor", tags=["platform", "permissions"]),
    IssueTemplate("accounting", "bug", "Journal entry allows unbalanced debit and credit",
        "Saving a journal where total debits != total credits should be rejected server-side, but it is accepted.",
        page="/accounting/journal", form="Journal Entry", tags=["accounting", "data-integrity"]),
    IssueTemplate("accounting", "feature", "Export trial balance to Excel",
        "Finance wants the trial balance downloadable as an .xlsx, not just PDF.",
        page="/accounting/trial-balance", form="Export Options", tags=["accounting", "export"]),
    IssueTemplate("procurement", "bug", "Purchase order approval skips the second approver",
        "A PO above the threshold should need two approvals but is marked approved after the first.",
        page="/procurement/po", form="PO Approval", tags=["procurement", "approvals"]),
    IssueTemplate("inventory", "bug", "Negative stock allowed on rapid double adjust",
        "Hitting Adjust twice quickly lets stock go below zero. Needs a server-side guard, not just client validation.",
        page="/inventory/stock", form="Stock Adjust", tags=["inventory"]),
    IssueTemplate("inventory", "feature", "Low-stock reorder alert",
        "Send an alert when an item drops below its reorder level so procurement can act.",
        page="/inventory/items", form="Reorder Rules", tags=["inventory", "notify"]),
    IssueTemplate("sales", "bug", "Quote total ignores line-item discounts",
        "When a per-line discount is applied, the quote grand total still uses the pre-discount subtotal.",
        page="/sales/quotes", form="Quote Editor", tags=["sales", "billing"]),
    IssueTemplate("crm", "bug", "Lead status reverts to New after edit",
        "Editing any field on a lead resets its status back to New instead of keeping the current stage.",
        page="/crm/leads", form="Lead Detail", tags=["crm"]),
    IssueTemplate("crm", "feature", "Merge duplicate contacts",
        "Sales wants to merge two contact records that are the same person, keeping activity history.",
        page="/crm/contacts", form="Merge Contacts", tags=["crm", "data-quality"]),
    IssueTemplate("marketing", "bug", "Campaign schedule uses server timezone, not the user's",
        "A campaign scheduled for 9am local sends at 9am server time, hours off for some users.",
        page="/marketing/campaigns", form="Campaign Scheduler", tags=["marketing", "timezone"]),
    IssueTemplate("assets", "bug", "Asset depreciation continues after disposal",
        "A disposed asset keeps accruing depreciation in the monthly run.",
        page="/assets/register", form="Asset Detail", tags=["assets", "accounting"]),
    IssueTemplate("expense", "bug", "Expense claim accepts a future-dated receipt",
        "A claim with a receipt date in the future is accepted; it should be rejected with a clear message.",
        page="/expense/claims", form="Expense Claim", tags=["expense", "validation"]),
    IssueTemplate("expense", "feature", "Per-diem auto-fill by city",
        "Auto-populate the per-diem amount based on the selected city instead of manual entry.",
        page="/expense/claims", form="Per-diem", tags=["expense"]),
    IssueTemplate("hr", "bug", "Leave balance goes negative on overlapping requests",
        "Two overlapping approved leave requests can push the balance below zero.",
        page="/hr/leave", form="Leave Request", tags=["hr", "data-integrity"]),
    IssueTemplate("payroll", "bug", "Payslip rounds tax down, causing a 1-rupee mismatch",
        "Rounding on the tax line differs from the summary, producing an off-by-one paise mismatch.",
        page="/payroll/run", form="Payslip", tags=["payroll", "accounting"]),
    IssueTemplate("payroll", "feature", "Download all payslips for a period as a ZIP",
        "HR wants one ZIP of every payslip for a pay period instead of downloading each.",
        page="/payroll/run", form="Bulk Download", tags=["payroll", "export"]),
]

if __name__ == "__main__":
    run(APP_ID, "Charcoal", TEMPLATES, default_count=18)
