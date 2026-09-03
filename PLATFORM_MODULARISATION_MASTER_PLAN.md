# Platform Modularisation — Master Plan

**Audit only. No files have been moved, renamed or deleted. No functionality altered.**

- Produced: 2026-09-03
- Branch: `safety/pre-takeoff-cleanup-2026-09-01`
- HEAD at audit: `4fed0c1852e8d138560d8b5c0b6d9370373f54a8`
- Companion documents: [TAKEOFF_LEGACY_CLEANUP_EXECUTION_PLAN.md](TAKEOFF_LEGACY_CLEANUP_EXECUTION_PLAN.md), [REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md](REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md)
- Scale: **2,317 tracked files**, 328 route pages, 510 API routes, 58 migrations, 169 scripts

---

## Executive summary — the three findings that shape everything

### 1. Seventeen of the twenty-one proposed modules are not folders. They are page keys inside one file.

`components/estimate-builder/EstimateBuilderWorkbook.js` is **19,234 lines** and contains **186 top-level
component definitions** and **29 page keys**. Job Details, BOQ, Quotation, Standard Inclusions, Product
Library, Estimating Catalogue, Supplier Procurement, Budget vs Actual, Variations, Document Vault, RFIs,
Gantt, Job Board, Client Selections, Client Portal and AI Plan Takeoff are all *pages within this
workbook*, not independent units.

This is the central structural obstacle. It is also better than it first appears — see finding 2.

### 2. The workbook is a router, not a monolith of page bodies.

Every one of the 29 page keys **delegates to a named component**. The workbook is a shell: a page
registry, a shared `sheet` state object, a `commercialModuleContext` prop bundle, toolbars, and a
switch. That means extraction is mostly a matter of moving already-separate components and replacing
two shared prop bundles with explicit interfaces — not rewriting 19,000 lines.

The exception is ten components defined *inline* in the workbook, listed in §2.3. Those must be carved
out. `SummarySheet` alone is ~2,186 lines.

### 3. No API route on the platform checks what the customer purchased.

| Measure | Count | Reading |
|---|---:|---|
| API routes | 510 | Full server surface |
| Routes establishing identity (auth) | 421 | Authentication largely present |
| Routes with no auth reference | 89 | ~7 legitimately public (webhooks, tracking) |
| **Routes checking plan / module entitlement** | **0** | **The hole** |
| Pages using `useModuleGuard` | 2 | Client-side only; renders a `<Locked>` component |

26 routes mention a plan or subscription; on inspection they are the billing routes themselves —
`checkout`, `webhook`, `apply-plan`. They *manage* subscriptions, they do not consult them to
authorise anything. `lib/withWorkspace.js` (132 lines) verifies workspace **membership only** — zero
references to plan, module or entitlement.

**Consequence:** a signed-in customer on the cheapest plan holds a valid session, and every
estimate-builder, takeoff, website-builder and catalogue API will answer it. `lib/moduleEntitlements.js`
resolves entitlement *in the browser* to decide which dashboard tiles to render. Hiding a tile does not
stop a request.

**Freedom is worse:** 32 of its 33 API routes have no authentication of any kind, and it touches no
`accounts`, `profiles` or `workspaces` table — so there is no per-user isolation either. Extracting
Freedom as-is would ship an unauthenticated application.

---

## 1. Current file-tree problems

| # | Problem | Evidence |
|---|---|---|
| 1 | Modules are page keys inside one 19k-line file | `EstimateBuilderWorkbook.js`, 29 page keys, 186 component definitions |
| 2 | Route files imported as components | 11 `dynamic(() => import("../../pages/modules/builders/…"))` calls in the workbook. These files are simultaneously Next.js routes *and* React components. |
| 3 | A library imports an API route | `lib/freedom-trader/marketData.js:1` imports `TRADER_WATCHLIST` from `pages/api/freedom-trader/watchlist.js` |
| 4 | Directory name contains a space | `Client Portal/` (14 files), imported as `"../../Client Portal/RouteBridge"` |
| 5 | Shared code has no home | `lib/` 240 files, `components/` 212, `hooks/` 11, `utils/` 7, `services/` 2, `src/` 1 — five overlapping "shared" locations |
| 6 | Two coupling channels bypass module boundaries | `sheet={sheet}` and `{...commercialModuleContext}` are passed to nearly every page component |
| 7 | 81 files at repository root | 32 tracked + 49 untracked, including reports, scraped HTML, an OCR model and a spreadsheet |
| 8 | Duplicate build configuration | `postcss.config.js` (Tailwind v3 style) **and** `postcss.config.mjs` (Tailwind v4 style) both present with conflicting plugin sets |
| 9 | Corrupted filename tracked in git | `"ing leads\357\200\242 af5336c"` — artefact of a broken shell command |
| 10 | Deployment config untracked | `.vercelignore` exists on disk only; deploy excludes depend on one machine |
| 11 | Test scripts are flat | 169 files in `scripts/`, 72 of them `test-*`, with no module grouping |

