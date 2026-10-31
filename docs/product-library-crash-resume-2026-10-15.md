# Product Library Crash Resume

## A. Surviving Work

Recovered session `6787ac94-3be6-414e-bac4-0f66732dffb5` from the local Copilot session store. Its latest Product Library turn performed investigation only and stopped at unresolved ownership. It did not implement the database-to-effective-catalogue repair.

Confirmed worktree `E:\dev\funnel-builder-clean`, branch `fix/freedom-stage2-foundation`, HEAD `05962e5`. Inspected all 11 tracked modified Product Library files without reverting their changes. Surviving changes include CSV GST/price-status/availability/supplier-reference persistence and review UI, internal catalogue selection/variant improvements, taxonomy and classification changes, and canonical contract changes. The existing import suite passed all 16 checks before this continuation.

Image coverage now confirms the requested 5,643 master products remain present. The other integrity report's 5,933 count is not substituted for this run's observed catalogue count.

## B. Database Connection

Before this continuation, the page loaded `builder_products` but its mapped `orgProducts` did not feed `getEffectiveProductCatalogue()`. The canonical service merged static masters and browser-local private products only. CSV import persistence had already started; canonical database integration had not.

Implemented:

`Static masters + workspace database products + builder overrides -> effective catalogue -> Client Selections -> existing quotation/procurement connectors`

The synchronous public selector API is preserved. Authenticated hydration happens separately, and listeners invalidate consumer lists. Database products retain their UUID as the stable selection identity. Their canonical product code also uses the UUID to avoid collisions between suppliers or with static master SKU codes; supplier SKU is retained separately. Foreign workspace rows are rejected. Static master data is not rewritten. Unknown GST remains unknown rather than becoming an asserted exclusive price.

## C. Ownership

The user explicitly confirmed this session's handoff for Product Library services/page/importer/mapper and product APIs. A second explicit approval allowed the minimal Client Selections hydration connector and revision dependencies in `pages/modules/builders/selections-book.js`.

Historical overlapping sessions recovered:

- Product Library: `6787ac94-3be6-414e-bac4-0f66732dffb5`, previously stopped without edits.
- Client Selections: `fc1956a2-c488-432d-b11a-ef13ecb9940c`, with reboot recovery `03bfaf29-6fc2-45cd-957c-4842e195f321`; its recorded ownership is the shared integrity panel and benchtop workflow.
- Quotation/window reconciliation: `3a8a06ca-d98d-43c3-ba90-02198a37f59d`, with earlier shared quotation work recorded in the 14 October integrity report, including CSV importer/mapper changes.

Session history identifies previous ownership, not which agents are currently typing. No central register or designated integration owner was found. This document records the user-approved handoff; it is not a replacement coordination register or an automatic lock. Workbook hooks, quotation mappings, shared integrity panels, takeoff and procurement implementations were left untouched.

## D. Completed Repairs

- Added workspace-verified database products to canonical effective, family, category and appliance selectors.
- Added authenticated `GET/POST /api/builders/product-catalogue`, using existing products and configuration tables. Membership is checked by `withWorkspace`; writes additionally require owner/admin.
- Added paginated workspace reads, durable private-product writes and durable override metadata in `builder_product_configurations`. Existing configuration metadata is preserved.
- Added Product Library and approved Client Selections hydration, focus/online refresh, canonical revision updates, and private products in the generic guided selection list.
- Serialized workspace writes; failed writes remain recoverable and retry on focus/online. Product save and package-import success wait for cloud completion. Unchanged enablement references do not all become database writes.
- Preserved database product unit, numeric pricing columns, images, supplier metadata, room applicability, classification and selection-slot IDs. Mapper fallbacks use nullish checks so zero is not replaced by an old price.
- Added explicit CSV schema-unavailable response rather than a generic import failure. No production migration was applied.
- Fixed Dulux interior-paint image coverage with an existing shipped category image. Exact product image status is still honestly incomplete.
- Generated `artifacts/product-library-foundation-exceptions.json` without replacing the surviving price audit.

