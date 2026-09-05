# Appliance Legacy CSV Mapping

Date: 2026-09-02

Source file: `C:\Users\grant\Downloads\appliance options.csv`

This is a read-only parser contract for the supplied 19-field, headerless appliance CSV. The parser first converts every row into a named legacy record; reconciliation code must not depend on unexplained array indexes.

## Field Contract

| Index | Field | Description |
| --- | --- | --- |
| 0 | legacyRowId | Legacy source row number from the Quotation Builder appliance block. |
| 1 | brandName | Legacy brand label used for grouping appliance options. |
| 2 | supplierName | Legacy supplier/manufacturer label; currently mirrors brand for this file. |
| 3 | legacyCategory | Unused legacy category field; blank in supplied file. |
| 4 | legacySubcategory | Unused legacy subcategory field; blank in supplied file. |
| 5 | legacyName | Legacy line item name, including pack labels and component descriptions. |
| 6 | legacyDescription | Pipe-delimited legacy description carrying section, name, unit, price, and notes. |
| 7 | unit | Legacy unit; EACH for physical component rows and PACK for appliance pack rows. |
| 8 | costPrice | Legacy cost column; blank in supplied file. |
| 9 | sellPrice | Legacy sell/client price column. |
| 10 | rate | Legacy rate column; mirrors sellPrice in supplied file. |
| 11 | gstTreatment | Legacy GST field; blank in supplied file. |
| 12 | legacyStatus | Unused legacy status field; blank in supplied file. |
| 13 | manufacturerName | Manufacturer label; currently mirrors brand for this file. |
| 14 | imageReference | Legacy image reference; blank because Checkpoint 1 does not gather images. |
| 15 | clientSelectable | Legacy selectable flag. |
| 16 | catalogueKind | Legacy catalogue kind; appliance in supplied file. |
| 17 | active | Legacy active flag. |
| 18 | notes | Legacy reconciliation notes. |

## Later Standard Import Shape

The legacy parser is deliberately separated from the future Product Library CSV import. A later tenant import should map uploaded rows into canonical product fields: category, family, brand, range, model, SKU/product code, supplier, product name, description, unit, price status, optional price, image fields, applicable rooms, selectable flag, active flag, and tenant/workspace ownership.

Unknown future brands are accepted through normalization; this parser does not hardcode Euromaid, Ariston, Westinghouse, Smeg, Blanco, and Omega as the only permitted brands.
