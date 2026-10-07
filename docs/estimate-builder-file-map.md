# Estimate Builder File Map

## Workbook Shell And Routing

- `pages/modules/estimate-builder/index.js` reads the `page` query string and passes it into the workbook shell as `initialPage`.
- `components/estimate-builder/EstimateBuilderWorkbook.js` owns the workbook UI shell, URL page normalisation, `WORKSPACE_VISUALS`, compact workbook tabs, and page render branches. The compact workbook tabs are `Data Input`, `Calculations`, and `Quote Sheet`.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js` owns workbook state, page validation, page allowlists, active-page persistence, workbook normalisation, preview calculation wiring, and mutation handlers exposed to the shell.

## Data Input UI

- `components/estimate-builder/EstimateBuilderWorkbook.js` contains `DataInputSheet`, which renders the current Data Input sheet from `sheet.dataInputSections`.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js` derives `dataInputSections` from `V4_DATA_SECTIONS` and overlays saved workbook data, formula notes, calculated flags, and preview values.
- `lib/construction-estimation/inputDataSheetTemplate.js` defines `INPUT_DATA_SHEET_TEMPLATE`.
- `lib/construction-estimation/estimateWorksheetV4Schema.js` maps `INPUT_DATA_SHEET_TEMPLATE` into `V4_DATA_SECTIONS`.

## Calculations And FormulaSheet UI

- `components/estimate-builder/EstimateBuilderWorkbook.js` contains the existing `FormulaSheet` component and the `activePageKey === "formulaSheet"` render branch.
- `FormulaSheet` renders rows from the local `formulaRows(sheet)` helper, using the workbook's formulas, formula rows, input row definitions, calculated row definitions, formula engine preview values, and calculated results.
- `components/estimate-builder/EstimateBuilderWorkbook.js` also owns `WORKSPACE_VISUALS.formulaSheet`, labelled `Calculations`, so `/modules/estimate-builder?page=formulaSheet` remains on the existing FormulaSheet page.

## Formula Engine

- `lib/construction-estimation/estimateBuilderWorkbookCalculations.js` exports `calculateEstimateBuilderWorkbook` and `V4_DEFAULT_FORMULAS`.
- The same file contains `applyEditableFormulas`, which applies workbook formula overrides and default formulas to calculated quantities.
- The same file contains `calculateQuotation`, which consumes calculated quantities and quotation rows to produce Quote Sheet preview rows and totals.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js` calls `calculateEstimateBuilderWorkbook` to build `sheet.preview`.

## Input And Calculated Row Definitions

- `lib/construction-estimation/inputDataSheetTemplate.js` is the source template for input rows.
- `lib/construction-estimation/estimateWorksheetV4Schema.js` defines `V4_DATA_SECTIONS`, including input rows and calculated rows.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js` preserves and normalises `workbook.formulas` and `workbook.formulaRows` in `normalizeWorkbook`.
- `components/estimate-builder/EstimateBuilderWorkbook.js` combines `sheet.dataInputSections`, `sheet.windowTypes`, and `sheet.workbook.formulaRows` in `formulaRows(sheet)`.

## Windows And Doors Rows

- `lib/construction-estimation/windowsDoorsWorkbookRows.json` stores the imported workbook window and door source rows.
- `lib/construction-estimation/estimateBuilderWorkbookDefaults.js` loads those rows into default `workbook.windowsDoors`.
- `lib/construction-estimation/humeEntryDoorPricing.js` owns Hume entry door row expansion and selected door schedule helpers.
- `components/estimate-builder/EstimateBuilderWorkbook.js` contains `WindowsDoorsSheet`, and `lib/construction-estimation/estimateBuilderWorkbookCalculations.js` links selected windows and doors into quote quantities and generated quote rows.

## Workbook Defaults And Templates

- `lib/construction-estimation/estimateBuilderWorkbookDefaults.js` exports `createEstimateBuilderWorkbookDefaults`, which builds the workbook defaults from `V4_DATA_SECTIONS`, `V4_DEFAULT_FORMULAS`, `importedExcelWorkbookTemplate.json`, `windowsDoorsWorkbookRows.json`, appliance package rows, and standard inclusions defaults.
- `lib/construction-estimation/importedExcelWorkbookTemplate.json` stores the imported workbook template data, including imported Data Input, quotation, and import report data.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js` applies defaults and saved data compatibility in `normalizeWorkbook`.

## Quote Sheet

- `components/estimate-builder/EstimateBuilderWorkbook.js` contains `QuotationSheet`, the current Quote Sheet UI.
- `lib/construction-estimation/estimateBuilderWorkbookCalculations.js` contains `calculateQuotation`, which applies calculated quantities, editable formulas, quote row formulas, manual quantities, imported quantities, rates, margins, GST, and summary totals.
- `lib/construction-estimation/finalQuotationBoq.js` provides quote row helpers used by the hook and workbook UI.

## Job-File Persistence

- `lib/jobFile.ts` owns `.gr8job` package read/write, backup, open, save, save-as, and File System Access helpers.
- `hooks/useJobFile.ts` wraps `lib/jobFile.ts` for React state, autosave, open, save, and save-as flows.
- `components/estimate-builder/EstimateBuilderWorkbook.js` converts workbook state with `workbookToJobFileData` and opens local job files through `readJob`.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js` hydrates opened job file data in `loadJobFileData` and keeps saved workbook compatibility through `normalizeWorkbook`.

## Import And Export

- `components/estimate-builder/EstimateBuilderWorkbook.js` owns local job file import handling, current-page CSV export, quote sheet CSV export, section CSV import/export, product-library CSV export, procurement CSV export, and Project Estimate PDF export flows.
- `lib/jobFile.ts` owns `.gr8job` import/export packaging.
- `lib/construction-estimation/importedExcelWorkbookTemplate.json` is the imported workbook source template used by workbook defaults.

## Related Tests

- `scripts/test-estimate-builder-formula-sheet-regression.mjs` verifies FormulaSheet workbook-tab access, route acceptance, render separation, and formula/formulaRows preservation.
- `scripts/test-estimate-workbook-sheet-tabs.mjs` verifies the compact workbook tabs and render paths.
- `scripts/test-estimate-builder-calculations.mjs` verifies calculation, editable formula, Quote Sheet, and windows/doors calculation behavior.
- Additional estimate-builder browser checks live under `scripts/test-estimate-builder-*-browser.mjs`.
