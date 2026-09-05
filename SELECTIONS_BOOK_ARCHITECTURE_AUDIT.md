# Selections Book Architecture Audit

Date: 2026-09-02

Scope: `pages/modules/builders/selections-book.js`

Mode: read-only audit of the active Client Selections / Cabinetry module architecture. No app source files were edited as part of this audit. The only artifact produced is this report.

## Executive Summary

`pages/modules/builders/selections-book.js` is a large, active production route module. It is not dead code. The active route `/modules/estimate-builder?page=clientSelections` dynamically loads this file through `components/estimate-builder/EstimateBuilderWorkbook.js`, then renders its default export, `BuilderSelectionsBookPage`.

Static inspection found:

| Metric | Count |
| --- | ---: |
| Total lines | 15,405 |
| Characters | 965,005 |
| Blank lines | 597 |
| Comment lines | 9 |
| Import lines | 7 |
| Top-level declarations | 417 |
| React component declarations found | 84 |
| Hook call sites found | 290 |
| `useState` call sites | 167 |
| `useMemo` call sites | 90 |
| `useEffect` call sites | 26 |
| `useRef` call sites | 7 |
| Styled JSX block | 1,186 lines |

This file has become a composite of several systems:

- Active route entry component and embedded workbook bridge.
- Project identity and selected job normalization.
- Supabase, workbook callback, and localStorage persistence.
- Guided workflow router for selections.
- Cabinetry selection workflow.
- Exterior colours, external lighting, driveway, garage, windows, entry door, brick, and roofing workflows.
- Static product/catalogue data.
- Final schedule/document generation and rendering.
- Print/PDF styling.
- Large inline CSS.

The safest extraction path is incremental. Start by moving static data and pure selectors into side-effect-free modules with snapshot tests, then move feature workflows one by one. Do not extract persistence first; it is the highest-risk boundary because it currently coordinates workbook callbacks, Supabase rows, embedded draft recovery, generated schedules, and project selection syncing.

## Active Route Proof

The active route path is:

```text
/modules/estimate-builder?page=clientSelections
  -> pages/modules/estimate-builder/index.js
  -> components/estimate-builder/EstimateBuilderWorkbook.js
  -> ClientSelectionsModuleHost
  -> dynamic import("../../pages/modules/builders/selections-book")
  -> default export BuilderSelectionsBookPage
```

Relevant proof points from the current codebase:

| File | Line | Evidence |
| --- | ---: | --- |
| `pages/modules/estimate-builder/index.js` | 7 | Reads `router.query.page`. |
| `pages/modules/estimate-builder/index.js` | 35 | Renders `EstimateBuilderWorkbook` with `initialPage`. |
| `components/estimate-builder/EstimateBuilderWorkbook.js` | 134 | Defines `loadCommercialClientSelectionsPage = () => import("../../pages/modules/builders/selections-book")`. |
| `components/estimate-builder/EstimateBuilderWorkbook.js` | 428 | Reads `router?.query?.page`. |
| `components/estimate-builder/EstimateBuilderWorkbook.js` | 1178 | Renders client selections host when `activePageKey === "clientSelections"`. |
| `components/estimate-builder/EstimateBuilderWorkbook.js` | 1350 | Defines `ClientSelectionsModuleHost`. |
| `components/estimate-builder/EstimateBuilderWorkbook.js` | 1376 | Calls the dynamic import loader. |
| `components/estimate-builder/EstimateBuilderWorkbook.js` | 1439 | Renders `<LoadedClientSelectionsPage {...moduleContext} embedded />`. |
| `pages/modules/builders/selections-book.js` | 1402 | Exports `BuilderSelectionsBookPage`. |

`pages/modules/builders/client-selections.js` is a separate standalone/legacy showroom-style page. It is not the active embedded workbook route for `/modules/estimate-builder?page=clientSelections`. The filename overlap is misleading and increases the risk of fixing the wrong module.

## File Size Breakdown