## E. Verification

| Check | Result |
| --- | --- |
| Existing and strengthened CSV suite | PASS, 16 checks |
| New canonical database/repository suite | PASS, 4 groups covering identity, master preservation, prices/images, queued writes, offline retry, PGlite persistence, fresh-device hydration, metadata preservation, stale-write rejection and tenant boundaries |
| Required isolated journey | PASS as database/selector/connector contracts: import -> PGlite commit -> canonical discovery -> selection -> one quote row and procurement item, quantity 2, rate 132 ex GST -> isolated JSON job save/reopen -> fresh browser-storage simulation -> private product invisible to builder B |
| Approved inclusion snapshots and existing selection prices | PASS, unchanged in isolated import suite |
| Selection-integrity safety gates | PASS, 30 checks |
| Dulux/full image coverage | PASS, 5,643 products, 3,108 local image paths |
| Focused lint | PASS, zero errors; existing hook/image warnings remain |
| Touched diff whitespace | PASS |
| Shared-catalogue neighboring test | FAIL at existing root Back navigation source assertion (`scripts/test-product-library-shared-catalogue.mjs:323`); this continuation did not alter navigation |
| Live browser Product Library | BLOCKED: existing localhost:3000 server returns HTTP 500 before rendering, reproduced twice |
| Integrated browser API probe | BLOCKED independently by `Storage.getCookies` protocol error; no live API acceptance claimed |

The initial new JSON reopen assertion failed because JSON omits `undefined` fields; corrected to compare the JSON-persistable representation, then the same suite passed. The initial lint gate found the existing test variable named `module`; the local test-only rename cleared the focused gate.

### Exceptions

Scope: 5,573 active visible static master products, not a live builder-private inventory. There are 4,560 products with at least one completeness or price-provenance exception:

- Missing resolved price: 2,550.
- Missing pricing unit: 76.
- Incomplete exact product image: 1,022.
- Missing description: 1,255.
- Priced without recorded source URL/date/note: 1,331.

Counts overlap. Category fallback images do not count as verified exact product imagery. Missing prices were not invented and catalogue source files were not changed.

## F. Remaining Gates

Read-only live schema probes confirm `builder_products`, `builder_product_configurations`, `builder_product_suppliers` and `builder_product_manufacturers` exist. `builder_product_imports` returns `PGRST205`: missing from the schema cache.

Database-owner review/approval is required for the existing `supabase/migrations/20261004000100_builder_product_csv_import.sql` and its `commit_builder_product_import` function, including dependency/security review. Do not replace transactional staging with a browser-only or nontransactional production importer. No migration was applied, no live product/job was created, and no production import was attempted. The function's production presence was not independently verified.

Live authenticated UI import/reload, actual second-device acceptance, and browser Client Selections save/reopen remain unverified until the server and CSV staging schema are available. Isolated database tests are not a substitute for those release gates. Older browser-only products and overrides remain intact as recovery data; their entire historical state was not automatically uploaded to production.

### Quotation Owner Handoff

Awaiting acknowledgement by the existing Quotation Builder owner; no inter-session messaging channel or designated register was available here. Do not treat passing connector tests as ownership acknowledgement.

- Consume effective products by authenticated workspace, not static `getMasterProducts()` alone where builder-private products are expected.
- Imported product identity is the database UUID; supplier SKU remains a distinct field.
- Carry requirement/selection-slot metadata, quantity, unit, nullable GST and the frozen selected-price snapshot.
- Keep mapping verification builder/template-specific. This repair does not invent or approve quotation targets.
- The isolated kitchen-mixer fixture resolves quantity 2 and GST-exclusive rate 132 into exactly one quote row and one procurement requirement on repeat sync.
- Existing approved job snapshots must remain frozen when catalogue or builder prices change.

Original New Job 03/09 and its archives were not opened or modified. No reset, clean, checkout, discard, commit, merge, push, deployment, production migration or live database write was performed by this continuation. The pre-existing development server was not started, stopped or restarted.