---

## 2. Module ownership map

Counts are tracked files. "Home" is where the module's code predominantly lives today.

### 2.1 Modules that already have a real folder

| Module | Files | Current home | Separability |
|---|---:|---|---|
| **Email** | 156 | `pages/modules/email` (94), `pages/api/email` (55), `lib/email` | Good |
| **Website Builder** | 113 | `pages/modules/website-builder`, `components/website-builder`, `pages/api/website*`, `lib/website-builder`, `modules/website-builder` | Good — but spread over 5 roots |
| **Standard Inclusions** | 89 | `standard-inclusions/`, `components/standard-inclusions`, `pages/api/standard-inclusions` | Good |
| **Social** | 58 | `pages/api/social` (44), `pages/modules/social_media` | Good |
| **Freedom** | 99 | See §5 | Good at data layer; auth missing |
| **CRM** | 49 | `pages/api/crm` (12), `components/crm` | Good |
| **Gantt** | 41 | `components/gantt`, `components/estimate-builder/gantt`, `pages/modules/gantt` | Split across two homes |
| **Product Library** | 36 | `data/product-library`, `lib/product-library` | Data + lib only; UI is inline in workbook |
| **AI Plan Takeoff** | 7 | `components/construction-estimation/ai-plan-takeoff` | **Already isolated** (the retained engine) |
| **Leads** | 7 | `pages/api/lists`, `lead_lists` tables | Small; overlaps CRM |
| **Client Portal** | 14 | `Client Portal/` | Needs rename first |

### 2.2 Modules that delegate to a route file (extract by moving the route)

These render from `pages/modules/builders/*`, imported by the workbook via `dynamic()`. Each is a real
file that can become a module — but it must stop being a route-and-component at the same time.

| Module | Route file | Workbook line |
|---|---|---:|
| BOQ | `pages/modules/builders/boq` | 104 |
| Purchase Orders | `pages/modules/builders/purchase-orders` | 109 |
| Variations | `pages/modules/builders/variations` | 114 |
| Budget vs Actual | `pages/modules/builders/budget-vs-actual` | 119 |
| Supplier Invoices | `pages/modules/builders/supplier-invoices` | 124 |
| Supplier Procurement | `pages/modules/builders/procurement-schedule` | 129 |
| Client Selections | `pages/modules/builders/selections-book` | 134 |
| Quote Approvals | `pages/modules/builders/quote-approvals` | 146 |
| Document Vault | `pages/modules/builders/document-vault` | 151 |
| RFI Reports | `pages/modules/builders/rfis` | 156 |
| Job Board | `pages/modules/jobboard` | 94 |

### 2.3 Modules defined *inline* inside the workbook (must be carved out)

These have no file of their own. Line spans are approximate, measured between adjacent top-level
definitions.

| Component | Approx. lines | From line | Becomes module |
|---|---:|---:|---|
| `SummarySheet` | ~2,186 | 3,055 | (workbook internal) |
| `QuotationSheet` | ~457 | 2,509 | **quotation-builder** |
| `EstimateInclusionsSheet` | ~320 | 12,397 | (estimate-builder internal) |
| `EstimatingCatalogueSheet` | ~224 | 8,556 | **estimating-catalogue** |
| `ProductLibrarySheet` | ~191 | 8,365 | **product-library** |
| `ClientSelectionsModuleHost` | ~161 | 1,452 | **client-selections** (host only; body is in the route file) |
| `WindowsDoorsSheet` | ~126 | 2,284 | (estimate-builder internal) |
| `CashflowSummarySheet` | ~58 | 12,717 | (estimate-builder internal) |
| `ProjectEstimateSheet` | ~23 | 8,338 | thin wrapper — delegates onward |
| `SupplierProcurementSheet` | ~16 | 1,918 | thin wrapper — delegates onward |

### 2.4 Modules requiring design, not relocation

| Proposed module | Reality today |
|---|---|
| **job-details** | A page key (`jobDetails`) in the workbook registry. No dedicated files. |
| **quotation-builder** | `QuotationSheet` inline (~457 lines) + `lib/construction-estimation/finalQuotationBoq.js`. |
| **estimating-catalogue** | `EstimatingCatalogueSheet` inline (~224 lines). Shares data with product-library. |
| **budget-actual** | Route file exists; no service or data layer of its own. |