| Range | Lines | Percent | Responsibility |
| --- | ---: | ---: | --- |
| 1-117 | 117 | 0.8% | Imports and top-level setup |
| 118-900 | 783 | 5.1% | Static supplier/product config and local constants |
| 901-1401 | 501 | 3.3% | Generic utilities and project detail normalization |
| 1402-4455 | 3,054 | 19.8% | Main page orchestration, route state, persistence, rendering |
| 4456-4888 | 433 | 2.8% | Guided workflow router |
| 4889-6486 | 1,598 | 10.4% | Cabinetry workflow |
| 6487-7029 | 543 | 3.5% | Cabinetry UI/helpers |
| 7030-7438 | 409 | 2.7% | Exterior colour workflow |
| 7439-8009 | 571 | 3.7% | External lighting workflow |
| 8010-8421 | 412 | 2.7% | Driveway workflow |
| 8422-8573 | 152 | 1.0% | Garage workflow |
| 8574-8986 | 413 | 2.7% | Windows workflow |
| 8987-9726 | 740 | 4.8% | Entry door workflow |
| 9727-9849 | 123 | 0.8% | Brick workflow |
| 9850-10393 | 544 | 3.5% | Roofing workflow |
| 10394-11224 | 831 | 5.4% | Shared guided UI, modals, document components |
| 11225-12395 | 1,171 | 7.6% | Schedule/document generation UI and selectors |
| 12396-13963 | 1,568 | 10.2% | Guided selection selectors, storage helpers, catalogue helpers |
| 13964-14219 | 256 | 1.7% | Guided back navigation controller |
| 14220-15405 | 1,186 | 7.7% | Styled JSX CSS |

The three largest responsibilities are:

1. `BuilderSelectionsBookPage`, 3,054 lines.
2. `GuidedCabinetryWorkflow`, 1,598 lines.
3. Inline `styles`, 1,186 lines.

## Top-Level Symbol Inventory

The static declaration scan found 417 top-level declarations. The file is declaration-dense because it mixes page state, components, selectors, catalogue constants, normalizers, persistence helpers, and styling in one module.

### Largest Declarations

| Symbol | Starts | Approx. lines | Role |
| --- | ---: | ---: | --- |
| `BuilderSelectionsBookPage` | 1402 | 3,054 | Main page, embedded route adapter, project/persistence orchestration |
| `GuidedCabinetryWorkflow` | 4889 | 1,598 | Cabinetry domain workflow, room state, categories, swatches, finish records |
| `styles` | 14220 | 1,186 | Full page styled-jsx CSS |
| `GuidedSelectionsWorkflow` | 4456 | 433 | Workflow/category router and dashboard |
| `GuidedRoofingWorkflow` | 9850 | 423 | Roofing guided workflow |
| `GuidedEntryDoorWorkflow` | 8987 | 408 | Entry door guided workflow |
| `GuidedDrivewayWorkflow` | 8010 | 302 | Driveway guided workflow |
| `GuidedExteriorColourWorkflow` | 7085 | 276 | Exterior colour guided workflow |
| `handleGuidedBack` | 13964 | 256 | Cross-workflow back-navigation logic |
| `ENTRY_DOOR_FURNITURE_PRODUCTS` | 151 | 207 | Embedded static catalogue |
| `GuidedExternalLightingWorkflow` | 7439 | 180 | External lighting guided workflow |
| `BrickCatalogueImportModal` | 10512 | 155 | Catalogue import UI |
| `GuidedWindowsWorkflow` | 8574 | 147 | Windows guided workflow |
| `getSelectionsBookProjectDetails` | 1101 | 138 | Project identity/details normalization |
| `CoverSettingsPanel` | 10787 | 130 | Document cover settings UI |
| `WindowDefaultsStep` | 8758 | 127 | Window defaults state/edit UI |
| `GuidedGarageDoorWorkflow` | 8422 | 125 | Garage door guided workflow |
| `GuidedBrickWorkflow` | 9727 | 109 | Brick guided workflow |
| `normaliseDocumentBook` | 11849 | 103 | Document book normalizer |
| `selectionRecordPayload` | 12272 | 95 | Persistence payload builder |

### Static Data and Catalogue Declarations

| Range | Symbols |
| --- | --- |
| 118-150 | `CABINETRY_SUPPLIER_CONFIG` and supplier-level cabinetry config |
| 151-357 | `ENTRY_DOOR_FURNITURE_PRODUCTS` |
| 358-419 | `HUME_SAVOY_1200_XS26_GLASS_OPTIONS` |
| 420-522 | `DEFAULT_WINDOW_CONFIGURATION`, garage/window defaults and derived garage catalogue constants |
| 523-615 | `WINDOW_SUPPLIER_LIBRARY` |
| 616-659 | `DEFAULT_ROOMS`, `ROOM_TEMPLATES` |
| 660-767 | `PRODUCT_IMAGE_URLS`, `PRODUCT_OPTION_LIBRARY` |
| 768-844 | guided category cards and display metadata |
| 845-899 | cabinetry visible location/material/handle/feature options, wet-area cabinetry config, draft storage key |

