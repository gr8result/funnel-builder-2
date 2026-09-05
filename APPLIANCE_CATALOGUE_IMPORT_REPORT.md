# Appliance Catalogue Import Report

Date: 2026-09-02

Checkpoint 1 is data reconciliation only. No live Product Library records were created, no Client Selections or Quotation Builder screens were connected, and no product images were gathered.

## Source Summary

| Metric | Count |
| --- | --- |
| Source CSV path | C:\Users\grant\Downloads\appliance options.csv |
| Source file size | 70243 bytes |
| Source SHA-256 | F325357E987DAFB4A695C0529057423DB917BD5FEFADAD6C2AA7242A16667872 |
| Source modified UTC | 2026-09-01T21:46:23.305Z |
| Source rows | 194 |
| Expected fields per legacy row | 19 |
| Accepted legacy rows | 194 |
| Rejected malformed rows | 0 |
| EACH rows | 159 |
| PACK rows | 35 |
| Accounted source rows | 194 |

## Reconciliation Totals

| Type | Rows |
| --- | --- |
| unique physical appliance products | 83 |
| appliance packs | 35 |
| duplicate component rows | 76 |
| unresolved source rows | 0 |
| rejected malformed rows | 0 |

Pack-to-product relationships: 159

Actual price conflict groups: 0

Identity variation review groups: 18

## Counts By Brand

| Brand | Source rows |
| --- | --- |
| Euromaid | 33 |
| Omega | 30 |
| Blanco | 32 |
| Ariston | 33 |
| Westinghouse | 33 |
| Smeg | 33 |

## Counts By Product Family

| Family | Unique products |
| --- | --- |
| cooktops | 23 |
| dishwashers | 6 |
| freestanding-cookers | 6 |
| ovens | 12 |
| rangehoods | 36 |

## Price Conflicts

No actual price or unit conflicts were detected for repeated brand/model components. Eighteen same-model description/selectable variations are retained in `APPLIANCE_PRICE_CONFLICT_REVIEW.csv` because the latest disputed run counted them as price conflicts.

## Appliance Hierarchy Prepared

The reconciled product candidates support the later required UI path:

`Appliance family -> available brands -> available models -> product details and image -> selection snapshot`

Images are intentionally blank at this checkpoint.