These four are *features of the workbook*. If they are separately purchasable, the boundary has to be
designed — where does Estimate Builder end and Quotation Builder begin? That is a product decision I
cannot make from the code, and it is listed in §11.

### 2.5 Database ownership

58 migrations. Tables cluster cleanly by module.

| Owner | Tables (principal) |
|---|---|
| **platform-core** | `accounts` (80 refs), `profiles` (24), `workspaces` (17), `workspace_members` (21), `users` (18), `assets` (26) |
| Email | `email_sends` (37), `email_automations`, `email_autoresponder_queue` |
| Social | `social_accounts` (33), `social_posts`, `social_schedule`, `social_queue`, `social_oauth_*`, `social_image_library` |
| CRM / Leads | `leads` (69), `lead_lists`, `crm_calls` |
| Website Builder | `published_websites` (23) |
| Estimate Builder | `estimate_templates` (18), `builder_project_documents` (14) |
| Automation | `automation_flows`, `automation_flow_runs`, `automation_flow_members` |
| Vendors / Affiliate | `vendors` (29), `vendor_agreements`, `affiliate_applications` (27) |
| Bookings | `bookings` (20), `services` (15) |
| **Freedom** | ~30 tables — see §5.2. **Zero overlap with any other module.** |

---

## 3. Proposed final folder tree

```
platform-core/
  authentication/          session, login, verify-email, verify-login, middleware guard
  subscription-entitlements/  server-side resolver + withModule() + guardPage()
  workspaces/              workspaces, workspace_members, active-workspace context
  billing/                 stripe, paypal, plans, checkout, invoices, webhooks
  navigation/              nav-config, Layout, SideNav, page-switcher
  shared-ui/               buttons, modals, tables, form primitives, document-engine
  database/                supabase clients, migrations, typed table access
  storage/                 asset upload/download, buckets
  notifications/           email/SMS dispatch primitives (not the Email module)

modules/
  freedom/                 pages components api services data migrations tests assets
  estimate-builder/
  ai-plan-takeoff/
  client-selections/
  quotation-builder/
  job-details/
  gantt-chart/
  job-board/
  boq/
  supplier-procurement/
  variations/
  document-vault/
  rfi-reports/
  standard-inclusions/
  product-library/
  estimating-catalogue/
  budget-actual/
  leads/
  crm/
  website-builder/
  client-portal/

data/
  catalogue/{imports,reconciliation,raw}/
  product-library/
docs/
  catalogue/
  architecture/
scripts/
  catalogue/  website/  email/  platform/  <module>/
```

Every module carries a `module.json`:

```json
{
  "id": "estimate-builder",
  "entry": "pages/index.jsx",
  "routes": ["/modules/estimate-builder"],
  "tables": ["estimate_templates", "builder_project_documents"],
  "dependsOn": ["platform-core/authentication", "platform-core/database"],
  "planFeature": "estimate_builder"
}
```

This file is what makes "removable without breaking unrelated modules" testable rather than
aspirational: a script can assert no module imports another module's internals and that every table it
touches is declared.

**The one rule:** modules may import from `platform-core/`. Modules may **not** import from each other.
Shared logic moves into platform-core; it is never copied. Without a CI test enforcing this, the new
structure decays back into the current one.

---

## 4. Cross-module dependency map

### 4.1 Hard blockers (must be fixed before the owning module can move)

| # | Dependency | Why it blocks | Fix |
|---|---|---|---|
| B1 | Workbook `dynamic()`-imports 11 route files as components | Moving the route breaks the import; moving the component breaks the route | Split each into `modules/<m>/pages/index.jsx` (thin route) + `modules/<m>/components/<M>Page.jsx` (the component) |
| B2 | `lib/freedom-trader/marketData.js` imports `pages/api/freedom-trader/watchlist.js` | A library depending on a route; breaks any standalone build | Move `TRADER_WATCHLIST` into `modules/freedom/data/watchlist.js`; both import from there |
| B3 | `commercialModuleContext` spread into ~15 page components | Implicit, untyped, shared surface — the real coupling | Define an explicit `ModuleContext` interface in platform-core; pass named props |
| B4 | `sheet={sheet}` shared mutable workbook state | Every sheet reads and writes one object | Narrow per module to the slice it needs before extraction |
| B5 | `Client Portal/` directory name has a space | Breaks tooling, imports and package resolution | Rename to `client-portal/` in its own commit, early |
| B6 | 10 components defined inline in the workbook (§2.3) | No file to move | Carve out one per commit, each with a render-parity test |

