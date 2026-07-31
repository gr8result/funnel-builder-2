# Product Library Client Selections Audit

Date: 2026-08-01

This audit is based on local source, migrations and tests. No live Supabase rows were queried.

## Tables And Surfaces

| Surface | Classification | Notes |
| --- | --- | --- |
| `builder_products` | Shared | Owns both estimating resources and selectable products. Existing fields include `library_scope`, `available_for_selection`, price fields, media fields, tags and compatibility fields. |
| `builder_product_categories` | Shared | Categories include estimating keys such as concrete/labour and selections keys such as roofing, tapware, appliances, tiles and flooring. |
| `builder_product_suppliers` | Shared | Supplier names/IDs are shared by admin and selections lookup. |
| `builder_product_manufacturers` | Client Selectable / Shared | Used as brand/manufacturer display in Product Library and selections. |
| `builder_product_import_batches` / `builder_product_library_import_reports` | Shared | CSV import audit trail. |
| `builder_client_selections` | Selections dependency | Existing legacy/reference table still used for archive safety checks. |

## Existing Classification

| Item Type | Classification |
| --- | --- |
| Concrete slabs, reinforcement, deformed bar, excavation, labour, preliminaries, project management, subcontractor rates, BOQ material/rate rows | ESTIMATING ONLY |
| Ovens, cooktops, rangehoods, dishwashers, sinks, tapware, toilets, basins, baths, shower screens, tiles, flooring, cabinetry, benchtops, paints, doors, roofing, bricks, cladding, garage doors, pool/external finishes | CLIENT SELECTABLE |
| Plumbing/electrical/external works rows that can be both priced and selected | SHARED |
| Rows with missing tags, missing category, missing supplier, no active flag, no visibility or vague category only | UNCERTAIN until explicitly classified |

## Dependencies

Estimate Builder, BOQ and quotation/rate workflows depend on estimating resources remaining available. Inclusions & Selections depends on `ProductSelectionCatalogueAdapter`, requirement tags, active state, availability state, variants and supplier/media fields. The fix is additive: classify rows with `selection_visibility` and filter selections views, without deleting estimating data.
