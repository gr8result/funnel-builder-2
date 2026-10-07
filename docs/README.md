# Documentation index

Everything under `docs/` is written documentation. Generated data (CSVs, screenshots,
scraped pages) lives outside this tree — see [Where the generated files went](#where-the-generated-files-went).

## Folders

| Folder | What is in it |
|---|---|
| [`architecture/`](architecture/) | System architecture, schemas, field maps, and the platform modularisation programme |
| [`catalogue/`](catalogue/) | Product Library / master catalogue documentation and generated import reports |
| [`freedom/`](freedom/) | Freedom Trader module reports (holdings, trades, access repairs) |
| [`security/`](security/) | Security triage and route-access reviews |
| [`reports/`](reports/) | One-off repair and incident reports |
| (root of `docs/`) | Dated working notes and per-feature audits |

## Root-file relocation — 2026-09-07

These files used to sit at the repository root. They were moved to cut the root down
from ~90 entries; nothing was renamed, and `git log --follow <new path>` still shows the
full history of each one. The moves follow the plan already written in
[`architecture/PLATFORM_MODULARISATION_MASTER_PLAN.md`](architecture/PLATFORM_MODULARISATION_MASTER_PLAN.md) §7.

### Documentation

| Was at root | Now at |
|---|---|
| `AI_PLAN_TAKEOFF_JOB_SETUP_MAPPING.md` | `docs/architecture/` |
| `ESTIMATE_BUILDER_ARCHITECTURE.md` | `docs/architecture/` |
| `PLATFORM_MODULARISATION_MASTER_PLAN.md` | `docs/architecture/` |
| `PROJECT_SETUP_SCHEMA.md` | `docs/architecture/` |
| `QUOTE_PROPOSAL_FIELD_MAP.md` | `docs/architecture/` |
| `REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md` | `docs/architecture/` |
| `SELECTIONS_BOOK_ARCHITECTURE_AUDIT.md` | `docs/architecture/` |
| `TAKEOFF_ENGINE_ARCHITECTURE.md` | `docs/architecture/` |
| `TAKEOFF_LEGACY_CLEANUP_EXECUTION_PLAN.md` | `docs/architecture/` |
| `USAGE_LIMITS.md` | `docs/architecture/` |
| `WORKBOOK_FIELD_MAP.md` | `docs/architecture/` |
| `APPLIANCE_CATALOGUE_COVERAGE_REPORT.md` | `docs/catalogue/` |
| `APPLIANCE_CATALOGUE_IMPORT_REPORT.md` | `docs/catalogue/` |
| `APPLIANCE_CHECKPOINT1_RECONCILIATION.md` | `docs/catalogue/` |
| `APPLIANCE_COMPLETE_CATALOGUE_REPORT.md` | `docs/catalogue/` |
| `APPLIANCE_LEGACY_CSV_MAPPING.md` | `docs/catalogue/` |
| `APPLIANCE_PRODUCT_ENRICHMENT_REPORT.md` | `docs/catalogue/` |
| `CABINETRY_PRODUCT_LIBRARY_MAPPING.md` | `docs/catalogue/` |
| `MASTER_CATALOGUE_ARCHITECTURE.md` | `docs/catalogue/` |
| `MASTER_CATALOGUE_RECONCILIATION_REPORT.md` | `docs/catalogue/` |
| `MASTER_CATALOGUE_SOURCE_AUDIT.md` | `docs/catalogue/` |
| `MASTER_CATALOGUE_STAGE3_MIGRATION_PLAN.md` | `docs/catalogue/` |
| `PRODUCT_LIBRARY_CSV_IMPORT_GUIDE.md` | `docs/catalogue/` |
| `PRODUCT_LIBRARY_SYNC_IMPLEMENTATION_REPORT.md` | `docs/catalogue/` |
| `PRODUCT_LIBRARY_TAXONOMY_CORRECTION_REPORT.md` | `docs/catalogue/` |
| `CMC_ORDERS_IMPORT_REPORT.md` | `docs/freedom/` |
| `FREEDOM_ACCESS_REPAIR_REPORT.md` | `docs/freedom/` |
| `FREEDOM_CMC_HOLDINGS_UPDATE_REPORT.md` | `docs/freedom/` |
| `FREEDOM_MY_TRADES_REPAIR_REPORT.md` | `docs/freedom/` |
| `FREEDOM_TIGER_HOLDINGS_UPDATE_REPORT.md` | `docs/freedom/` |
| `HOLDINGS_DASHBOARD_IMPLEMENTATION.md` | `docs/freedom/` |
| `UNAUTHENTICATED_ROUTE_TRIAGE.md` | `docs/security/` |
| `JOB_PERSISTENCE_REPAIR_REPORT.md` | `docs/reports/` |
| `RECOVERY_COPY_ON_WRITE_REPAIR.md` | `docs/reports/` |

### Where the generated files went

| Was at root | Now at | Why |
|---|---|---|
| 21 `APPLIANCE_*.csv` / `MASTER_CATALOGUE_*.csv` / `PRODUCT_LIBRARY_QUOTATION_PRODUCT_MAPPING.csv` | [`data/catalogue/reconciliation/`](../data/catalogue/reconciliation/) | Script output, not documentation — see that folder's README for which script writes each file |
| `PRODUCT_LIBRARY_IMPORT_TEMPLATE.csv`, `ESTIMATING_CATALOGUE_IMPORT_TEMPLATE.csv` | [`data/catalogue/imports/`](../data/catalogue/imports/) | Hand-maintained import templates |
| `tmp-caesarstone.html`, `tmp-neolith.html`, `tmp-smartstone.html`, `tmp-stoneambassador.html`, `tmp-neolith-state.js` | [`data/catalogue/raw/`](../data/catalogue/raw/) | Scraped supplier pages kept as catalogue provenance |
| `pricing-grid.xlsx` | `data/pricing-grid.xlsx` | Written by `scripts/export-pricing-grid.cjs` |
| `supabase-schema.sql` | `supabase/supabase-schema.sql` | Belongs with the rest of the Supabase definitions |
| `docker-compose*.yml`, `ecosystem.config.cjs`, `reset-dev.ps1` | [`deploy/`](../deploy/) | See `deploy/README.md` for how to run them from the new location |
| `emailQueueWorker.js` | `platform-core/notifications/emailQueueWorker.js` | Platform service, not a root script |
| `verify-holdings.js`, `agent.js` | `scripts/` | One-off helper scripts |
| `test-artifacts/`, `test-results/` | [`artifacts/`](../artifacts/) | Both are test output — see `artifacts/README.md` |
| `backups/`, `2208a52a-8175-477e-823c-fc6de7fe4afe/` | [`archive/`](../archive/) | Local one-off snapshots — see `archive/README.md` |
| `eng.traineddata` | `.cache/tesseract/` (git-ignored) | tesseract.js download cache; `lib/freedom/tradeImport.js` now sets `cachePath` so it lands there |

### Renamed

| Was | Now | Why |
|---|---|---|
| `Client Portal/` | `client-portal/` | The space in the path broke glob and CLI tooling. The 11 import sites in `pages/` and `components/` were updated in the same commit. This is item B5 in [`architecture/PLATFORM_MODULARISATION_MASTER_PLAN.md`](architecture/PLATFORM_MODULARISATION_MASTER_PLAN.md) |
| `take off.code-workspace` | `take-off.code-workspace` | Same reason |
| `src/modules/inclusions-selections/README.md` | [`INCLUSIONS_SELECTIONS_MODULE_SCOPE.md`](INCLUSIONS_SELECTIONS_MODULE_SCOPE.md) | It was the only file under `src/`, and it is scope documentation rather than code. `src/` is gone; the module's architecture notes are in [`INCLUSIONS_SELECTIONS_ARCHITECTURE.md`](INCLUSIONS_SELECTIONS_ARCHITECTURE.md) |

### Deleted, not moved

`.next-persistence-repair/`, `.next-internal-verification/`, `.next-entry-door-progression/`,
`.next-exterior-verification/`, `.next-exterior-wizard-verification/`,
`.next-job-setup-investigation/` and `.next-build/` were Next.js build output from one-off
`NEXT_DIST_DIR` debugging runs. Two of them had been committed by accident (~490 files);
all are regenerated by `npm run dev` / `npm run build`. `.gitignore` now carries `/.next-*/`
so this cannot recur. `dev-server.log`, the empty `.codex-schema-dump.sql` and `tsconfig.tsbuildinfo` (4 MB, rebuilt by
`npm run typecheck`) were removed too.

### Still open

Two root files were deliberately left alone because they need an owner decision, both recorded in
[`architecture/PLATFORM_MODULARISATION_MASTER_PLAN.md`](architecture/PLATFORM_MODULARISATION_MASTER_PLAN.md) §11:
`postcss.config.js` (Tailwind v3 style) and `postcss.config.mjs` (Tailwind v4 style) are a
conflicting duplicate pair — Next.js loads one and the other is dead.