### 4.2 Soft couplings (tolerable during transition)

- `components/` internal relative imports: `../core/` (32), `../objects/` (16), `../defaults/` (8),
  `../document-engine/` (4), `../website-builder/` (3). Most resolve to platform-core or the
  document-engine; they become package imports after §3.
- `components/estimate-builder/project-estimate/pages/*` — a *local* subfolder named `pages`, not Next
  routes. Harmless, but rename to `sections/` to avoid confusion during the migration.

### 4.3 Not a dependency

`modules/website-builder/` currently holds only two files (`blocks/accordion/AccordionBlock.js`,
`utils/inlineHtml.js`) — the remainder of Website Builder lives under `components/` and `pages/`. The
existing `modules/` directory is *not* the target structure; it is a leftover from the takeoff rebuilds.

---

## 5. Freedom standalone extraction plan

Freedom is the right first module: it is self-contained at the data layer, has its own migrations, and
is small enough that mistakes are cheap.

### 5.1 Current footprint — 99 files

| Location | Files |
|---|---:|
| `pages/api/freedom-trader` | 17 |
| `lib/freedom-trader` | 13 |
| `pages/freedom-trader` | 10 |
| `pages/api/freedom` | 10 |
| `test/` (freedom tests) | 9 |
| `supabase/migrations` (freedom) | 9 |
| `lib/freedom-terminal` | 4 |
| `lib/freedom-investment` | 4 |
| `pages/api/freedom-investment` | 3 |
| `scripts/` (freedom) | 3 |
| `components/freedom-trader` | 3 |
| `pages/freedom`, `pages/api/freedom-portfolio`, `lib/freedom` | 6 |

### 5.2 Data layer — clean

~30 tables, all Freedom-only. Verified zero overlap: `companies`, `background_jobs`, `alerts` and
`watchlists` are referenced **only** by Freedom files. Freedom touches **none** of `accounts`,
`profiles`, `workspaces` or `assets`.

`freedom_companies`, `freedom_scores`, `freedom_score_history`, `freedom_score_calibration`,
`freedom_valuations`, `freedom_research`, `freedom_committee_reviews`, `freedom_trade_events`,
`freedom_paper_accounts`, `freedom_paper_orders`, `freedom_paper_positions`, `freedom_paper_trades`,
`companies`, `company_scores`, `company_competitors`, `company_import_jobs`, `financials`,
`financial_metrics`, `analyst_estimates`, `historical_prices`, `live_prices`, `industry_scores`,
`watchlists`, `watchlist_items`, `open_positions`, `closed_trades`, `pending_trades`, `trade_alerts`,
`alerts`, `background_jobs`.

### 5.3 Target package

```
modules/freedom/
  pages/                 freedom, freedom-trader, freedom-portfolio routes
  components/            3 files from components/freedom-trader
  api/                   33 route handlers
  services/              lib/freedom-trader, freedom-terminal, freedom-investment
  data/                  watchlist.js (from B2), fixtures
  migrations/            the 9 freedom migrations
  tests/                 9 existing + new entitlement negative suite
  assets/
  .env.example           NAMES ONLY — no values, no real keys
  package.json
  module.json
  README.md              install, migrate, seed, run, required env vars
```

### 5.4 Blockers specific to Freedom

1. **B2** — `lib/freedom-trader/marketData.js` imports an API route. Must be fixed first.
2. **Authentication is absent.** 32 of 33 routes have no auth. A standalone Freedom must gain
   authentication as part of extraction, not after — otherwise the standalone package is an open
   endpoint on whatever machine it is installed on.
3. **No workspace isolation.** Freedom data is global. If Freedom is multi-tenant, it needs a
   workspace or user column and RLS before it can be sold.
4. **`scripts/seed-freedom-terminal-core.mjs` uses the service role key.** It must stay a local
   operator script and must never ship inside the distributable package.

### 5.5 Secrets

The package ships `.env.example` containing **variable names and placeholder values only**. Real keys
live in the operator's own `.env`, which is never copied. This audit did not read, print or copy any
environment file.

---

## 6. Subscription security architecture

Three enforcing layers plus one presentational layer, all reading one server-side answer.

### 6.1 The resolver

`platform-core/subscription-entitlements/resolve.js` — server-only. Input: request. Output:
`{ userId, workspaceId, planId, entitledModules: Set }`. It reuses the existing, sound logic in
`lib/moduleEntitlements.js` (`MODULE_PLAN_FEATURES`, `modulesIncludedInPlan()`,
`buildEntitledModuleIds()`), which today runs in the browser. The logic is not the problem; its
location is.

### 6.2 The layers

