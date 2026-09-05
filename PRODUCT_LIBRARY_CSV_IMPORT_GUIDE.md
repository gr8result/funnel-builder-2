# Product Library CSV Import Guide

Stage 3B will use Product Library CSV imports for physical, client-selectable products. The standard import template is `PRODUCT_LIBRARY_IMPORT_TEMPLATE.csv`.

## Required Columns

`product_id, category, family, subfamily, brand, range, model, sku, product_name, short_description, full_description, specifications, size, colour, finish, fuel_or_energy_type, installation_type, unit, cost_price, sell_price, gst_status, price_status, supplier, image_url, additional_image_urls, document_urls, applicable_rooms, selectable, active`

## Checkpoint 1 Scope

- The legacy appliance no-header CSV is parsed through a dedicated importer.
- Row-level validation rejects malformed rows before any Product Library write path exists.
- Duplicate detection uses stable IDs, then brand/model, then brand/name fallback.
- The importer is dry-run/report-only in this checkpoint and does not overwrite saved job snapshots.

## Future Checkpoints

- Checkpoint 4 will add reusable preview, validation, duplicate action, dry-run, batch ID and rollback behaviour for builder uploads.
- Imported tenant catalogues must remain tenant-scoped and must not overwrite saved selection or quotation snapshots.