### Utility and Project Normalization Declarations

| Range | Symbols / responsibility |
| --- | --- |
| 901-1099 | Formatting, ID, slug, path, room, product, and selection helpers |
| 1101-1238 | `getSelectionsBookProjectDetails` |
| 1239-1304 | Embedded project and workbook normalization helpers |
| 1305-1401 | Selection book extraction from embedded workbook/context |

### Page and Workflow Declarations

| Range | Symbols / responsibility |
| --- | --- |
| 1402-4455 | `BuilderSelectionsBookPage` |
| 4456-4888 | `GuidedSelectionsWorkflow` |
| 4889-6486 | `GuidedCabinetryWorkflow` |
| 6487-7029 | `GuidedCardGrid`, `CabinetrySelectionList`, `CabinetryWorkflowActions`, `CabinetrySwatchImage`, cabinetry image/swatch/finish helpers |
| 7030-7438 | `ExteriorWallConstructionSelector`, `GuidedImageCard`, `GuidedExteriorColourWorkflow`, exterior colour UI helpers |
| 7439-8009 | `GuidedExternalLightingWorkflow`, external lighting summary/draft/review/card helpers |
| 8010-8421 | `GuidedDrivewayWorkflow`, driveway swatch helpers |
| 8422-8573 | `GuidedGarageDoorWorkflow`, garage choice/colour helpers |
| 8574-8986 | `GuidedWindowsWorkflow`, window schedule/defaults/options/review helpers |
| 8987-9726 | `GuidedEntryDoorWorkflow`, glass/furniture/gallery/filter/detail helpers |
| 9727-9849 | `GuidedBrickWorkflow`, brick empty catalogue |
| 9850-10393 | `GuidedRoofingWorkflow`, roofing empty catalogue, accessory/progress helpers |
| 10394-10693 | shared guided rows, product cards, details modal, catalogue import modal, budget/status helpers |
| 10694-11224 | cover page, logo, project info, schedule divider/outstanding/acknowledgement/header/table/page/footer components |

### Schedule, Persistence, Selector, and Navigation Declarations

| Range | Symbols / responsibility |
| --- | --- |
| 11225-11748 | schedule row, section, product, room, and display selectors |
| 11749-11848 | `ProductSelector` and selector UI helpers |
| 11849-11951 | `normaliseDocumentBook` |
| 11952-12271 | document/schedule review and persisted project selection review helpers |
| 12272-12395 | `selectionRecordPayload` and persistence payload utilities |
| 12396-12554 | guided selections extraction and category selectors |
| 12555-12580 | cabinetry draft localStorage read/write helpers |
| 12581-13963 | cabinetry/exterior/roofing/entry/windows/garage/driveway selection aggregation helpers |
| 13964-14219 | `handleGuidedBack` |
| 14220-15405 | `styles` |

## Component Inventory

The scan found 84 React component declarations or component-like function declarations. The major active components are:

| Component | Starts | Responsibility | Risk |
| --- | ---: | --- | --- |
| `BuilderSelectionsBookPage` | 1402 | Page orchestration, embedded props, workbook identity, persistence, generated schedules, rendered app shell | Very high |
| `GuidedSelectionsWorkflow` | 4456 | Dashboard/category router for guided workflow | High |
| `GuidedCabinetryWorkflow` | 4889 | Cabinetry selections, room/category state, finish records, draft recovery | Very high |
| `GuidedExteriorColourWorkflow` | 7085 | Exterior colour selections and application logic | High |
| `GuidedExternalLightingWorkflow` | 7439 | External lighting selections | Medium |
| `GuidedDrivewayWorkflow` | 8010 | Driveway selection flow | Medium |
| `GuidedGarageDoorWorkflow` | 8422 | Garage door selections | Medium |
| `GuidedWindowsWorkflow` | 8574 | Window defaults and individual window selections | Medium |
| `GuidedEntryDoorWorkflow` | 8987 | Entry door glass/furniture selections | High |
| `GuidedBrickWorkflow` | 9727 | Brick selections | Medium |
| `GuidedRoofingWorkflow` | 9850 | Roofing selections | High |
| `ProductSelector` | 11749 | Generic product selection UI | Medium |
| `BrickCatalogueImportModal` | 10512 | Brick catalogue import modal | Medium |
| `CoverPage` / schedule document components | 10694+ | Printed schedule/document pages | High |

