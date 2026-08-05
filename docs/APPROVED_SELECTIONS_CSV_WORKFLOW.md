# Approved Selections CSV Workflow

The approved selections CSV is a separate mapping source. It does not create, delete or edit Quotation Builder rows.

Workflow:

1. Download `Gr8-Result-Quotation-Template-Items-YYYY-MM-DD.csv`.
2. Open it in Excel.
3. Delete every row that should not appear in Inclusions & Selections.
4. Keep `quote_item_code` unchanged.
5. Complete `selection_area`, `selection_category`, `selection_item_name` and `quantity_rule` where required.
6. Save as CSV UTF-8.
7. Upload with `Upload Approved Selections CSV`.

Import preview blocks duplicate codes, missing codes, unknown quote item codes, missing headers, empty files and rows missing required selection area or item name.

Imported mappings contain:

`quoteItemCode, selectionArea, selectionCategory, selectionItemName, quantityRule, approvedForSelections, importedAt, sourceFilename, notes`

Rows removed from a later upload are shown in reconciliation. The user can remove them from the selections mapping or keep them active. Removing a mapping never removes a quotation item.

Stage 2 reads the approved mapping for the active project. It does not fall back to the full quote template or demo selection items.
