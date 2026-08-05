# Quotation Template CSV Export

The Quotation Builder template export is sourced from the active Estimate Builder workbook quotation sections.

Current source path:

- `lib/construction-estimation/importedExcelWorkbookTemplate.json`
- parsed by `createEstimateBuilderWorkbookDefaults()` in `lib/construction-estimation/estimateBuilderWorkbookDefaults.js`
- exposed to the UI through `useEstimateBuilderWorkbook()`
- rendered and exported from `components/estimate-builder/EstimateBuilderWorkbook.js`

The CSV export does not alter the workbook, rates, formulas, allowances, sections or rows. It flattens the current in-memory `sheet.workbook.quotation` rows using `sheet.quoteSections` order.

The export filename is:

`Gr8-Result-Quotation-Template-Items-YYYY-MM-DD.csv`

Columns:

`quote_item_code, category, subcategory, item_name, description, unit, cost_rate, sell_rate, allowance, supplier, active_status, quotation_stage, selection_area, selection_category, selection_item_name, quantity_rule, include_in_selections, notes`

The selection columns are intentionally blank except `include_in_selections`, which defaults to `yes`. The user decides which rows are selectable by deleting rows from the downloaded CSV before upload.

The CSV is generated with a UTF-8 BOM and RFC-style quoting for commas, quotes and line breaks so Excel can open it reliably.