Supporting components include:

`GuidedCardGrid`, `CabinetrySelectionList`, `CabinetryWorkflowActions`, `CabinetrySwatchImage`, `ExteriorWallConstructionSelector`, `GuidedImageCard`, `ExteriorColourStatusLegend`, `ExteriorColourLinkControls`, `ExteriorColourApplyDialog`, `ExteriorColourAreaRow`, `ExteriorColourSwatch`, `GuidedExternalLightingSummary`, `GuidedLightingProductCard`, `GuidedExternalLightingDraft`, `GuidedExternalLightingReview`, `GuidedExternalLightingLine`, `DrivewaySwatchOption`, `GuidedGarageChoiceGrid`, `GuidedGarageColourSelector`, `WindowScheduleSummary`, `WindowSystemMappingStep`, `WindowDefaultsStep`, `IndividualWindowsStep`, `WindowReviewSummary`, `WindowOptionGroup`, `WindowTextOptionGroup`, `WindowStateLegend`, `WindowBadge`, `WindowChoiceStep`, `WindowScopeSelector`, `YourWindowSelectionPanel`, `EntryDoorGlassStep`, `EntryDoorSelectionSummary`, `EntryDoorGlassGallery`, `EntryDoorOptionStep`, `EntryDoorFurnitureStep`, `EntryDoorFurnitureGallery`, `EntryDoorFurnitureDetails`, `EntryDoorDesignFilters`, `EntryDoorFilterSelect`, `GuidedEntryDoorEmptyCatalogue`, `GuidedBrickEmptyCatalogue`, `GuidedRoofingEmptyCatalogue`, `AccessoryColourStep`, `RoofingProgressThumb`, `GuidedEmptyCatalogue`, `GuidedRequirementRow`, `GuidedProductCard`, `GuidedProductDetailsModal`, `GuidedBudgetDock`, `GuidedMiniTotal`, `GuidedStatusDot`, `LogoBox`, `CoverMeta`, `CoverSettingsPanel`, `ProjectInfoPage`, `ScheduleSectionDividerPage`, `ScheduleOutstandingPage`, `ScheduleAcknowledgementPage`, `HeaderLogo`, `InfoField`, `ScheduleSectionPage`, `ScheduleRowTable`, `ScheduleRow`, `RoomPage`, `ScheduleSelectionCard`, `ScheduleFieldList`, `PageFooter`, `Metric`, and `BuilderSchedulePreflight`.

## Hook, State, and Effect Inventory

| Hook | Call sites | Notes |
| --- | ---: | --- |
| `useState` | 167 | Main source of component-local workflow state |
| `useMemo` | 90 | Heavy use for derived project, catalogue, totals, grouped selections |
| `useEffect` | 26 | Persistence, import/load, localStorage, DOM/window interactions |
| `useRef` | 7 | Mostly workflow scroll/focus and instance tracking |
| `useCallback` | 0 | Event handlers are mostly recreated inline |
| `useReducer` | 0 | Workflow state is fragmented across many `useState` calls |

### Highest Hook Concentrations

| Component | Approx. lines | Hooks | Concern |
| --- | ---: | ---: | --- |
| `BuilderSelectionsBookPage` | 3,054 | 125 | Too many unrelated state domains in the page shell |
| `GuidedCabinetryWorkflow` | 1,598 | 70 | Cabinetry state machine is encoded as individual states/effects |
| `GuidedGarageDoorWorkflow` | 125 | 33 | Compact component with dense local derivation |
| `GuidedExteriorColourWorkflow` | 276 | 15 | Local workflow, bulk-apply, persistence flags |
| `GuidedDrivewayWorkflow` | 302 | 13 | Multiple step-local states |

### State Domains

| Domain | Current location | Recommended destination |
| --- | --- | --- |
| Active project/job identity | `BuilderSelectionsBookPage`, workbook props, project helpers | `lib/builders/clientSelections/projectIdentity.js` plus workbook-owned selected job |
| Selection book document state | `BuilderSelectionsBookPage` | `useSelectionsBookDocument` hook |
| Persistence/save status | `BuilderSelectionsBookPage`, payload helpers, workbook callback, Supabase | `useSelectionsBookPersistence` hook |
| Guided navigation | `BuilderSelectionsBookPage`, `GuidedSelectionsWorkflow`, `handleGuidedBack` | `useGuidedSelectionsNavigation` hook |
| Cabinetry | `GuidedCabinetryWorkflow`, local helpers, `lib/builders/cabinetryWorkflow.js` | `components/.../cabinetry` plus existing `lib/builders/cabinetryWorkflow.js` |
| Product/catalogue filtering | Many workflow components | `lib/builders/clientSelections/catalogueSelectors.js` |
| Document/schedule preview | Same file | `components/.../document` plus pure selectors |