| Layer | Mechanism | Closes | Status today |
|---|---|---|---|
| **API** | `withModule("estimate-builder")(handler)` — resolves server-side, returns `403` | Direct API calls bypassing the UI | **Absent** |
| **Page** | `guardPage("estimate-builder")` in `getServerSideProps` — redirect to billing | Paid markup and bundled data shipping to unentitled users | **Absent** |
| **Data** | Supabase RLS keyed on workspace membership | The next route someone forgets to wrap | Needs audit |
| **Edge** | `middleware.js` coarse gate on `/modules/*` | Whole-module access before a page even loads | Middleware exists but does website-domain routing only |
| **Navigation** | `moduleEntitlements` tile filtering | Nothing — a courtesy, not a control | Works; demote to presentation |

`middleware.js` is a single choke point every request already passes through. Adding a coarse module
gate there is high value for low effort, and it is the one place that cannot be forgotten when a new
route is added.

### 6.3 The test that proves it

For each module: authenticate as a user whose plan **excludes** it, call every one of its API routes
directly, assert `403`. Written first, this suite fails loudly today — that is the point. It then
becomes the regression guard.

### 6.4 Workspace isolation

Entitlement answers *may this customer use this module*. Workspace isolation answers *may this customer
see this row*. Both are required. `lib/withWorkspace.js` provides the second and must be composed with
the first, not replaced by it.

---

## 7. Root-file cleanup plan

**81 files at repository root: 32 tracked, 49 untracked.**

**Move-safety test performed:** none of the 49 untracked root files is referenced by any file in
`pages/`, `components/`, `lib/`, `hooks/` or `utils/`. They are reports and data, not application code,
so relocating them cannot break an import or a route.

### 7.1 Catalogue files — classification and destination

| Classification | Count | Examples | Destination |
|---|---:|---|---|
| **Documentation** | 17 `.md` | `MASTER_CATALOGUE_ARCHITECTURE.md`, `APPLIANCE_CATALOGUE_COVERAGE_REPORT.md`, `PRODUCT_LIBRARY_CSV_IMPORT_GUIDE.md`, `CABINETRY_PRODUCT_LIBRARY_MAPPING.md` | `docs/catalogue/` |
| **Generated audit / reconciliation data** | ~17 `.csv` | `APPLIANCE_FIELD_SOURCE_AUDIT.csv`, `MASTER_CATALOGUE_DUPLICATE_REVIEW.csv`, `APPLIANCE_PRODUCT_DEDUPLICATION.csv`, `MASTER_CATALOGUE_UNRESOLVED_REVIEW.csv` | `data/catalogue/reconciliation/` |
| **Import templates (source data)** | ~6 `.csv` | `PRODUCT_LIBRARY_IMPORT_TEMPLATE.csv`, `ESTIMATING_CATALOGUE_IMPORT_TEMPLATE.csv` | `data/catalogue/imports/` |
| **Scraped supplier raw data** | 6 | `tmp-caesarstone.html`, `tmp-neolith.html`, `tmp-smartstone.html`, `tmp-stoneambassador.html`, `tmp-neolith-state.js` | `data/catalogue/raw/` — or delete; these are scrape by-products |
| **Generated schema dump** | 1 | `.codex-schema-dump.sql` | `supabase/` and git-ignore |
| **Build artefact** | 1 | `eng.traineddata` (Tesseract OCR model) | Not source. Vendor deliberately or ignore. |
| **Active deploy config** | 1 | `.vercelignore` | **Do not move.** Commit it — see §11. |

Catalogue code already has a home and does **not** move: `lib/product-library/` and
`data/product-library/` (36 files), plus 19 catalogue scripts in `scripts/` which regroup under
`scripts/catalogue/`.

### 7.2 Tracked root files

| Action | Files |
|---|---|
| Keep at root (real config) | `package.json`, `next.config.mjs`, `tsconfig.json`, `jsconfig.json`, `middleware.js`, `vercel.json`, `.gitignore`, `eslint.config.mjs`, `tailwind.config.js`, `deno.json`, `README.md`, `package-lock.json` |
| Move to `docs/architecture/` | `ESTIMATE_BUILDER_ARCHITECTURE.md`, `TAKEOFF_ENGINE_ARCHITECTURE.md`, `PROJECT_SETUP_SCHEMA.md`, `WORKBOOK_FIELD_MAP.md`, `QUOTE_PROPOSAL_FIELD_MAP.md`, `USAGE_LIMITS.md`, `REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md`, `TAKEOFF_LEGACY_CLEANUP_EXECUTION_PLAN.md` |
| Move to `deploy/` | `docker-compose.yml`, `docker-compose.onlyoffice.yml`, `docker-compose-sitebuilder.yml`, `ecosystem.config.cjs`, `reset-dev.ps1` |
| Move to `data/` | `pricing-grid.xlsx`, `supabase-schema.sql` |
| Move to `platform-core/notifications/` | `emailQueueWorker.js` |
| **Resolve duplicate** | `postcss.config.js` vs `postcss.config.mjs` — see §11 |
| **Delete** | `"ing leads\357\200\242 af5336c"` (corrupted filename), `take off.code-workspace` (or rename without the space) |

