# Selections Legacy Isolation Verification

Date: 2026-07-29

Branch: `cleanup/remove-legacy-selections`

Starting commit: `2a558df3ec2850a71f812d6304e0c95f1691588e`

## Deleted Files

- `components/product-library/SelectionChecklistNav.jsx`
- `components/product-library/GuidedSelectionWorkspace.jsx`
- `components/product-library/RunningSelectionsSummary.jsx`
- `components/product-library/ChecklistAdminPanel.jsx`
- `scripts/test-guided-selections-workflow.mjs`
- `scripts/test-selections-book-focus-mode-width.mjs`
- `docs/client-selections-stage1-deletion-report.md`

## Modified Files

- `pages/modules/builders/client-selections.js`: replaced legacy Stage 1 workflow with isolated retirement screen.
- `pages/modules/builders/guided-selections/[projectId].js`: replaced guided workflow with isolated retirement screen.
- `pages/modules/builders/selections-book.js`: replaced Selections Book with isolated retirement screen.
- `pages/modules/builders/inclusions-schedule/[projectId].js`: replaced schedule preview/signing page with isolated retirement screen.
- `pages/api/builders/inclusions-schedule.js`: replaced schedule API with retired `410` JSON response; no auth, Supabase, storage, or legacy selection data access remains.
- `components/estimate-builder/EstimateBuilderWorkbook.js`: removed dynamic Selections Book import, `clientSelections` visual/card/render path, and active "Export to Selections CSV" button.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`: removed active `clientSelections` workbook page registration.
- `pages/modules/construction/index.js`: replaced the old Client Selections Library hub entry with disabled `Inclusions & Selections — Rebuilding` item.
- `pages/modules/builders/document-vault.js`: removed the legacy route link from the header; retained document workflows and historical related-selection data handling.
- `pages/modules/builders/rfis.js`: removed the legacy route link from the header; retained RFI workflows and historical related-selection data handling.
- `pages/modules/builders/quote-approvals.js`: removed the legacy route link from the header; retained approval workflows and historical related-selection data handling.
- `components/product-library/ProductLibraryToolbar.jsx`: renamed visible shared catalogue surface to Product Library.
- `pages/modules/builders/product-library.js`: renamed page title to Product Library.
- `lib/product-library/constants.js`: removed stale comment reference to `client-selections.js`; constants retained.

## Created Files

- `docs/SELECTIONS_REMOVAL_BASELINE.md`
- `docs/SELECTIONS_REMOVAL_DECISIONS.md`
- `docs/SELECTIONS_LEGACY_ISOLATION_VERIFICATION.md`
- `src/modules/inclusions-selections/README.md`
- `src/modules/inclusions-selections/index.ts`

## Retained Shared Files

- Product Library UI, helpers, constants, APIs, product image helpers, suppliers, brands and categories were retained.
- Estimate Builder remained available. Only the active legacy Selections Book launch/render path was removed.
- Project Estimate and Standard Inclusions files were not deleted or rebuilt.
- Document Vault, RFIs and Quote Approvals remain active shared modules. Their old route links were disabled, while stored historical references were preserved.
- `lib/builders/selectionBudget.js` was retained because Product Library helpers/APIs and retained tests still import shared money/pricing helpers from it.
- `scripts/test-client-selections-library.mjs` and `scripts/test-selection-budget-manager.mjs` were retained as deferred mixed/uncertain test assets.
- All deployed Supabase migration files were retained.

## Deferred Uncertain Files

Status for all uncertain items: `DEFERRED — REQUIRES LATER REVIEW`.

- `supabase/migrations/20260706_builder_selection_templates_prepopulation.sql`
- `supabase/migrations/20260706_builder_inclusion_templates.sql`
- `supabase/migrations/20260725_product_library_selection_tiers.sql`
- `supabase/migrations/20260726_client_selections_library.sql`
- `supabase/migrations/20260729_client_selections_top_down_stage1.sql`
- `scripts/test-client-selections-library.mjs`
- `scripts/test-selection-budget-manager.mjs`

Further evidence needed before removal: live database row inventory, Product Library ownership decision for selection-tier fields, Standard/Builder inclusion template usage confirmation, and a split between Product Library tests and retired selections-interface tests.

## Remaining Database Artefacts

The following artefacts remain intentionally preserved:

- `client_selections`
- `builder_client_selections`
- `builder_selection_books`
- `builder_selection_sessions`
- `builder_selection_categories`
- `builder_selection_history`
- `builder_selection_budget_settings`
- `builder_selection_items`
- `builder_selection_checklist_items`
- `builder_inclusions_schedules`
- Stage 1 top-down tables and backups
- Product Library selection-related columns on shared product/category/project tables
- Document/RFI/approval historical references to `builder_client_selections`

No database tables were dropped or altered. No deployed migration history was rewritten.

## Remaining Terminology And Legitimate Reasons

- `scripts/test-client-selections-library.mjs` and the matching `package.json` script still mention old route filenames because the script is a deferred mixed Product Library/legacy test and was not safely removed in this task.
- `lib/standard-inclusions/onlyoffice.js` and `scripts/upload-standard-inclusions-master.mjs` use `standard-inclusions` storage paths for the separate Standard Inclusions module.
- Estimate Builder still contains `selectionImageUrl`, `selectionSpec`, `selectionAllowanceAmount`, `selectionSelectedCost`, and related quote-row fields. These are preserved shared estimate/product-reference fields and no longer mount or link to the retired workspace.
- Product Library still contains selection availability/scope data fields because those are shared catalogue/database concerns and require a later schema/data decision.

## Active Routes Removed Or Retired

- `/modules/builders/client-selections`: retired screen only; no legacy imports, stores, localStorage reads, Supabase queries, or legacy providers.
- `/modules/builders/guided-selections/[projectId]`: retired screen only; no checklist/product/workflow imports, localStorage reads, or Supabase queries.
- `/modules/builders/selections-book`: retired screen only; no Product Library picker/image helpers, Supabase queries, or `builder_selection_books` writes.
- `/modules/builders/inclusions-schedule/[projectId]`: retired screen only; no fetch to `/api/builders/inclusions-schedule`, no Supabase queries.
- `/api/builders/inclusions-schedule`: retired `410` response only; no `withWorkspace`, `supabaseAdmin`, storage, PDF generation, or selection queries.

## Legacy Navigation Removed

- Construction Hub no longer links the old Client Selections Library entry.
- Estimate Builder no longer exposes a `clientSelections` workbook page/card/render target.
- Document Vault, RFIs and Quote Approvals no longer link to `/modules/builders/client-selections`.

## Legacy Initialisation Check

Focused repository search after isolation found no active app-code references to:

- `client_selections_top_down_stage1`
- `gr8:guidedSelections:summaryCollapsed`
- `gr8:selectionsBook:sidebarCollapsed`
- `gr8:selectionsBook:detailsPanelCollapsed`
- `SelectionChecklistNav`
- `GuidedSelectionWorkspace`
- `RunningSelectionsSummary`
- `ChecklistAdminPanel`
- `CommercialClientSelectionsPage`

Remaining route-string references to `client-selections` / `selections-book` are limited to deferred test/package assets and audit/removal documentation.

## Active API Calls

No active page calls `/api/builders/inclusions-schedule` after the schedule page was retired. The API route remains only as a retired response boundary.

Active shared modules still read `builder_client_selections` for historical relationships:

- Product delete/archive protection in Product Library.
- Document Vault related-record display/persistence.
- RFIs related-selection support.
- Quote Approvals related-selection support.
- Convert-to-live-project preflight counts.

These reads are preserved intentionally because the task prohibited deleting shared Product Library, document, approval, RFI, estimating, or client data structures.

## Shared Module Availability

- Product Library: retained and still route-backed at `/modules/builders/product-library`; visible title changed to Product Library.
- Supplier Library: supplier/brand lookup and management inside Product Library retained.
- Estimate Builder: retained; Product Library, Supplier Quotations, Project Estimate, Standard Inclusions, Quote Approvals, Document Vault and RFIs remain registered.
- Approvals, RFIs and documents: retained; only legacy route links disabled.

## Final Isolation Finding

There is no active route capable of loading the failed legacy selections workspace. The old routable paths now render isolated retirement screens or a retired API response, and active navigation/Estimate Builder launch paths into the workspace have been removed.
