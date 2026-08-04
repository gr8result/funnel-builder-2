# Selections Legacy Audit

Date: 2026-07-29

Scope: read-only audit of the current Inclusions and Selections implementation in `D:\dev\funnel-builder-clean`. This audit intentionally does not delete, move, rename, or modify application code, packages, migrations, or database state.

## Method

- Searched repository content and paths for selections/inclusions terms, active routes, APIs, storage keys, migrations, tests, imports, and navigation.
- Inspected concrete import/export relationships before classifying files.
- Treated generic UI text selection, Standard Inclusions document copy, Document Engine object selection, Gantt task wording, and construction-estimation allowance labels as out of scope unless they route into the legacy Client Selections data model.

## Executive Summary

The old selections implementation is not isolated. It has three active UI surfaces and one schedule/PDF API that directly use `builder_client_selections`, plus shared links and references from Estimate Builder, Product Library, Document Vault, RFIs, Quote Approvals, and live-project conversion.

The replacement can safely isolate the old implementation only after:

- removing or replacing active routes and Estimate Builder embedded navigation,
- migrating or preserving data referenced by `builder_client_selections`,
- replacing Product Library selection-specific coupling without breaking the product/supplier/brand catalogue,
- handling foreign-key-like references from documents, RFIs, approvals, and generated schedules.

## Active Routes And APIs

| Route/API | File | Status | Notes |
|---|---|---|---|
| `/modules/builders/client-selections` | `pages/modules/builders/client-selections.js` | Active | Stage 1 top-down project/room/group UI. Persists to localStorage and `builder_selection_sessions.metadata.client_selections_top_down_stage1`. |
| `/modules/builders/guided-selections/[projectId]` | `pages/modules/builders/guided-selections/[projectId].js` | Active | Guided appointment workflow. Writes `builder_client_selections`, sessions, checklist, and budget totals. |
| `/modules/builders/selections-book` | `pages/modules/builders/selections-book.js` | Active | Selections book builder/review UI. Embedded in Estimate Builder and route-accessible directly. Writes `builder_selection_books` and imports rows to `builder_client_selections`. |
| `/modules/builders/inclusions-schedule/[projectId]` | `pages/modules/builders/inclusions-schedule/[projectId].js` | Active | Client schedule preview/signing page. Calls `/api/builders/inclusions-schedule`. |
| `/api/builders/inclusions-schedule` | `pages/api/builders/inclusions-schedule.js` | Active | Generates/saves schedule versions from selected/approved `builder_client_selections`. |
| `/modules/builders/product-library` | `pages/modules/builders/product-library.js` | Active shared | Product/supplier/brand catalogue, currently branded as Client Selections Library. |
| `/api/product-library/products` | `pages/api/product-library/products.js` | Active shared | Product CRUD; checks `builder_client_selections` before deletion. |
| `/api/product-library/import-preview` | `pages/api/product-library/import-preview.js` | Active shared | Import validation for Product Library CSV; enforces `CLIENT_SELECTION`/`BOTH`. |
| `/api/product-library/import-commit` | `pages/api/product-library/import-commit.js` | Active shared | Product Library import writer; normalizes selection-scoped products. |
| `/api/product-library/list` | `pages/api/product-library/list.js` | Active shared | Product Library list endpoint used by the catalogue/import surfaces. |
| `/api/product-library/bulk-update` | `pages/api/product-library/bulk-update.js` | Active shared | Product bulk updates including selection availability/scope fields. |
| `/api/builders/convert-to-live-project` | `pages/api/builders/convert-to-live-project.js` | Active shared | Preflight includes `builder_client_selections` and reports `selection_count`. |

## Database Tables, Views, And Migration Risks

### Tables And Views Involved

- `client_selections`: older builder-estimating backbone table.
- `builder_client_selections`: main commercial Client Selections record table.
- `builder_selection_books`: saved Selections Book documents.
- `builder_selection_sessions`: selection workflow session state and totals.
- `builder_selection_categories`: session categories.
- `builder_selection_history`: selection audit/history records.
- `builder_selection_budget_settings`: budget/markup/commission/admin/wastage settings.
- `builder_selection_items`: view over `builder_client_selections`.
- `builder_selection_checklist_items`: guided workflow checklist.
- `builder_inclusions_schedules`: generated schedule versions/signatures/PDF URLs.
- `builder_client_selection_legacy_backups`: backup of legacy `builder_client_selections` rows.
- `builder_project_areas`: Stage 1 top-down project areas.
- `builder_room_groups`: Stage 1 top-down room groups.
- `builder_area_templates`: Stage 1 area templates.
- `builder_template_assignments`: Stage 1 area/group template assignments.
- `builder_selection_categories_stage1`: Stage 1 category definitions.
- `builder_group_selections`: Stage 1 group-level selections.
- `builder_room_selection_overrides`: Stage 1 room-specific overrides.
- `builder_project_selection_snapshots`: Stage 1 snapshots.
- Shared Product Library tables touched by selection migrations: `builder_products`, `builder_product_categories`, `builder_product_manufacturers`, `builder_product_suppliers`.
- Shared document/workflow references: `builder_project_documents.related_table/related_record_id`, `builder_rfis.client_selection_id`, `builder_quote_approvals.metadata.relatedSelectionId`.