---

## 8. Safe relocation batches

Ordered so routes keep working throughout, and so the security hole closes **before** large-scale file
movement. Moving 300+ files first would mean testing every route twice.

| Batch | Work | Files | Gate |
|---|---|---:|---|
| **M0** | Finish deletion batches 5–8 of the takeoff cleanup | ~40 | Batch 8 verification incl. production build |
| **M1** | Build resolver, `withModule()`, `guardPage()`, middleware gate. Adopt nothing yet. Write the negative suite and watch it fail. | ~8 new | Resolver unit-tested; suite reports true state |
| **M2** | Adopt enforcement on existing routes **in place**. No files move. | ~510 touched | Every module's negative suite passes; the 89 unauthenticated routes triaged |
| **M3** | Rename `Client Portal/` → `client-portal/`; fix B2; delete corrupted filename; resolve postcss duplicate | ~20 | Typecheck, lint, build |
| **M4** | Extract `platform-core/` from `lib/`, `components/`, `hooks/`, `utils/` | ~150 | Full suite + production build |
| **M5** | **Freedom** → `modules/freedom/` incl. migrations, README, `.env.example` | 99 | Freedom builds standalone; routes still serve from main app |
| **M6** | Split the 11 route-as-component files (B1) into thin route + component | 22 | Each route resolves; workbook renders each page |
| **M7** | Carve out the 10 inline sheets (B6), one per commit | 10 commits | Render-parity test per sheet |
| **M8** | Relocate construction modules: estimate-builder, ai-plan-takeoff, standard-inclusions, product-library, estimating-catalogue, gantt | ~250 | Per module: routes resolve, `.gr8job` save/load intact |
| **M9** | Relocate marketing/portal: website-builder, email, social, crm, leads, client-portal | ~400 | Publish, send and portal pipelines verified end to end |
| **M10** | Root cleanup per §7; regroup `scripts/` by module | ~130 | Root holds only config |
| **M11** | Add boundary + removability tests to CI | ~3 new | Cross-module import fails the build |

Each batch is one commit with an explicit pathspec. No batch mixes a move with a behaviour change.

---

## 9. Tests required after every batch

**Always (existing guards):**
`npx tsc --noEmit` · `npm run lint` · `npm run test:job-id` · `npm run test:pdfjs-loader` ·
`npm run test:project-estimate-pdf-importer` · `node scripts/test-ai-plan-takeoff-integration.mjs` ·
`node scripts/test-master-gr8job-package.mjs` · `node scripts/test-local-job-file-open-integrity.mjs`

**Per batch, additionally:**

| Batch | Additional |
|---|---|
| M1–M2 | Entitlement negative suite (unentitled session → every module API → assert `403`) |
| M3 | Import-resolution sweep after the rename |
| M4 | Production build — platform-core extraction is the highest-risk import change |
| M5 | **Freedom standalone build**: builds as its own Next.js app against platform-core only |
| M6–M7 | Render-parity: each extracted page renders identically to its pre-extraction output |
| M8 | `.gr8job` save/load round-trip; `/modules/estimate-builder?page=<key>` resolves for all 29 keys |
| M9 | Website publish pipeline; email send pipeline; client-portal link resolution |
| M10 | No broken relative paths in scripts; `npm run <script>` for all 37 npm scripts |
| M11 | Boundary test (no cross-module imports); removability test (exclude each module, app still builds) |

**Three new tests the architecture requires:**

1. **Boundary test** — walks every import under `modules/`, fails on cross-module reach-through or an
   undeclared table.
2. **Removability test** — excludes each module in turn, asserts the app still compiles and all other
   routes resolve. This is the mechanical proof of the "removable" requirement.
3. **Entitlement negative suite** — per §6.3.

---

## 10. Rollback procedure

Every batch is a single commit on the safety branch, so rollback is uniform.

**Within a batch, before commit:**
```bash
git checkout -- <explicit paths>          # tracked modifications
git clean -n <path>                       # DRY RUN first — lists untracked additions
```

