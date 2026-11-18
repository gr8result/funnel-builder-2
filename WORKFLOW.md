# GR8 Result Builders Platform: Job Workflow

Owner: GR8 Result. Status: agreed direction for version 1. Every module (Take-off, Quotation Builder, Client Selections, Fee Proposal) must fit this flow. If a task in PLAN.md conflicts with this document, stop and ask.

**Terms:** a **workspace** is a builder **company**. In the database, every company is identified by `workspace_id`. This document says "company" in plain English and `workspace_id` wherever it means the field. There is no separate `company_id`.

---

## 1. The flow, start to finish

| # | Stage | Who | What happens | Output passed on |
|---|-------|-----|--------------|------------------|
| 1 | **Lead / enquiry** | Builder | New prospect recorded. | Job record created (status `lead`). |
| 2 | **Concept plans & rough estimate** | Builder | Concept plans drawn, rough estimate prepared in the Estimate Builder. | Rough estimate + concept plans attached to the same job record. |
| 3 | **Estimate presentation** | Builder → Client | Presentation produced and sent. | Presentation version saved, frozen once sent. |
| 4 | **Client accepts → formal job** | Builder | Job status changes to `pre-contract`. Formal plans are drawn. The **same job record** continues; nothing is re-entered. | Formal plan set (Rev A) attached. |
| 5a | **Take-off** | Estimator | Formal plans go to the Take-off module, which measures them and produces the BOQ. | BOQ (quantities, units, room/area tags), stored against the plan revision. |
| 5b | **Inclusions** (in parallel with 5a) | Builder | A standard inclusions schedule (Base / Mid / High-end template) is loaded into the Quotation Builder. | Inclusions with PC/prime-cost allowances per item. |
| 6 | **BOQ → Quote** | System | The BOQ is pushed into the Quotation Builder. Each BOQ line maps to a quote line / cost code and is priced from the builder's price book. | Priced quote draft. |
| 7 | **Client selections** (in parallel with 6) | Client + Builder | The client chooses appliances, plumbing fixtures, tapware, cabinetry, tiles, colours etc. in the Selections portal. Each choice is priced against its inclusion allowance, using BOQ quantities where needed (e.g. tile m²). Builder approves each selection. | Approved selections + upgrade/credit amounts. |
| 8 | **Formal selections schedule** | Builder → Client | Schedule generated, client signs it off. It becomes a contract document. | Signed, frozen schedule. Its data is loaded into the Quotation Builder. |
| 9 | **Formal quote** | Builder | Quote finalised (BOQ pricing + inclusions + selection upgrades + margin + GST). | Frozen quote version. |
| 10 | **Fee proposal** | System → Client | Formal fee proposal generated from the final quote. | Fee proposal document. |
| 11 | **Contract signed** | Builder + Client | Contract signed (standard HIA / Master Builders form; the platform supplies the schedules and quote attachments, not the contract wording). | Job status → `live`. |
| 12 | **Live job** (later versions) | Builder | Selections schedule feeds purchase orders; quote feeds progress claims and variations. | Out of scope for v1, but data must be structured so this can be added. |

---

## 2. Core rules that apply to every module

1. **One job record from lead to live.** Every module reads and writes the same job (one `job_id`). Status moves forward: `lead → estimate → pre-contract → contracted → live`. No module creates its own separate copy of a job.
2. **Company isolation.** Every row of job data carries `workspace_id` (the company), enforced by Supabase row-level security. A user can never read or write another company's data. Clients can only see their own job.
3. **Freeze, don't edit.** Anything sent to a client or signed (presentation, quote, schedule, fee proposal) is frozen as a version. Later changes create a new version. Keep who, what and when for every approval and sign-off (audit trail).
4. **Plan revisions drive re-calculation.** Each plan set has a revision (Rev A, B, C…). The BOQ is tied to a revision. A new revision means: re-run the take-off, show what changed (quantities added/removed/changed), and flag the quote and any selections that used the changed quantities.
5. **Storage:**
   - Structured job data (BOQ, measurements, quotes, selections, schedules, approvals, audit trail) lives in GR8's Supabase database, every row keyed by `workspace_id`.
   - Plan PDFs and images: see decision D1 below.
   - The browser holds only a short-lived cache, separated by company (`workspace_id`) and user, cleared on logout.