### Deployed Migration Files Involved

| Migration | Treatment | Risk |
|---|---|---|
| `supabase/migrations/20260705_builder_estimating_backbone_stage1.sql` | KEEP | Historical migration creates older `client_selections`; do not edit deployed history. |
| `supabase/migrations/20260705_estimate_builder_commercial_backbone_stage1.sql` | KEEP | Creates `builder_client_selections`; shared commercial backbone also creates projects, BOQ, variations, docs, RFIs. |
| `supabase/migrations/20260706_builder_selection_books.sql` | KEEP | Creates `builder_selection_books`; removing table later risks saved books. |
| `supabase/migrations/20260706_builder_selection_templates_prepopulation.sql` | KEEP | Inclusions template migration with selection-template naming overlap; appears tied to Standard/Builder inclusions, not exclusively old Client Selections UI. |
| `supabase/migrations/20260706_builder_inclusion_templates.sql` | KEEP | Inclusions templates; preserve until Standard Inclusions ownership is confirmed. |
| `supabase/migrations/20260711_selection_budget_manager.sql` | KEEP | Adds selection budget tables, functions, RLS, and `builder_selection_items` view. |
| `supabase/migrations/20260725_product_library_selection_tiers.sql` | KEEP / MODIFY CAREFULLY in future migration | Adds Product Library pricing tier fields and selection financial columns; shared Product Library risk. |
| `supabase/migrations/20260726_client_selections_library.sql` | KEEP / MODIFY CAREFULLY in future migration | Extends `builder_products`/categories and creates `builder_inclusions_schedules`; shared catalogue risk. |
| `supabase/migrations/20260728_client_selections_media_links.sql` | KEEP / MODIFY CAREFULLY in future migration | Adds media/source/verification fields to `builder_products`; useful outside Client Selections. |
| `supabase/migrations/20260729_guided_selections_workflow.sql` | KEEP / future cleanup migration only | Adds checklist table and category control type; seeded data may be legacy-only. |
| `supabase/migrations/20260729_client_selections_top_down_stage1.sql` | KEEP / future cleanup migration only | Creates Stage 1 replacement tables/backups; do not delete deployed migration. |

## Persistence Keys

| Key | File | Purpose | Treatment |
|---|---|---|---|
| `client_selections_top_down_stage1` | `pages/modules/builders/client-selections.js` | localStorage cache and `builder_selection_sessions.metadata` payload for Stage 1 top-down UI. | DELETE CANDIDATE with route, but data migration risk. |
| `gr8:guidedSelections:summaryCollapsed` | `pages/modules/builders/guided-selections/[projectId].js` | Guided selections summary panel collapse state. | DELETE CANDIDATE. |
| `gr8:selectionsBook:sidebarCollapsed` | `pages/modules/builders/selections-book.js` | Selections Book sidebar collapse state. | DELETE CANDIDATE. |
| `gr8:selectionsBook:detailsPanelCollapsed` | `pages/modules/builders/selections-book.js` | Selections Book details panel collapse state. | DELETE CANDIDATE. |
| `product_library_view_mode` | `lib/product-library/constants.js`, `pages/modules/builders/product-library.js` | Product Library view preference. | KEEP if Product Library remains. |
| `clientSelections` | `hooks/estimate-builder/useEstimateBuilderWorkbook.js`, `components/estimate-builder/EstimateBuilderWorkbook.js` | Estimate Builder workbook page key, not localStorage itself. | MODIFY CAREFULLY. |

## File Classification

### DELETE CANDIDATE

