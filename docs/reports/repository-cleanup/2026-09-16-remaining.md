# Remaining repository inventory - revised size policy

This continues the existing audit after the successful initial batches and four renderer/editor batches. Files below 2,000 lines are not cleanup targets without a concrete architectural issue. The 2,000-4,999 band is an inspection list, not an automatic refactor list.

| Category | Before this continuation | Current tracked source/data |
|---|---:|---:|
| 10000+ | 14 | 14 |
| 5000-9999 | 10 | 6 |
| 2000-4999 | 26 | 29 |

The dependency lockfile is excluded from source/data totals. Generated output/caches/Git/dependencies are excluded. Counts are a snapshot of a shared tree, not an assertion that other sessions have stopped. Current scans reported zero read failures. All remaining files in the first two categories are blocked through actual active/frozen dependencies, including clean files with dirty consumers.

## 10,000+

| Lines | File | Decision / dependency evidence |
|---:|---|---|
| 133,097 | `data/product-library/source-evidence/internal-finishing/corinthian-media.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 109,563 | `data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 97,096 | `lib/construction-estimation/importedExcelWorkbookTemplate.json` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 61,143 | `data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 22,495 | `lib/construction-estimation/windowsDoorsWorkbookRows.json` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 21,681 | `data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 20,814 | `data/product-library/catalogues/exterior/AU-ENTRY-DOOR-FURNITURE-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 19,621 | `components/estimate-builder/EstimateBuilderWorkbook.js` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 17,450 | `data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 17,010 | `pages/modules/builders/selections-book.js` | BLOCKED BY ACTIVE WORK: pre-existing modifications in active catalogue/Client Selections work. |
| 16,978 | `data/product-library/catalogues/roofing/AU-BRISTILE-ROOF-TILES-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 12,124 | `data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 10,712 | `data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.js` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 10,712 | `data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |

## 5,000-9,999

| Lines | File | Decision / dependency evidence |
|---:|---|---|
| 8,977 | `data/product-library/catalogues/roofing/AU-MONIER-ROOF-TILES-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 8,921 | `data/website-builder-defaults.json` | BLOCKED BY ACTIVE WORK: writable defaults store; API reads/writes this path and shared media reads it. |
| 8,284 | `hooks/estimate-builder/useEstimateBuilderWorkbook.js` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 6,256 | `data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.js` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 6,254 | `data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 5,657 | `components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |

## 2,000-4,999 - inspection only