6. **One editor at a time (v1).** Edit lock per job module; other users see read-only. See decision D3.
7. **Roles:** Admin (everything, incl. approve and send), Estimator (measure/edit, no approve/send), Viewer (read-only), Client (own job's selections and documents only). Roles are held per company (`workspace_id`).

---

## 3. What each module hands to the next

### Take-off → Quotation Builder
- Each BOQ line: `workspace_id`, `job_id`, `plan_revision`, trade, item, unit, quantity, room/area, source (measured / scaled / allowance), confidence.
- Lines map to the builder's **price book** items / cost codes. Unmapped lines are flagged, never silently dropped.
- Re-sending a BOQ after a plan revision updates matched lines and lists differences; it must not duplicate lines.

### Inclusions template → Quotation Builder
- Template per builder (Base / Mid / High-end), copied into the job (later template edits don't change existing jobs).
- Each inclusion has a category, description and **PC allowance** (amount, or rate × BOQ quantity).

### Client Selections → Quotation Builder
- Each selection: category, product (from builder's product library), quantity (from BOQ where relevant), price, inclusion it replaces, difference vs allowance (upgrade or credit), approval status.
- Selections not finalised by contract stay as **PC / provisional sums** in the quote.
- After a selection is approved and locked, changes must go through a priced variation (pre-contract: quote revision; post-contract: variation, later version).

### Quotation Builder → Fee Proposal → Contract
- Final quote version (frozen) + signed selections schedule → fee proposal.
- The platform produces schedules and attachments for the builder's standard contract. It does not write contract terms.

---

## 4. Master data each builder must own

All master data is held per company (`workspace_id`).

| Data | Used by | Notes |
|------|---------|-------|
| Price book (rates, suppliers, waste %, cost codes) | Take-off → Quote | Needs import (CSV/Excel) for onboarding. |
| Product library (images, supplier, cost, sell price) | Selections | Shared starter library optional (later). |
| Inclusions templates (Base / Mid / High) | Quote, Selections | Copied per job. |
| Company settings (margin, GST, branding, roles) | All | Admin only. |

---

## 5. Decisions (v1)

| # | Decision |
|---|----------|
| D1 | **Plan file storage:** v1 uses a private Supabase Storage bucket, separated by company (`workspace_id`), with a per-company storage quota and automatic clean-up of temporary renders. Linking plans from the builder's own Google Drive / OneDrive / Dropbox is a **Later** item. |
| D2 | **Roles:** Admin / Estimator / Viewer / Client. Today's eight roles map to these: owner, admin, builder_admin and builder → Admin; estimator and builder_staff → Estimator; interior_designer and sales → Viewer; client portal users → Client. (Approved by the owner on 19 November 2026.) |
| D3 | **Edit lock:** expires after 15 minutes of no activity (heartbeat while the user is active). Admin can take over a lock; the previous user's unsaved changes are saved as a draft, not lost. |
| D4 | **AI cost:** calculated from the token usage the provider reports × a per-model price stored in a settings table that only GR8 super-admins can edit. Store raw token counts as well as cost. |
| D5 | **Migrating browser-only jobs:** a button, not automatic. On first login after the update, show a list of jobs found in this browser with the company they belong to; the user uploads them one by one. Keep the local copy until the server confirms the save. |
| D6 | **Reference plans for testing:** only plans GR8 owns or has written permission to use, kept in private storage, never in the repo. |
| D7 | **Company field:** keep `workspace_id` as the company identifier everywhere. A workspace is a company; no `company_id` column is added. |

---

## 6. Known gaps to design (not all in v1)

1. Price book import and BOQ-to-price-book mapping (v1).
2. Plan revision diff in take-off (v1: show changes; later: auto-update quote).
3. Allowance vs selection reconciliation logic (Selections v1).
4. Variations after contract (later).
5. Purchase orders from the selections schedule, progress claims from the quote (later).
6. Builder-owned cloud storage for plans (later).
7. Merging simultaneous edits (later; v1 uses the edit lock).
