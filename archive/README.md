# Archive

Local one-off snapshots that were cluttering the repository root. Nothing here is a source of
truth and nothing in the application reads it. Full relocation map:
[`docs/README.md`](../docs/README.md).

| Folder | Was at root as | What it is |
|---|---|---|
| `job-file-diagnostics/` | `backups/` | `Johnson 123.gr8job` plus its metadata, captured 2026-09-01 while diagnosing job-file loading. Referenced by [`docs/reports/JOB_PERSISTENCE_REPAIR_REPORT.md`](../docs/reports/JOB_PERSISTENCE_REPAIR_REPORT.md). Tracked in git |
| `website-builder-export-2208a52a/` | `2208a52a-8175-477e-823c-fc6de7fe4afe/` | A stray local website-builder site export (`full-project.json`, pages, assets). Git-ignored, as it was at the root. Supabase (`website_builder_sites` / `_pages` / `_page_versions`) is the durable store for customer websites, so this is a discardable local copy |
| `retired-electrical-product-catalogue/` | `data/product-library/catalogues/residential/AU-CLIPSAL-RESIDENTIAL.json` | 410 Clipsal power point / switch / smart-home / data / security product records imported 2026-10-03 only for the abandoned Client Selections electrical product selector. Retired 2026-10-06 when Electrical became a room-by-room quantity schedule: no longer loaded into the Product Library, and the importer for it was removed. Untracked, as it was in `data/` |

Safe to delete either folder once the report that cites it is closed out. The retired electrical
catalogue is safe to delete once no saved job is found to reference a `CLIPSAL-` product code.
