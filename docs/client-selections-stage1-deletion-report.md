# Client Selections Stage 1 Deletion Report

## Removed from the primary workflow

- The flat Client Selections page built around product rows, category filters, manual budget entry, and room text fields.
- The old page's direct product-first form for hard-coded selection records.
- The old page's primary reliance on `builder_client_selections` rows as the user-facing workflow.
- Spreadsheet-style room/product editing as the main Client Selections entry point.

## Preserved

- Shared Product Library data and product catalogue records.
- Estimate Builder, approved project estimate, estimate snapshots, and quotation data.
- Existing `builder_client_selections` records.
- Existing `builder_selection_sessions` records.
- Existing variation, supplier, product, media, and quotation tables.
- Existing Selections Book and Guided Selections routes, pending a later explicit migration/removal step.

## Migration path

Stage 1 stores the new top-down project structure against a Client Selections session using metadata key `client_selections_top_down_stage1`. Existing product-first selections remain available in `builder_client_selections` and can be mapped later into project area, room group, category, group selection, and room override entities.

The companion migration `20260729_client_selections_top_down_stage1.sql` creates non-destructive Stage 1 entity tables and a legacy backup table. It copies legacy records into the backup table before any future conversion work. It does not drop or truncate existing Client Selections, Product Library, Estimate Builder, Quotation Builder, media, pricing, supplier, or project data.

## Not removed in this stage

- Shared product, pricing, supplier, and media records.
- Existing formal quotation logic.
- Existing Product Library and Quotation Builder modules.
- Estimate Builder workbook or Takeoff Engine.
- Database tables that may still contain historical project selections.