## Duplicate and Overlap Findings

| Finding | Active owner | Duplicate/overlap | Recommendation |
| --- | --- | --- | --- |
| Two similarly named client selections pages | `pages/modules/builders/selections-book.js` | `pages/modules/builders/client-selections.js` | Mark the latter as legacy/standalone after route verification, or rename/archive in a separate cleanup. |
| Job file menu and recent job handling | `EstimateBuilderWorkbook` and shared job-file hooks | Selection book also owns project identity normalization and embedded draft fallback | Keep job/file ownership in the workbook. Selection book should consume a normalized project identity object. |
| Cabinetry domain logic | `lib/builders/cabinetryWorkflow.js` and `GuidedCabinetryWorkflow` | Some selectors/normalizers remain local in `selections-book.js` | Continue moving pure cabinetry logic into `lib/builders/cabinetryWorkflow.js`; keep rendering in components. |
| Product card UI patterns | `GuidedProductCard`, `ProductSelector`, other product-library modules | Similar selection-card behavior repeated | Extract only after workflow extraction, because styling and persistence semantics differ. |
| Completion totals/review | `lib/builders/clientSelectionWorkflow.js` and local review helpers | Area totals, project totals, document review, persisted review | Centralize pure totals/review selectors first with tests. |
| Back-to-top/back navigation | Local guided controls | Other shared UI has similar navigation affordances | Extract the state machine, not just the button. |
| Static catalogues | `data/product-library/catalogues/*` and inline constants | Entry hardware, Hume glass, window supplier data, product image URLs remain inline | Move static data to `data/product-library/catalogues` or `lib/builders/clientSelections/staticData.js`. |

## Static Catalogue Findings

The file still embeds significant static data. Some catalogue work has already been split out elsewhere, especially cabinetry catalogues.

### Already Externalized

| Module | Notes |
| --- | --- |
| `lib/builders/cabinetryWorkflow.js` | Imports Laminex and Polytec cabinetry colour catalogues and exports normalized cabinetry helpers. |
| `data/product-library/catalogues/cabinetry/AU-LAMINEX-CABINETRY-COLOURS.js` | External cabinetry source catalogue. |
| `data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.js` | External cabinetry source catalogue. |
| `lib/builders/stoneBenchtopWorkflow.js` | Externalized stone/benchtop workflow data and helpers used by selections-book. |
| `data/product-library/catalogues/windows-doors-garage/*` | Imported by selections-book for parts of the garage/window/door catalogue. |

### Still Inline

| Symbol / group | Lines | Recommendation |
| --- | ---: | --- |
| `ENTRY_DOOR_FURNITURE_PRODUCTS` | 151-357 | Move to `data/product-library/catalogues/entry-doors` or a client-selections static data module. |
| `HUME_SAVOY_1200_XS26_GLASS_OPTIONS` | 358-419 | Move with entry door catalogue data. |
| `DEFAULT_WINDOW_CONFIGURATION` | 420-442 | Move to windows workflow defaults. |
| `WINDOW_SUPPLIER_LIBRARY` | 523-615 | Move to windows catalogue/defaults module. |
| `DEFAULT_ROOMS`, `ROOM_TEMPLATES` | 616-659 | Move to shared selections defaults. |
| `PRODUCT_IMAGE_URLS`, `PRODUCT_OPTION_LIBRARY` | 660-767 | Move to static product option catalogue. |
| Guided area/category card metadata | 768-844 | Move to guided workflow constants. |
| Cabinetry visible option lists and wet-area config | 845-899 | Move to cabinetry workflow constants. |

## Persistence Boundary Findings

Persistence is the most sensitive part of the module and should be extracted after pure data/selectors have coverage.

### Current Persistence Channels