| Lines | File | Decision / dependency evidence |
|---:|---|---|
| 4,834 | `components/website-builder/page-builder/pbPropertiesPanels.js` | BATCH COMPLETE: cohesive remaining block inspectors; Team/Stats persistence and protected assertions intentionally retained. |
| 4,834 | `pages/modules/builders/product-library.js` | BLOCKED BY ACTIVE WORK: pre-existing modifications in active catalogue/Client Selections work. |
| 4,692 | `pages/modules/funnels/edit/[id].js` | DEFER: editor initialization, load/save, asset persistence and history workflows interleaved; freeze prevents a complete workflow split. |
| 4,692 | `pages/modules/website-builder/visual-builder.js` | BLOCKED BY ACTIVE WORK: save/load, autosave, page-flush or recovery responsibilities; no changes. |
| 4,480 | `components/website-builder/WebsiteBlockRenderer.js` | BATCH COMPLETE: core dispatcher and non-hero sections; footer/pricing implementation retained for protected source-reading tests. |
| 4,080 | `components/website-builder/PageBuilderCanvas.js` | BLOCKED BY ACTIVE WORK: save/load, autosave, page-flush or recovery responsibilities; no changes. |
| 3,722 | `lib/construction-estimation/appliancePackageRows.json` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 3,705 | `components/crm/LeadDetailsModal.js` | DEFER: distinct UI workflows exist, but storage/load/save are interleaved; no independent priority established under current freeze. |
| 3,672 | `data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |
| 3,644 | `standard-inclusions/premier-inclusions-template.full.json` | RETAIN: coherent 10-page master template; any structural change also reaches active workbook/document persistence. |
| 3,552 | `lib/website-builder/projectStore.js` | BLOCKED BY ACTIVE WORK: save/load, autosave, page-flush or recovery responsibilities; no changes. |
| 3,523 | `website-builder-sites/35ab846e-0764-498b-b1f8-7d2cf27d85a5/2208a52a-8175-477e-823c-fc6de7fe4afe/pages/home.json` | RETAIN / BLOCKED: recovery input, used by recovery scripts; not dead evidence. |
| 3,304 | `lib/website-builder/templates.js` | DEFER: template-family boundary is plausible, but projectStore consumes this graph; frozen persistence dependency. |
| 3,203 | `public/tmp-project-debug.json` | RETAIN pending provenance: no scoped reference found, but absence of static references does not establish that a project/debug snapshot is disposable during recovery. |
| 3,194 | `lib/product-library/catalogueModel.js` | BLOCKED BY ACTIVE WORK: pre-existing modifications in active catalogue/Client Selections work. |
| 2,905 | `lib/construction-estimation/inputDataSheetTemplate.js` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 2,899 | `lib/website-builder/templateBlueprints.js` | DEFER: template-family boundary is plausible, but projectStore consumes this graph; frozen persistence dependency. |
| 2,578 | `lib/construction-estimation/inputDataSheetTemplate.json` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 2,558 | `components/gantt/GanttPageLayout.js` | DEFER: distinct UI workflows exist, but storage/load/save are interleaved; no independent priority established under current freeze. |
| 2,543 | `components/website-builder/website-renderer/wbVariantStyles.js` | RETAIN: cohesive style/variant helper catalogue; no concrete reason to split merely for line count. |
| 2,541 | `lib/construction-estimation/estimateBuilderWorkbookCalculations.js` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 2,491 | `components/website-builder/page-builder/pbCanvasComponents.js` | BATCH COMPLETE: remaining property-panel routing and CTA/global-nav coordination; save callbacks unchanged. |
| 2,466 | `pages/modules/email/crm/pipelines/index.js` | RETAIN this batch: cohesive pipeline page; storage, save-as and database loading enter frozen responsibilities. |
| 2,416 | `pages/freedom/my-trades.js` | RETAIN this batch: portfolio dashboard; optional chart/editor boundaries are coupled with loading and database mutations. |
| 2,319 | `lib/construction-estimation/estimateBuilderWorkbookDefaults.js` | BLOCKED BY ACTIVE WORK: Job Setup/Loader, workbook, Takeoff, persistence or their current consumers. |
| 2,308 | `pages/modules/social_media/create.js` | DEFER: generation/editor/draft storage coupled; a narrowly scoped pure presentation extraction needs a separate dependency audit. |
| 2,164 | `pages/store/dashboard.js` | BLOCKED BY ACTIVE WORK: pre-existing modification. |
| 2,025 | `pages/leads.js` | RETAIN: cohesive lead dashboard; no size-driven split justified, with stored lists/stages and database loading also present. |
| 2,021 | `data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json` | BLOCKED BY ACTIVE WORK: modified catalogue/source evidence or dependency of active catalogueService/cabinetry selectors/Client Selections; coordinate readers AND generators. |

## Untracked active source/evidence

Fresh broader scan (UTC 2026-09-16T06:28:16+00:00):

| Category | Tracked source/data | Non-ignored untracked source/evidence | Combined |
|---|---:|---:|---:|
| 10,000+ | 14 | 36 | 50 |
| 5,000-9,999 | 6 | 6 | 12 |
| 2,000-4,999 | 29 | 63 | 92 |

Every untracked path in these categories, its line count and hash is recorded in the [untracked inventory CSV](2026-09-16-untracked-inventory.csv). These include active appliance safety/range files, benchtop/kitchen/internal catalogues, supplier evidence and captured HTML/XML source documents. They remain separate from tracked implementation totals. The presence of an untracked capture is not proof that it is unused. No cleanup ownership has been established, so they are preserved. New renderer/editor modules are all below 2,000 lines.

The root captures `cg-urban-series.html` and `cg2.html` have equal hashes at this snapshot. This proves byte duplication, not safe deletion: their ownership and consumers remain unresolved. Supplier source captures should eventually live under their source-evidence owner rather than the root, after that work is released.

Use `node scripts/repository-maintenance/audit.mjs --include-untracked` for a fresh broader inventory; JSON output now reports exactly the three revised categories. The broad scan completed with zero read failures.

Detailed completed batches and the proposed ownership tree are in [the continuation report](2026-09-16-revised-policy-batches.md). The [initial audit](2026-09-16-audit.md) remains a historical baseline, including its old thresholds.