| Complete path | Purpose | Relevant exports | Imports | Imported by | Active/abandoned | Proposed treatment | Risk |
|---|---|---|---|---|---|---|---|
| `D:\dev\funnel-builder-clean\pages\modules\builders\client-selections.js` | Stage 1 Client Selections project/area/room/group setup UI. | `BuilderClientSelectionsPage` default, `disableLayout`. | `next/head`, React, `useWorkspace`, `supabase`. | Route, links from RFIs/Approvals/Document Vault/Guided/Selections Book. | Active. | Delete/replace route after replacement exists. | High: active links, session metadata, localStorage key, preserved legacy table references. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\guided-selections\[projectId].js` | Guided client selections appointment workspace. | `GuidedSelectionsPage` default. | `next/head`, `next/link`, router, React, `useWorkspace`, `supabase`, `selectionBudget`, Product Library constants, checklist/workspace/summary/admin components. | Next route; linked from product/selection workflows. | Active. | Delete/replace after new room-first workflow exists. | High: writes active selections and session budget totals. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\selections-book.js` | Selections Book / Inclusions & Selections Schedule builder, office review, print-style document. | `BuilderSelectionsBookPage` default plus internal helpers. | `next/head`, `next/link`, React, Lucide, `useWorkspace`, `defaultTemplateBrand`, `supabase`, Product Library image/link components, `useNavCollapse`. | Direct route and dynamic import from Estimate Builder. | Active. | Delete/replace document surface after Estimate Builder integration is removed. | High: embedded in Estimate Builder and writes `builder_selection_books`/`builder_client_selections`. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\inclusions-schedule\[projectId].js` | Schedule preview/signing page for selected Client Selections. | `InclusionsSchedulePage` default. | `next/head`, router, React, `useWorkspace`, `supabase`, `money`. | Next route; pushed from Guided summary. | Active. | Delete/replace generated schedule UI. | Medium/high: public document URLs/signatures may exist. |
| `D:\dev\funnel-builder-clean\pages\api\builders\inclusions-schedule.js` | API to fetch/generate/sign schedule versions from Client Selections. | `withWorkspace(handler)` default. | `withWorkspace`, `supabaseAdmin`, `selectionBudget`. | Schedule page. | Active. | Delete/replace API once new document generator exists. | High: writes storage PDFs and `builder_inclusions_schedules`. |
| `D:\dev\funnel-builder-clean\components\product-library\SelectionChecklistNav.jsx` | Guided selections left checklist. | Default component. | React `useMemo`. | Guided selections page. | Active through guided route only. | Delete with guided route. | Low/medium: exclusive UI component. |
| `D:\dev\funnel-builder-clean\components\product-library\GuidedSelectionWorkspace.jsx` | Guided product choice workspace. | Default component. | React, Lucide `Check`, Product Library link/image helpers, Product Library money helpers. | Guided selections page. | Active through guided route only. | Delete with guided route unless reused by replacement. | Medium: depends on Product Library product rendering. |
| `D:\dev\funnel-builder-clean\components\product-library\RunningSelectionsSummary.jsx` | Guided selections totals/finalise/schedule panel. | Default component. | Lucide, `money`. | Guided selections page. | Active through guided route only. | Delete with guided route. | Medium: route navigation to schedule/client-selections. |
| `D:\dev\funnel-builder-clean\components\product-library\ChecklistAdminPanel.jsx` | Admin CRUD for required selections checklist. | Default component. | React. | Guided selections page. | Active through guided route only. | Delete with guided route/checklist table. | Medium: writes `builder_selection_checklist_items` via parent callbacks. |
| `D:\dev\funnel-builder-clean\scripts\test-guided-selections-workflow.mjs` | Regression checks for guided workflow, checklist, components, migration. | Script. | Node `fs`, `assert`, `selectionBudget`. | `npm`/manual script. | Active test asset. | Delete when workflow is removed. | Low: test-only, but useful until replacement is proven. |
| `D:\dev\funnel-builder-clean\scripts\test-selections-book-focus-mode-width.mjs` | Regression check for Selections Book focus/sidebar layout. | Script. | Node `fs`, `assert`. | Manual/script. | Active test asset. | Delete with Selections Book. | Low. |
| `D:\dev\funnel-builder-clean\docs\client-selections-stage1-deletion-report.md` | Prior report documenting old flat product-first removal and Stage 1 persistence. | Documentation. | None. | Not imported. | Apparently historical. | Delete/archive after migration record is captured elsewhere. | Low, except it explains legacy data intent. |

### MODIFY CAREFULLY

| Complete path | Purpose | Relevant exports | Imports | Imported by | Active/abandoned | Proposed treatment | Risk |
|---|---|---|---|---|---|---|---|
| `D:\dev\funnel-builder-clean\components\estimate-builder\EstimateBuilderWorkbook.js` | Main Estimate Builder workbook; embeds Selections Book as `clientSelections`; exports selections CSV bridge. | `USE_NEW_TAKEOFF_ENGINE`, default `EstimateBuilderWorkbook`, `ClientPageSheet`, `StandardInclusionsSheet`. | Many Estimate Builder/Standard Inclusions modules plus dynamic import of `pages/modules/builders/selections-book`. | Estimate Builder route/components. | Active, heavily shared. | Remove/replace `clientSelections` page, dynamic import, CSV bridge fields only after replacement contract is known. | Very high: central workbook file; unrelated Standard Inclusions and proposal code nearby. |
| `D:\dev\funnel-builder-clean\hooks\estimate-builder\useEstimateBuilderWorkbook.js` | Estimate Builder workbook state model; includes Product Library and Client Selections sheet keys and quote row selection fields. | `useEstimateBuilderWorkbook`. | Estimate calculation/default/schema modules, Standard Inclusions normalizers. | `EstimateBuilderWorkbook.js`. | Active shared hook. | Remove/replace only the `clientSelections` sheet registration and obsolete selection row fields with tests. | Very high: large state/persistence surface. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\product-library.js` | Product Library UI currently branded as Client Selections Library with suppliers/brands/categories/products/import/export. | `BuilderProductLibraryPage` default. | Product Library components/helpers/constants, `useWorkspace`, `useAuth`, `supabase`. | Route, Construction Hub, Estimate Builder product surface conceptually. | Active shared. | Preserve catalogue; carefully remove old selections-specific wording/filters only if replacement changes ownership. | High: shared Product/Supplier Library integration. |
| `D:\dev\funnel-builder-clean\components\product-library\ProductLibraryToolbar.jsx` | Product Library toolbar/filter UI. | `ProductLibraryToolbar`, `ProductLibraryFilters`. | Product Library constants. | `product-library.js`. | Active shared. | Reword/scope filters carefully if Client Selections Library is replaced. | Medium: UI wording/filter semantics are selection-specific. |
| `D:\dev\funnel-builder-clean\components\product-library\ProductLibraryTable.jsx` | Product Library table renderer. | Component exports in file. | Product Library helpers/components. | `product-library.js`. | Active shared. | Preserve unless replacement removes catalogue feature. | Medium: may display selection scope/tier fields. |
| `D:\dev\funnel-builder-clean\components\product-library\ProductLibraryCards.jsx` | Product Library card/tree renderer. | Component exports in file. | Product Library helpers/components. | `product-library.js`. | Active shared. | Preserve unless replacement removes catalogue feature. | Medium. |
| `D:\dev\funnel-builder-clean\components\product-library\ProductDetailDrawer.jsx` | Product detail/edit drawer with suppliers, brands, images, selection availability fields. | Component exports in file. | Product Library image/link helpers/constants. | `product-library.js`. | Active shared. | Preserve; remove selection-specific fields only with Product Library schema plan. | High: product CRUD/edit surface. |
| `D:\dev\funnel-builder-clean\components\product-library\ProductImagePicker.jsx` | Product image upload/picker UI. | Component exports in file. | Product Library/media utilities. | Product detail/import surfaces. | Active shared. | Preserve. | Medium: product images are needed outside legacy selections. |
| `D:\dev\funnel-builder-clean\components\product-library\ProductAdditionalImages.jsx` | Additional product image management. | Component exports in file. | Product Library helpers. | Product detail surface. | Active shared. | Preserve. | Medium. |
| `D:\dev\funnel-builder-clean\components\product-library\ProductImageMagnifier.jsx` | Product image viewer/magnifier. | Component exports in file. | React. | Product Library, Guided Workspace, Selections Book. | Active shared. | Preserve or move to shared product UI before deleting legacy imports. | Medium. |
| `D:\dev\funnel-builder-clean\components\product-library\ExternalProductLink.jsx` | External product/source link renderer. | Component exports in file. | React. | Product Library, Guided Workspace, Selections Book. | Active shared. | Preserve or move to shared product UI. | Low/medium. |
| `D:\dev\funnel-builder-clean\lib\product-library\constants.js` | Product Library pricing tiers, scopes, category groups, roles, table columns, storage key. | `PRICE_BANDS`, `PRICING_MODES`, `LIBRARY_SCOPES`, `PRODUCT_LIBRARY_SCOPES`, `QUOTATION_BUILDER_SCOPES`, `PRICING_TIERS`, `normalizePricingTier`, `tierAccess`, category sets, `VIEW_MODE_STORAGE_KEY`, roles, groups, columns. | None. | Product Library UI/API, Guided Selections. | Active shared. | Preserve; split selection-specific constants from generic Product Library later. | High: shared estimating/product behaviour. |
| `D:\dev\funnel-builder-clean\lib\product-library\helpers.js` | Product Library money/search/scope/upgrade helpers. | `money`, `downloadCsv`, `computeSellPrice`, `isMissingRequiredImage`, `productSearchText`, `categoryKey`, `scopeForProduct`, `computeUpgradeValue`, `effectiveUpgradeValue`, `useDebouncedValue`, etc. | React, `selectionBudget.roundMoney`, Product Library constants, CSV helper. | Product Library UI, Guided Workspace, schedule page. | Active shared. | Preserve; replace `roundMoney` dependency if `selectionBudget.js` is removed. | High: deleting `selectionBudget.js` breaks Product Library. |
| `D:\dev\funnel-builder-clean\lib\builders\selectionBudget.js` | Selection financial/budget calculation helpers. Also provides generic `roundMoney`/`numberValue`. | `DEFAULT_WARNING_THRESHOLD_PERCENT`, `SELECTION_BUDGET_STATUSES`, `CLIENT_SELECTION_STATUSES`, `SELECTION_CATEGORIES`, `roundMoney`, `numberValue`, `calculateClientSelectionPrice`, `calculateSelectionFinancials`, `calculateBudgetStatus`, `calculateSessionBudget`, `calculateSelectionVariation`, `clientPriceImpactLabel`, `buildSelectionSnapshot`, `hasActiveDraftVariation`. | None. | Guided route, schedule API, Product Library helpers/API, tests. | Active shared-by-contamination. | Do not delete until `roundMoney`/`numberValue` and any Product Library pricing helpers are moved/replaced. | High: current Product Library APIs import it. |
| `D:\dev\funnel-builder-clean\pages\api\product-library\products.js` | Product CRUD API; archives products referenced by selections instead of deleting. | `withWorkspace(handler)` default. | `withWorkspace`, `supabaseAdmin`, `roundMoney`, Product Library constants. | Product Library page. | Active shared. | Preserve; revise deletion/reference logic when new selections data model exists. | High: Product Library delete semantics depend on old table. |
| `D:\dev\funnel-builder-clean\pages\api\product-library\import-commit.js` | Product Library CSV import commit. | `withWorkspace(handler)` default. | `withWorkspace`, `supabaseAdmin`, CSV helpers, Product Library constants, `roundMoney`, URL validation. | Product Library page/import workflow. | Active shared. | Preserve; change accepted scopes/fields only with catalogue plan. | High. |
| `D:\dev\funnel-builder-clean\pages\api\product-library\import-preview.js` | Product Library CSV import preview/validation. | API default. | CSV/url/constants helpers. | Product Library import workflow. | Active shared. | Preserve; revise `CLIENT_SELECTION` assumptions carefully. | Medium/high. |
| `D:\dev\funnel-builder-clean\pages\api\product-library\list.js` | Product Library list endpoint. | API default. | Product Library/shared API helpers. | Product Library UI/imports. | Active shared. | Preserve. | Medium. |
| `D:\dev\funnel-builder-clean\pages\api\product-library\bulk-update.js` | Product Library bulk update endpoint. | API default. | Workspace/admin helpers. | Product Library page. | Active shared. | Preserve; audit selection-scope field handling during replacement. | Medium/high. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\document-vault.js` | Shared document vault with optional related selection links. | `BuilderDocumentVaultPage` default. | `next/head`, `next/link`, React, `useWorkspace`, `supabase`. | Route. | Active shared. | Remove/replace selection relation options only after data migration. | High: document rows can point at `builder_client_selections`. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\rfis.js` | Shared RFI module with optional `client_selection_id`. | `BuilderRfisPage` default. | `next/head`, `next/link`, React, `useWorkspace`, `supabase`. | Route. | Active shared. | Replace selection references/FK usage with new model. | High: RFI records may reference old selections. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\quote-approvals.js` | Quote approvals with `selection_approval` type and selection relation. | `BuilderQuoteApprovalsPage` default. | `next/head`, `next/link`, React, `useWorkspace`, `supabase`. | Route. | Active shared. | Replace related-selection workflow carefully. | High: approvals may refer to old selection rows. |
| `D:\dev\funnel-builder-clean\pages\api\builders\convert-to-live-project.js` | Converts commercial estimate/project snapshot into live project; counts selections. | `withWorkspace(handler)` default. | `supabaseAdmin`, `withWorkspace`. | Conversion/preflight callers. | Active shared. | Remove/update selection count and warnings when new model lands. | Medium/high: may break project conversion summaries. |
| `D:\dev\funnel-builder-clean\pages\modules\builders\convert-to-live-project.js` | UI for convert-to-live-project preflight, including Selections metric. | Page default. | Builder route dependencies. | Route. | Active shared. | Update metric and copy with new model. | Medium. |
| `D:\dev\funnel-builder-clean\pages\modules\construction\index.js` | Construction hub/dashboard card linking Product Library as Client Selections Library. | `ConstructionHub` default. | `next/link`, `next/head`, React, Auth/developer bypass helpers. | Route. | Active shared. | Update navigation copy/link after Product Library/replacement routing is decided. | Medium. |
| `D:\dev\funnel-builder-clean\components\Layout.js` | Global layout; includes nav collapse helper referenced by Selections Book tests/comments. | `useNavCollapse` and default layout exports. | App layout dependencies. | Many pages, Selections Book imports `useNavCollapse`. | Active shared. | Preserve; only remove obsolete comment/test expectations later. | High if modified broadly. |
| `D:\dev\funnel-builder-clean\package.json` | Script registry includes client selections test script. | `scripts.test:client-selections-library`. | N/A. | npm scripts. | Active config. | Remove only obsolete selections scripts later. | Medium: package metadata shared. |

### KEEP

| Complete path | Purpose | Relevant exports | Imports | Imported by | Active/abandoned | Proposed treatment | Risk |
|---|---|---|---|---|---|---|---|
| `D:\dev\funnel-builder-clean\components\standard-inclusions\StandardInclusionsDocument.jsx` | Standard Inclusions document renderer; includes a "Selections Process" page as document copy. | Standard Inclusions document component. | Standard Inclusions page components/data. | Standard Inclusions/Estimate Builder surfaces. | Active separate module. | KEEP. | High if confused with Client Selections. |
| `D:\dev\funnel-builder-clean\components\standard-inclusions\standardInclusionsData.js` | Standard Inclusions content data. | Standard Inclusions data exports. | None. | Standard Inclusions document/preview. | Active separate module. | KEEP. | Medium/high: wording overlaps but data model differs. |
| `D:\dev\funnel-builder-clean\components\standard-inclusions\pages\Page06SelectionsProcess.jsx` | Static Standard Inclusions "Selections Process" page. | Default page component. | Standard Inclusions styles/data. | `StandardInclusionsDocument.jsx`. | Active separate module. | KEEP. | Medium if removed by name match only. |
| `D:\dev\funnel-builder-clean\lib\builders\standardInclusions.js` | Standard Inclusions normalizer/content helpers. | Standard Inclusions exports. | None/standard builder helpers. | Estimate Builder/Standard Inclusions. | Active separate module. | KEEP. | High: replacement should not disrupt DOCX/PDF Standard Inclusions work. |
| `D:\dev\funnel-builder-clean\components\estimate-builder\standard-inclusions\StandardInclusionsPreview.jsx` | Estimate Builder Standard Inclusions preview. | Component exports. | Standard Inclusions data. | Estimate Builder. | Active separate module. | KEEP. | Medium. |
| `D:\dev\funnel-builder-clean\components\estimate-builder\standard-inclusions\PremierInclusionsCanvasEditor.jsx` | Editable Standard Inclusions canvas/editor; has "Selections Process" copy. | Component exports. | Fabric/canvas helpers. | Estimate Builder Standard Inclusions. | Active separate module. | KEEP. | Medium/high due file size and unrelated importer work. |
| `D:\dev\funnel-builder-clean\components\document-engine\templates\standardInclusionsTemplate.js` | Document Engine Standard Inclusions template text. | Template exports. | Document Engine helpers. | Document Engine/Estimate Builder. | Active separate module. | KEEP. | Medium. |
| `D:\dev\funnel-builder-clean\lib\construction-estimation\estimateWorksheetV2Schema.js` | Construction estimation schema with `clientSelections` text field. | Schema exports. | Construction estimation helpers. | Estimate calculations/workbook legacy schema. | Active/legacy shared. | KEEP unless separate estimation schema migration is planned. | Medium. |
| `D:\dev\funnel-builder-clean\lib\construction-estimation\estimateInputSchema.js` | Estimation input schema with allowance/selections quantity fields. | Schema exports. | Estimation helpers. | Estimation modules. | Active shared. | KEEP. | Medium. |
| `D:\dev\funnel-builder-clean\lib\construction-estimation\estimateInputDefaults.js` | Estimation defaults for allowances/selections counts. | Default input exports. | Estimation helpers. | Estimation modules. | Active shared. | KEEP. | Low/medium. |
| `D:\dev\funnel-builder-clean\lib\construction-estimation\detailedQuantityEngine.js` | Quantity engine reads allowance selection counts. | Calculation exports. | Estimation schema helpers. | Estimation modules. | Active shared. | KEEP. | Medium. |
| `D:\dev\funnel-builder-clean\pages\modules\gantt\[id].js` | Gantt task template with "Final Selections & Variations" text. | Page default. | Gantt dependencies. | Route. | Active unrelated text. | KEEP. | Low. |
| `D:\dev\funnel-builder-clean\components\document-engine\DOCUMENT_ENGINE_ARCHITECTURE.md` | Architecture doc mentions future/related Client Selections Book. | Documentation. | None. | Not imported. | Informational. | KEEP or update documentation later. | Low. |

### UNCERTAIN

| Complete path | Purpose | Relevant exports | Imports | Imported by | Active/abandoned | Proposed treatment | Risk |
|---|---|---|---|---|---|---|---|
| `D:\dev\funnel-builder-clean\supabase\migrations\20260706_builder_selection_templates_prepopulation.sql` | Creates/prepopulates builder inclusion template tables despite "selection templates" filename. | Migration. | N/A. | Supabase migration history. | Deployed/history. | Preserve; confirm whether any live template rows are used before cleanup. | Medium: naming overlap with Standard Inclusions. |
| `D:\dev\funnel-builder-clean\supabase\migrations\20260706_builder_inclusion_templates.sql` | Creates builder inclusion template tables. | Migration. | N/A. | Supabase migration history. | Deployed/history. | Preserve; investigate ownership before replacement DB work. | Medium. |
| `D:\dev\funnel-builder-clean\supabase\migrations\20260725_product_library_selection_tiers.sql` | Selection tier/pricing migration across Product Library, projects, budget settings, selections. | Migration. | N/A. | Supabase migration history. | Deployed/history. | Preserve; future cleanup must be additive/reversible. | High: shared Product Library fields. |
| `D:\dev\funnel-builder-clean\supabase\migrations\20260726_client_selections_library.sql` | Product Library client-selection extension plus `builder_inclusions_schedules`. | Migration. | N/A. | Supabase migration history. | Deployed/history. | Preserve; decide which product columns survive replacement. | High. |
| `D:\dev\funnel-builder-clean\supabase\migrations\20260729_client_selections_top_down_stage1.sql` | Stage 1 top-down replacement tables and legacy backups. | Migration. | N/A. | Supabase migration history. | Deployed/history. | Preserve; likely future migration needs data inventory first. | High. |
| `D:\dev\funnel-builder-clean\scripts\test-client-selections-library.mjs` | Broad Product Library + Client Selections regression script. | Script. | Node, `selectionBudget`, migrations/pages. | `package.json` script. | Active test asset. | Split before deletion: Product Library assertions may remain useful. | Medium. |
| `D:\dev\funnel-builder-clean\scripts\test-selection-budget-manager.mjs` | Budget helper regression. | Script. | `selectionBudget`. | Manual/script. | Active test asset. | Delete only after budget helper is removed or replaced. | Medium. |

## Imports Into Old Selections System

- `components/estimate-builder/EstimateBuilderWorkbook.js` dynamically imports `../../pages/modules/builders/selections-book`.
- `pages/modules/builders/guided-selections/[projectId].js` imports `SelectionChecklistNav`, `GuidedSelectionWorkspace`, `RunningSelectionsSummary`, `ChecklistAdminPanel`, Product Library constants, and `selectionBudget`.
- `pages/modules/builders/selections-book.js` imports Product Library image/link components and `useNavCollapse`.
- `pages/api/builders/inclusions-schedule.js`, `pages/api/product-library/products.js`, and `pages/api/product-library/import-commit.js` import `roundMoney`/`numberValue` from `lib/builders/selectionBudget.js`.

## Other Modules Importing Or Referencing Selection Files/Data

- Estimate Builder embeds the Selections Book page as the `clientSelections` workbook page and exports `*-selections-bridge.csv`.
- Product Library APIs block hard deletion of products referenced in `builder_client_selections`.
- Document Vault reads selections and stores related document pointers to `builder_client_selections`.
- RFIs read selections and write `client_selection_id`.
- Quote Approvals expose a `selection_approval` type and read related selections.
- Convert-to-live-project preflight reads `builder_client_selections` and reports warnings/counts.
- Construction Hub links to `/modules/builders/product-library` with Client Selections Library copy.

## Estimate Builder Connections

- Workbook sheet list contains `{ key: "clientSelections", label: "Client Selections" }`.
- `EstimateBuilderWorkbook.js` maps `clientSelections` to title/subtitle and dynamically renders `selections-book`.
- Quotation rows include selection bridge fields: `selectionImageUrl`, `selectionSpec`, `selectionAllowanceAmount`, `selectionSelectedCost`, `selectionAdjustment`.
- CSV export helpers include `exportQuoteSelectionsCsv`, `quoteSelectionsCsvRows`, and selection-related columns such as `selection_status`, `selection_required`, `selection_type`.
- Product Library import/seed workflows are also surfaced inside Estimate Builder.

## Product And Supplier Library Connections

- `builder_products` is shared by Product Library, Selections Book product picker, and Guided Selections.
- `builder_product_categories` includes `selection_group`, `library_scope`, and `selection_control_type`.
- `builder_product_manufacturers` and `builder_product_suppliers` are loaded by Product Library, Guided Selections, and Selections Book.
- Product availability is controlled by `library_scope`, `available_for_selection`, `pricing_tier`, `standard_included`, image/media fields, verification fields, supplier URL, and manufacturer URL.
- Product delete/archive semantics depend on whether rows exist in `builder_client_selections`.

## Duplicate Or Competing Implementations

- `client_selections` is an older table from the builder-estimating backbone.
- `builder_client_selections` is the active commercial Client Selections table.
- `/modules/builders/client-selections` is not the old flat page according to `docs/client-selections-stage1-deletion-report.md`; it is a Stage 1 top-down UI that still stores data inside a session metadata key and preserves old product-first rows.
- `/modules/builders/guided-selections/[projectId]` is a separate active guided workflow that writes direct selection rows.
- `/modules/builders/selections-book` is a third active document/workbook implementation and also imports rows into `builder_client_selections`.
- `/modules/builders/inclusions-schedule/[projectId]` plus `/api/builders/inclusions-schedule` is a separate generated schedule/signature implementation.
- Standard Inclusions is a separate document/importer feature with overlapping language and should not be treated as the failed Client Selections implementation.

## Legacy Fallback Behaviour

- `client-selections.js` falls back to localStorage `client_selections_top_down_stage1` and demo project state if workspace/project data is absent.
- `client-selections.js` writes Stage 1 state into `builder_selection_sessions.metadata.client_selections_top_down_stage1`, while explicitly preserving old tables in metadata.
- `selections-book.js` reads builder/project/profile/estimate snapshot fields using multiple legacy key variants for project and builder details.
- `selections-book.js` imports generated book rows into `builder_client_selections` and stores `selection_book_id`/`selection_book_row_id` in row metadata.
- Product deletion archives instead of deleting when `builder_client_selections` references a product.

## Deletion Isolation Assessment

The legacy implementation can be isolated, but not by deleting only `pages/modules/builders/client-selections.js`. Active references are spread across routing, Estimate Builder embedding, Product Library APIs/helpers, documents, RFIs, approvals, conversion preflight, localStorage/session metadata, generated schedule storage, and deployed migrations.

Recommended isolation boundary for a future implementation phase:

1. Replace routes `/client-selections`, `/guided-selections/[projectId]`, `/selections-book`, and `/inclusions-schedule/[projectId]` together.
2. Remove the Estimate Builder `clientSelections` workbook page and CSV bridge only after the new selections/document workflow has an equivalent integration.
3. Preserve Product Library core while extracting/removing selection-specific scope, tier, availability, and delete-reference behaviour deliberately.
4. Add future database migrations rather than editing historical migrations.
5. Inventory live rows in all selection tables and related document/RFI/approval references before any destructive database cleanup.

## Counts

- Files investigated and classified in this audit: 45.
- Confirmed delete candidates: 12.
- Shared files that must be preserved or modified carefully: 26.
- Uncertain dependencies: 7.
- Deployed migration files involved: 11.
- Persistence keys identified: 6.

## Git Status At Audit Time

`git status --short` showed many pre-existing modified/untracked files unrelated to this audit, including website-builder, takeoff-v2, freedom-trader, standard-inclusions API, package metadata, and Supabase migration work. The only file intentionally created by this audit is:

- `docs/SELECTIONS_LEGACY_AUDIT.md`

No application code, package installation, or migration changes were performed.