**After a batch is committed:**
```bash
git revert --no-commit <batch-sha> && git commit
```
Revert is preferred over reset: the branch carries 4 completed cleanup commits and 25 pre-existing
staged deletions that must not be disturbed.

**Mandatory before any batch that deletes or overwrites untracked work:**
commit it to the safety branch first. This was the pattern used in Batch 4 of the takeoff cleanup
(checkpoint `97853be` archived 46 files before deletion) and it must be repeated. Untracked files are
not recoverable — no checkout, no revert, no reflog.

**Verify a rollback:**
```bash
git status --porcelain | wc -l            # expect the pre-batch count
npx tsc --noEmit && npm run lint
```

**Preserved invariants across all batches:** the 25 pre-existing staged deletions stay staged; `.env`
and `.env.example` are never staged or modified; `recovery/ARCHIVED-FAILED-JOHNSON-RECOVERY-20260902`
(5,098 files) stays byte-identical.

---

## 11. Files requiring manual review

Decisions I cannot make from the code.

| # | Item | Question |
|---|---|---|
| 1 | **Module boundaries for job-details, quotation-builder, estimating-catalogue, budget-actual** | These are workbook features, not folders (§2.4). Separately purchasable, or features of Estimate Builder? Changes whether M7 exists. |
| 2 | **`postcss.config.js` vs `postcss.config.mjs`** | Conflicting Tailwind configurations — v3 style (`tailwindcss` + `autoprefixer`) and v4 style (`@tailwindcss/postcss`). Next.js loads one; the other is dead and misleading. Which is authoritative? |
| 3 | **`.vercelignore` is untracked** | Live deploy config existing only on this machine. Deployment excludes are not reproducible. Commit it? |
| 4 | **89 unauthenticated API routes** | Recommend a standalone triage into public / needs-auth / delete before M2. Includes affiliate and account endpoints. |
| 5 | **Freedom authentication** | 32 of 33 routes unauthenticated, no workspace isolation. Is Freedom single-operator or multi-tenant? Determines whether M5 adds a tenancy column. |
| 6 | **`"ing leads\357\200\242 af5336c"`** | Corrupted tracked filename. Confirm deletion. |
| 7 | **Scraped supplier HTML (6 files)** | Keep as raw catalogue source, or delete as scrape by-products? |
| 8 | **`eng.traineddata`** | Tesseract model at root. Which module needs OCR — is this still used at all? |
| 9 | **`modules/website-builder/`** | Two files under the old `modules/` root. Fold into the new website-builder module. |
| 10 | **Leads vs CRM** | 7 vs 49 files with overlapping tables (`leads`, `lead_lists`, `crm_calls`). One module or two? |
| 11 | **`take off.code-workspace`** | Editor workspace file with a space in the name. Delete or rename? |

---

## 12. What this audit did not do

- No file was moved, renamed, created or deleted, other than this document.
- No functionality was altered.
- `.env`, `.env.local`, `.env.production` and `.env.example` were **not opened**. No secret was read,
  printed or copied.
- Nothing was pushed or deployed.
- Supabase, migrations, production data and Vercel configuration were not touched.

Counts are tracked files at `4fed0c1`, excluding `node_modules`, build output and untracked work in
progress. Where a count is approximate it is marked `~`.

---

## 13. Approved decisions (2026-09-03)

This section records the owner's final decisions. It supersedes the recommendations in §11 and the
proposed mapping in earlier drafts wherever they differ.

### 13.1 Architectural principle

**Physical code ownership and commercial packaging are separate concerns.** Every major feature gets
its own technical module folder even when it is commercially bundled. One subscription may unlock
several module folders; a module may later be sold separately without another file-tree restructure.
Page routes, API routes and database access all enforce the same entitlement. Hiding navigation is
never sufficient protection.

### 13.2 Resolved blockers

| § | Decision |
|---|---|
| §11 #1 | All four features get own folders. Commercial status per §13.4. |
| §11 #5 | **Freedom is multi-tenant** in the hosted platform and **single-organisation in standalone mode**. Every record belongs to a user/workspace; a standalone install creates its own local default workspace. Tenancy conversion is **not** combined with file extraction — see §13.6. |
| §11 #10 | **Leads and CRM remain two folders with two codes.** `crm` grants `leads`; `leads` does **not** grant `crm`. |

Housekeeping items §11 #2, #3, #6, #7, #8, #9 and #11 are approved subject to reference checks. The
PostCSS choice must be proven from live build output, never from filename or age. `.vercelignore` is
reviewed and committed deliberately as active deployment configuration.

### 13.3 Module ownership corrections

