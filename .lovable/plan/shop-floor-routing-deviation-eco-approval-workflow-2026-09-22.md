# Shop Floor Routing Deviation & ECO Approval Workflow

A production-grade internal system for raising routing deviations on the shop floor, routing them through Floor Manager (L1) and PPC (L2) approval, issuing ECO numbers, and simulating sync to Oracle Fusion Cloud ERP.

## Backend

Lovable Cloud is enabled for login, database, and file storage.

Tables:
- **master_routing** — all 29,999 rows from your spreadsheet (item, op code, op description, dept code, dept description), indexed for fast type-ahead search.
- **profiles** — name, email, active flag per account.
- **user_roles** — roles held per account (Administrator, Requester, Floor Manager, PPC Reviewer, Viewer), kept in a separate table so roles cannot be tampered with from the browser.
- **deviations** — every ticket: all form fields, floor decision, PPC decision, ECO number, Fusion sync state, timestamps.
- **audit_trail** — one entry per action with reviewer name, email, role, timestamp, remarks, and every field changed ("old" → "new").
- **form_fields** — the admin-defined form layout driving the deviation form.

Access rules: Requesters see and create only their own tickets and cannot edit after submitting. Floor Managers act only on submitted tickets, PPC only on floor-approved ones. Viewers read only. Administrators see everything.

Sign-in: email + password, plus Google. Seeded demo accounts for each role and a set of demo tickets in mixed states so the dashboard has real data immediately.

## Roles & profile switcher

Roles are real and enforced server-side. The sidebar footer shows the active profile; administrators can switch to view the app as any of the five roles, with a clear "viewing as" banner. Non-admins see their own role only.

## Master data & linked autocomplete

- Item code: standalone lookup with live search.
- Operation code ↔ description: typing or picking either one suggests and fills the other.
- Department code ↔ description: same two-way link.
- Master Data screen: drag-and-drop CSV/Excel upload, add-a-row form, searchable paged table with inline edit and delete, sample CSV template download, and full data export.

## Deviation form

Header "DEVIATION FORM" with the read-only-after-submit note, and the exact field order you listed: Supervisor Name; Item Name combobox; Last Seq No. + Last Operation Name; Next Department Code + Description in a two-column grid; Next Seq No + Next Operation Code; Proposed Operation (suggestions plus free text); Movement Date + Change Type; Remarks; "Submit Routing Deviation". Sequence numbers accept numeric input only. Admin-added custom fields render here automatically.

## Form Builder (Admin)

Add-a-field card (name, type: text/number/select/textarea/date/item lookup, comma-separated choices, required toggle) and an active-fields list with up/down reorder, editable label, type badge, required and shown/hidden switches, and delete. Changes appear instantly on the new deviation form and in review tables.

## Review, aging & audit

Floor Review and PPC Review queues open a modal where every field is editable inline. Differences are computed and written to the audit trail with the reviewer's identity and remarks. Rejection requires remarks. PPC approval requires an ECO number — enter it or auto-generate ECO-2026-FUS-XXXX — and then runs the simulated Fusion sync with a status badge.

Aging badge on every ticket: elapsed time such as "4h 15m" or "2d 6h", green under 24h, amber 24–48h, red over 48h.

Tables show Floor Reviewed By / time / remarks, PPC Reviewed By / ECO No / time / remarks, and the Fusion sync badge.

## Dashboard & filter console

Four KPI cards: Pending Floor Approvals, Floor Rejections, ECOs Approved (with Fusion sync count), PPC Rejections.

Top 5 Pending Items watchlist with item code, total pending, L1 and L2 counts, and oldest ticket age; clicking a card filters the table to that part.

Filters: from/to date with All Time / Today / Last 7 Days / Last 30 Days presets; universal search across ticket no, item, requester, supervisor, proposed op and ECO no; dropdowns for floor status, PPC status, next dept code, change type, delay severity, requester and Fusion sync state; removable filter tags and Clear All. Sortable headers for ticket no, item name, waiting time and submission date. "Download Filtered Data (N)" exports exactly the filtered rows with all 28 form and audit columns.

## User accounts & exports

Admin account management: create account (email, name, password, role), table with inline role change, active toggle, reset-password modal, and accounts CSV export. CSV download buttons also on Master Data, My Requests, Floor Review, PPC Review and Dashboard.

## Technical notes

- TanStack Start with server functions for all database access; role checks enforced in a security-definer `has_role` function used by row-level policies.
- The 29,999 master rows are loaded via migration; item/op/dept searches run server-side with trigram-style prefix indexes and are debounced in the UI, so the combobox stays fast.
- CSV/Excel upload parsed client-side and inserted in batches with a progress indicator.
- Tailwind design tokens for an industrial control-room look (dark slate surfaces, amber/emerald status accents), Lucide icons throughout.
- Aging is computed from `submitted_at` at render time so badges stay live.

## Build order

1. Cloud setup, schema, roles, policies, master data load, demo accounts and tickets.
2. Auth, app shell, sidebar, profile switcher.
3. Master data module with import/export.
4. Deviation form plus form builder.
5. Floor and PPC review with inline edit, audit trail, ECO and Fusion sync.
6. Dashboard, filter console and all CSV exports.