| Channel | Current location / owner | Risk |
| --- | --- | --- |
| Workbook callback | `BuilderSelectionsBookPage` calls `onClientSelectionsSave`; workbook hook owns `updateClientSelectionsBook` | Medium-high; callback shape is a cross-module contract. |
| Supabase selection book rows | `BuilderSelectionsBookPage` persistence helpers | High; project IDs and row payloads must remain stable. |
| Project selections sync | Local helper path writes/syncs `builder_client_selections` data | High; impacts downstream schedules. |
| Embedded draft localStorage | `EMBEDDED_SELECTIONS_BOOK_STORAGE_KEY` and load/save helpers | Medium; useful fallback but can mask project identity bugs. |
| Cabinetry draft localStorage | `CABINETRY_DRAFT_STORAGE_KEY`, latest cabinetry draft helpers | Medium; should be namespaced by project identity. |
| Exterior colour localStorage preference | Bulk tip dismissal key | Low; UI preference only. |
| Generated final schedule API | `/api/builders/final-inclusions-schedule/generate` | High; output becomes user-facing document. |
| Workbook IndexedDB/local job file | Owned outside this file by workbook/job-file hooks | High; selection-book should not take ownership of file handles. |

### Persistence Concerns

- Project identity is derived in multiple places. The active route should pass one normalized project identity into selections-book.
- Draft recovery and persisted project selections can conflict when the selected job changes.
- Cabinetry completion and return-to-interior behavior depends on both local workflow state and parent persistence callbacks.
- Save behavior crosses React state, workbook context, localStorage, Supabase, and generated schedule data. This should be wrapped behind a small persistence hook only after baseline tests lock current behavior.

## Current Dependency Diagram

```text
pages/modules/estimate-builder/index.js
  -> EstimateBuilderWorkbook
      -> useEstimateBuilderWorkbook / job file storage / selected project
      -> ClientSelectionsModuleHost
          -> dynamic import pages/modules/builders/selections-book.js
              -> BuilderSelectionsBookPage
                  -> project identity helpers
                  -> embedded workbook helpers
                  -> Supabase client
                  -> localStorage draft helpers
                  -> generated schedule API
                  -> GuidedSelectionsWorkflow
                      -> GuidedCabinetryWorkflow
                      -> exterior colour workflow
                      -> external lighting workflow
                      -> driveway workflow
                      -> garage workflow
                      -> windows workflow
                      -> entry door workflow
                      -> brick workflow
                      -> roofing workflow
                  -> document/schedule preview components
                  -> styled-jsx CSS
```

## Recommended Dependency Diagram

```text
pages/modules/estimate-builder/index.js
  -> EstimateBuilderWorkbook
      -> ClientSelectionsModuleHost
          -> components/estimate-builder/client-selections/ClientSelectionsBook
              -> useSelectionsBookProject
              -> useSelectionsBookDocument
              -> useSelectionsBookPersistence
              -> GuidedSelectionsWorkflow
                  -> cabinetry/CabinetryWorkflow
                  -> exterior-colours/ExteriorColoursWorkflow
                  -> external-lighting/ExternalLightingWorkflow
                  -> driveway/DrivewayWorkflow
                  -> garage/GarageDoorWorkflow
                  -> windows/WindowsWorkflow
                  -> entry-doors/EntryDoorWorkflow
                  -> brick/BrickWorkflow
                  -> roofing/RoofingWorkflow
              -> document/SelectionsBookDocument

lib/builders/clientSelections
  -> projectIdentity
  -> selectionBookSelectors
  -> selectionPersistencePayloads
  -> guidedNavigation
  -> scheduleReview

data/product-library/catalogues
  -> cabinetry
  -> entry-doors
  -> windows-doors-garage
  -> exterior
  -> roofing
```

## Proposed File Tree

This tree follows current repo conventions: route files remain thin, reusable React UI lives under `components`, pure business logic lives under `lib/builders`, and catalogues live under `data/product-library/catalogues`.