Purchase Orders, Supplier Invoices and Quote Approvals are **not** separate purchasable modules. They
belong inside `modules/supplier-procurement/` under the single `supplier_procurement` entitlement,
following the approved consolidation:

> Supplier Quotes + Purchase Orders + Procurement + Quote Approvals + Deliveries + Supplier Invoices
> = **Supplier & Procurement**

Their existing routes may remain as thin compatibility routes temporarily, but the implementation must
ultimately live inside the supplier-procurement module folder.

- `quote-proposal-builder.js` belongs to `modules/quotation-builder/` under `quotation_builder`. It is
  not a separate module or entitlement.
- `convert-to-live-project.js` is an internal Project Workspace action, inside the Project Workspace /
  Job Details service boundary. Not separately purchasable.

**These codes must not be created:** `purchase_orders`, `supplier_invoices`, `quote_approvals`.

### 13.4 Approved entitlement codes

| Module folder | Code |
|---|---|
| `job-details` | *(none — Project Workspace core, never sold separately)* |
| `estimate-builder` | `estimate_builder` |
| `quotation-builder` | `quotation_builder` |
| `estimating-catalogue` | `estimating_catalogue` |
| `budget-actual` | `budget_vs_actual` |
| `ai-plan-takeoff` | `ai_plan_takeoff` |
| `product-library` | `product_library`, `product_library_read` |
| `client-selections` | `client_selections` |
| `standard-inclusions` | `standard_inclusions` |
| `boq` | `boq` |
| `variations` | `variations` |
| `supplier-procurement` | `supplier_procurement` |
| `document-vault` | `document_vault` |
| `rfi-reports` | `rfi_reports` |
| `gantt-chart` | `gantt_chart` |
| `job-board` | `job_board` |
| `client-portal` | `client_portal` |
| `freedom` | `freedom` |
| `leads` | `leads` |
| `crm` | `crm` |
| `website-builder` | `website_builder` |

Existing marketing and business module codes are unchanged: `email_marketing`, `social_media`,
`sms_marketing`, `booking_calendar`, `funnels`, `business_automation`, `affiliate_management`,
`pipelines`, `evergreen_webinars`.

### 13.5 Bundles and grants

```
builder_suite = [
  estimate_builder, quotation_builder, client_selections, budget_vs_actual,
  ai_plan_takeoff, standard_inclusions, boq, variations, supplier_procurement,
  document_vault, rfi_reports, gantt_chart, job_board, client_portal,
]

estimate_bundle = [estimate_builder, quotation_builder]

GRANTS                                  // owning the key grants the values
  estimate_builder   -> estimating_catalogue, product_library_read
  quotation_builder  -> estimating_catalogue, product_library_read
  client_selections  -> product_library_read
  product_library    -> product_library_read
  crm                -> leads
  leads              -> (nothing; does not grant crm)
```

Grants are resolved as a transitive closure. Every module in a bundle keeps its own code, so removing
one from a bundle to sell separately is a data change, not a file-tree change.

### 13.6 Freedom batch split

Tenancy conversion is separated from physical extraction. §8's M5 is replaced by:

| Batch | Scope |
|---|---|
| **M5A** — tenancy schema | Add workspace ownership to all Freedom-owned tables. Prepare safe backfill rules. Add indexes and foreign keys. Add RLS policies. Preserve all existing Freedom data. No destructive migration. **Migrations are not applied without separate approval.** |
| **M5B** — auth and API isolation | Authenticate every private Freedom API. Scope every read and write to the authorised workspace. Classify intentionally public endpoints. Add cross-workspace denial tests. |
| **M5C** — module extraction | Move Freedom pages, components, services, APIs, tests, assets and migrations into the module folder. Replace imports from API routes with module-owned services. Preserve thin Next.js route adapters where required. |
| **M5D** — standalone packaging | `package.json`; placeholder-only `.env.example`; database setup and migrations; default local workspace bootstrap; installation documentation. Prove it can be copied into a clean directory, installed, built and run without the rest of this repository. |

### 13.7 Unauthenticated route triage is a checkpoint, not a batch

The 89-route classification becomes a **separate read-only checkpoint before M2**, producing these
categories:

`public` · `authenticated` · `authenticated plus entitlement` · `webhook with signature verification`
· `obsolete / delete candidate` · `uncertain / manual review`

**No security wrapper is applied until that classification is approved.**

### 13.8 M1 scope, as approved

M1 establishes the entitlement vocabulary, bundle expansion, grant resolution and the reusable
server-side resolver, with comprehensive tests. M1 explicitly does **not**: move module files, gate the
89 unresolved API routes, or alter the Supabase schema. Existing staged, unstaged and untracked work is
preserved; environment files are not touched.
