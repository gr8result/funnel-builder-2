# Selections Removal Decisions

Date: 2026-07-29

Starting audit: `docs/SELECTIONS_LEGACY_AUDIT.md`

Rule applied: a DELETE CANDIDATE is deleted only when dependency verification shows no active external dependency after isolation. Routable pages and APIs are retired in place where direct URL/API consumers may still exist.

## Decisions

| Full file path | Original audit classification | Dependency verification | Final decision | Reason | Affected routes/imports | Risk |
|---|---|---|---|---|---|---|
| `D:\dev\funnel-builder-clean\pages\modules\builders\client-selections.js` | DELETE CANDIDATE | Imports only page-level React/workspace/Supabase dependencies. Referenced by direct Next route and links from Guided Selections, Selections Book, RFIs, Quote Approvals, Document Vault, and tests. Reads localStorage key `client_selections_top_down_stage1` and `builder_selection_sessions`. | MODIFY INSTEAD | Direct route consumers exist; replace with isolated retirement screen to avoid 404 and stop legacy initialization. | `/modules/builders/client-selections` | High |
| `D:\dev\funnel-builder-clean\pages\modules\builders\guided-selections\[projectId].js` | DELETE CANDIDATE | Imports selection budget helper, Product Library constants, checklist/workspace/summary/admin components, Supabase, and router. Uses `builder_selection_checklist_items`, `builder_selection_sessions`, `builder_client_selections`, `builder_selection_budget_settings`. | MODIFY INSTEAD | Dynamic project route should not 404 unexpectedly; retire in place and remove legacy imports/data loading. | `/modules/builders/guided-selections/[projectId]` | High |
| `D:\dev\funnel-builder-clean\pages\modules\builders\selections-book.js` | DELETE CANDIDATE | Imported dynamically by `components/estimate-builder/EstimateBuilderWorkbook.js`; direct route; imports Product Library image/link components and writes `builder_selection_books`/`builder_client_selections`. | MODIFY INSTEAD | Estimate Builder and direct route dependency make hard delete unsafe; retire in place and remove Estimate Builder embedding. | `/modules/builders/selections-book`, Estimate Builder dynamic import | High |
| `D:\dev\funnel-builder-clean\pages\modules\builders\inclusions-schedule\[projectId].js` | DELETE CANDIDATE | Direct route pushed by Guided Selections; calls `/api/builders/inclusions-schedule`; imports Product Library `money`, `useWorkspace`, Supabase. | MODIFY INSTEAD | Retire in place to avoid 404 while stopping API calls and legacy data reads. | `/modules/builders/inclusions-schedule/[projectId]` | Medium/high |
| `D:\dev\funnel-builder-clean\pages\api\builders\inclusions-schedule.js` | DELETE CANDIDATE | Called by retired schedule page; imports `withWorkspace`, `supabaseAdmin`, `selectionBudget`; reads/writes `builder_inclusions_schedules` and `builder_client_selections`; writes storage PDFs. | MODIFY INSTEAD | Return a retired API response without auth/data/storage side effects; hard delete could break direct callers with opaque 404s. | `/api/builders/inclusions-schedule` | High |
| `D:\dev\funnel-builder-clean\components\product-library\SelectionChecklistNav.jsx` | DELETE CANDIDATE | Imported only by Guided Selections route. No shared Product Library route imports found. | DELETE | Legacy-only component once Guided route is retired. | Former import from Guided Selections | Low/medium |
| `D:\dev\funnel-builder-clean\components\product-library\GuidedSelectionWorkspace.jsx` | DELETE CANDIDATE | Imported only by Guided Selections route. Uses shared Product Library display helpers but is not used by the Product Library itself. | DELETE | Legacy-only guided selections component. | Former import from Guided Selections | Medium |
| `D:\dev\funnel-builder-clean\components\product-library\RunningSelectionsSummary.jsx` | DELETE CANDIDATE | Imported only by Guided Selections route. Contains legacy schedule/client-selections navigation callbacks. | DELETE | Legacy-only summary/control component. | Former import from Guided Selections | Medium |
| `D:\dev\funnel-builder-clean\components\product-library\ChecklistAdminPanel.jsx` | DELETE CANDIDATE | Imported only by Guided Selections route. Parent route performs table writes. | DELETE | Legacy-only checklist admin UI. | Former import from Guided Selections | Medium |
| `D:\dev\funnel-builder-clean\scripts\test-guided-selections-workflow.mjs` | DELETE CANDIDATE | References Guided Selections route, checklist components, selection migration and `selectionBudget`; no package script reference found. | DELETE | Test proves the retired legacy workflow and would fail after isolation. | Manual test script | Low |
| `D:\dev\funnel-builder-clean\scripts\test-selections-book-focus-mode-width.mjs` | DELETE CANDIDATE | References Selections Book source; no package script reference found. | DELETE | Test proves retired Selections Book UI. | Manual test script | Low |
| `D:\dev\funnel-builder-clean\docs\client-selections-stage1-deletion-report.md` | DELETE CANDIDATE | Historical doc only; no imports. Relevant context preserved in audit and removal docs. | DELETE | Legacy transition doc superseded by audit/removal records. | Documentation only | Low |

## Shared Files Retained Or Modified Carefully

- `components/estimate-builder/EstimateBuilderWorkbook.js`: MODIFY CAREFULLY to remove the dynamic Selections Book import, the active `clientSelections` render, and the launch card. Preserve Estimate Builder, Product Library, Project Estimate, Standard Inclusions, approvals, RFIs, documents, and quote functionality.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`: MODIFY CAREFULLY to remove the active `clientSelections` workbook page registration only. Preserve workbook state and all other sheets.
- `pages/modules/construction/index.js`: MODIFY CAREFULLY to replace the Product Library-as-Client-Selections card with a disabled `Inclusions & Selections — Rebuilding` entry and keep Product Library available through Estimate Builder/product routes.
- `pages/modules/builders/document-vault.js`: MODIFY CAREFULLY to remove the legacy route link while preserving existing document relation data and document workflows.
- `pages/modules/builders/rfis.js`: MODIFY CAREFULLY to remove the legacy route link while preserving existing RFI selection relations/data.
- `pages/modules/builders/quote-approvals.js`: MODIFY CAREFULLY to remove the legacy route link while preserving approvals and stored relation data.
- Product Library files/APIs/helpers/constants: RETAIN. No database or catalogue cleanup in this task.
- Deployed migration files: RETAIN. No migration history rewrite.

## Uncertain Dependencies

All seven uncertain items from the audit are `DEFERRED — REQUIRES LATER REVIEW`.

- `supabase/migrations/20260706_builder_selection_templates_prepopulation.sql`: deployed migration/history; further evidence needed from live DB/template usage before cleanup.
- `supabase/migrations/20260706_builder_inclusion_templates.sql`: deployed migration/history; further evidence needed from live Standard/Builder inclusion template usage.
- `supabase/migrations/20260725_product_library_selection_tiers.sql`: deployed migration/history; further Product Library pricing ownership review needed.
- `supabase/migrations/20260726_client_selections_library.sql`: deployed migration/history; further Product Library schema/data review needed.
- `supabase/migrations/20260729_client_selections_top_down_stage1.sql`: deployed migration/history; live data inventory needed before cleanup.
- `scripts/test-client-selections-library.mjs`: mixed Product Library and legacy Client Selections assertions; needs split before removal.
- `scripts/test-selection-budget-manager.mjs`: depends on `selectionBudget`, which still provides shared money helpers used by Product Library APIs/helpers.