```text
pages/modules/builders/selections-book.js

components/estimate-builder/client-selections/
  ClientSelectionsBook.js
  ClientSelectionsBook.styles.js
  GuidedSelectionsWorkflow.js
  GuidedSelectionDashboard.js
  hooks/
    useSelectionsBookProject.js
    useSelectionsBookDocument.js
    useSelectionsBookPersistence.js
    useGuidedSelectionsNavigation.js
  cabinetry/
    CabinetryWorkflow.js
    CabinetrySelectionList.js
    CabinetryWorkflowActions.js
    CabinetrySwatchImage.js
  exterior-colours/
    ExteriorColoursWorkflow.js
    ExteriorColourAreaRow.js
    ExteriorColourApplyDialog.js
  external-lighting/
    ExternalLightingWorkflow.js
  driveway/
    DrivewayWorkflow.js
  garage/
    GarageDoorWorkflow.js
  windows/
    WindowsWorkflow.js
  entry-doors/
    EntryDoorWorkflow.js
    EntryDoorGlassStep.js
    EntryDoorFurnitureStep.js
  brick/
    BrickWorkflow.js
    BrickCatalogueImportModal.js
  roofing/
    RoofingWorkflow.js
  document/
    SelectionsBookDocument.js
    CoverPage.js
    ScheduleSectionPage.js
    ScheduleSelectionCard.js
    BuilderSchedulePreflight.js
  shared/
    GuidedProductCard.js
    GuidedProductDetailsModal.js
    GuidedBudgetDock.js
    ProductSelector.js

lib/builders/clientSelections/
  projectIdentity.js
  selectionBookDocument.js
  selectionBookSelectors.js
  selectionPersistencePayloads.js
  guidedSelectionSelectors.js
  guidedNavigation.js
  scheduleReview.js

data/product-library/catalogues/
  entry-doors/
  windows-doors-garage/
  client-selections/
```

The first version of `pages/modules/builders/selections-book.js` should remain as a compatibility wrapper exporting the same default page while internals are extracted.

## Staged Extraction Plan

### Stage 0: Freeze Behavior

Goal: add tests and snapshots before moving code.

Actions:

- Add a route smoke test proving `/modules/estimate-builder?page=clientSelections` loads `selections-book.js`.
- Add a regression test for selected job/project identity being passed into the loaded module.
- Add tests for cabinetry completion returning to interior without `projectId`/null payload crashes.
- Add selector snapshots for generated schedule payloads and completion totals.

### Stage 1: Extract Static Data and Pure Selectors

Goal: reduce file size without changing runtime behavior.

Move:

- Entry door furniture/glass constants.
- Window defaults and supplier library.
- Product image/option constants.
- Guided area/category metadata.
- Pure formatting, slug, ID, and selection aggregation helpers.

Why first: static data and pure functions are the lowest-risk extraction target and easiest to test.

### Stage 2: Extract Project Identity Helpers

Goal: create a single normalized project identity boundary.

Move:

- `getSelectionsBookProjectDetails`.
- Embedded project/workbook conversion helpers.
- Active project ID/name/address/client selectors.

Add tests for:

- Embedded workbook with selected project.
- Local job with no Supabase ID.
- Missing/null project.
- Project switch.

### Stage 3: Extract Guided Navigation

Goal: remove cross-workflow back/step logic from the page file.

Move:

- `handleGuidedBack`.
- Guided area/category route state helpers.
- Back/finish routing semantics.

Add tests for:

- Cabinetry finish returns to interior.
- Exterior finish returns to exterior category.
- Back from sub-step goes to correct parent.

### Stage 4: Extract Cabinetry Workflow UI

Goal: isolate the current highest-risk feature area.

Move:

- `GuidedCabinetryWorkflow`.
- Cabinetry list/action/swatch components.
- Cabinetry-specific UI helpers.

Keep:

- Existing `lib/builders/cabinetryWorkflow.js` as pure domain owner.
- Persistence callback shape unchanged.

### Stage 5: Extract Remaining Workflow Components

Goal: split workflow features one at a time.

Order:

1. Garage and driveway.
2. Windows.
3. Entry doors.
4. Brick.
5. Roofing.
6. Exterior colours.
7. External lighting.

Exterior colours should be later than garage/driveway because it has bulk-apply behavior and local preference persistence.

### Stage 6: Extract Document and Schedule Rendering

Goal: separate screen workflow from printed/generated output.

Move:

- Cover and project info pages.
- Schedule section/table/row/card components.
- Schedule preflight/review UI.

Add tests for:

- Final inclusions schedule payload shape.
- Empty/outstanding schedule rendering.
- Print layout smoke test.

### Stage 7: Extract Persistence Hook

Goal: create the smallest possible persistence boundary after all pure pieces are covered.

Move:

- Save status state.
- Embedded draft load/save.
- Supabase upsert/fetch coordination.
- Workbook callback invocation.
- Project selections sync.

Do this last because it is the highest blast-radius change.

## Test Coverage Matrix

| Area | Existing useful tests | Gaps before extraction |
| --- | --- | --- |
| Type safety | `npm run typecheck` | Keep as baseline after each stage. |
| Job file menu / selection store | `scripts/test-job-file-menu-and-selection-store-regression.mjs` | Add explicit selected project identity assertions for client selections route. |
| Client selections cabinetry workflow | `scripts/test-client-selections-cabinetry-workflow.mjs` | Add project switch and completion route cases. |
| Estimate builder header portal | `scripts/test-estimate-builder-header-menu-portal.mjs` | Keep to guard shared menu behavior. |
| Embedded client selections render | `scripts/test-estimate-builder-client-selections-embedded-render.cjs` | Add dynamic import failure and no-job guard cases. |
| Guided workflow browser | `scripts/test-estimate-builder-client-selections-guided-workflow.mjs` | Add back/finish routing for every category. |
| Cabinetry browser flows | Bathroom/ensuite/IA/corrective/Laminex/stone/appliances scripts | Add persistence assertions after finish/save. |
| Exterior colours | `scripts/test-exterior-colours-workflow.mjs`, browser exterior colour tests | Add bulk apply and localStorage preference tests. |
| External lighting | External lighting browser workflow script | Add schedule payload assertion. |
| Windows/doors/garage | Exterior openings/catalogue scripts | Add active embedded route regression for default selections. |
| Final schedule/PDF | `scripts/test-final-inclusions-schedule-generator.mjs`, `scripts/test-selections-book-schedule-layout.mjs` | Add snapshots for normalized document book and persisted selections review. |
| Product catalogues | Kitchen/Laminex/Polytec/exterior catalogue scripts | Add entry door furniture/glass and window supplier catalogue snapshots. |

## Performance Findings

This audit did not run a production bundle analyzer. These findings are based on static architecture inspection.

| Finding | Impact | Recommendation |
| --- | --- | --- |
| Single 15,405-line dynamically imported module | Large parse/compile cost when client selections opens | Split into route shell plus workflow chunks. |
| Large inline styled-jsx block | Adds parse cost and makes style ownership hard to reason about | Move to extracted style module first, then feature-specific styles. |
| Static catalogues embedded in route chunk | Users load data for workflows they may not open | Move catalogues to data modules and lazy-load large feature catalogues when needed. |
| 167 `useState` calls | High render complexity and fragile state coupling | Introduce focused hooks/reducers per workflow after behavior tests. |
| 90 `useMemo` calls | Indicates heavy derived data inside render layer | Move pure selectors to `lib` and test them directly. |
| Inline handlers across large components | More frequent child re-renders and hard-to-profile behavior | Extract component boundaries first; consider `useCallback` only where profiling supports it. |

## Risk Register

| Risk | Severity | Why it matters | Mitigation |
| --- | --- | --- | --- |
| Editing wrong client selections file | High | `client-selections.js` and `selections-book.js` are easy to confuse | Keep route proof in PR notes and tests. |
| Project identity regression | Critical | Saves may attach to wrong job/client/project | Extract/test project identity before persistence. |
| Cabinetry completion regression | High | User-facing Cabinetry route currently error-prone | Add finish/back route tests before extraction. |
| Supabase/workbook/localStorage conflict | High | Multiple persistence sources can overwrite one another | Persistence extraction last; add read-back tests. |
| Generated schedule shape drift | High | Affects final client-facing documents | Snapshot payload and rendered schedule before changes. |
| CSS extraction visual regressions | Medium | 1,186-line style block touches many workflows | Extract style string unchanged first; then split. |
| Catalogue import path drift | Medium | Product options may disappear silently | Catalogue snapshot tests. |
| Browser-only APIs during SSR/import | Medium | Dynamic import may still evaluate top-level code | Keep browser API access inside guarded functions/effects. |
| Oversized PR blast radius | High | A full refactor is hard to review and debug | Use staged extraction, one responsibility per PR. |

## Final Recommendation

Yes, this is effectively a god component/module. It should be split, but not by a broad rewrite. The safest first extraction stage is static data plus pure selectors because that reduces file size and coupling without changing React lifecycle, route loading, or persistence semantics.

Recommended first-stage order:

1. Add baseline tests for route identity, cabinetry finish/back behavior, generated schedule payloads, and catalogue snapshots.
2. Move static constants/catalogues out of `selections-book.js`.
3. Move pure selectors and project identity helpers into `lib/builders/clientSelections`.
4. Only then extract React workflow components.
5. Extract persistence last.

The active route should continue to be treated as:

```text
EstimateBuilderWorkbook owns active job/file identity.
SelectionsBook consumes normalized project context.
Feature workflows own local UI state.
lib/builders owns pure domain logic and selectors.
data/product-library owns static catalogues.
```

