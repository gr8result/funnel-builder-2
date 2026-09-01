# Repository Module And Takeoff Audit

**Stage 1 — Audit and report only. No files were deleted, moved, renamed or modified.**

- Audit date: 2026-09-01
- Branch: `production/website-builder-20260808`
- HEAD: `81c5613d247ce1d16c20e23de9728858efd142e2` — *fix(client-selections): restore workspace load after module isolation*
- Repository root: `E:\dev\funnel-builder-clean`

---

## 1. Executive summary

### The single most important finding

**The new working Takeoff Engine is entirely uncommitted.** Its primary folder,
`components/construction-estimation/ai-plan-takeoff/`, is 7 **untracked** files (`git ls-files` returns
0 tracked, `git ls-files --others` returns 7). The platform wiring that mounts it lives in
**uncommitted worktree edits** to `components/estimate-builder/EstimateBuilderWorkbook.js` and
`hooks/estimate-builder/useEstimateBuilderWorkbook.js`.

Evidence — at HEAD the workbook still mounts the *old* engine:

```
$ git show HEAD:components/estimate-builder/EstimateBuilderWorkbook.js | grep -n "AIPlanTakeoff"
42:import AIPlanTakeoffPage from "./ai-takeoff/AIPlanTakeoffPage";
894:            <AIPlanTakeoffPage sheet={sheet} />
```

versus the working tree:

```
components/estimate-builder/EstimateBuilderWorkbook.js:98
  const AIPlanTakeoffPage = dynamic(() => import("../construction-estimation/ai-plan-takeoff/AIPlanTakeoffPage.jsx"), {
components/estimate-builder/EstimateBuilderWorkbook.js:1142
            <AIPlanTakeoffPage {...takeoffEngineContext} />
```

A `git clean -fd`, a `git checkout .`, a `git stash` without `-u`, or a branch switch that discards
untracked files **destroys the working Takeoff Engine with no git recovery path**. Committing it is
the highest-priority action and should happen before any Stage 2 deletion work begins.

### Situation summary

There are **five** distinct takeoff codebases in this repository:

| # | Tree | Files | Status |
|---|---|---|---|
| 1 | `components/construction-estimation/ai-plan-takeoff/` | 7 | **NEW, LIVE, UNTRACKED** — the working engine |
| 2 | `components/estimate-builder/ai-takeoff/` | 20 | Superseded on 2026-08/09; 2 files still shared by the workbook |
| 3 | `components/estimate-builder/takeoff-engine/` | 36 | Abandoned rebuild attempt (Jul 2026); dev-route-only |
| 4 | `modules/takeoff-legacy/` | 57 | Deliberate read-only archive copy of #2 + #3; zero importers |
| 5 | `modules/takeoff-v2/` (133) + `modules/takeoff-v3/` (18) | 151 | Separate in-progress rebuilds; route-exposed, tested, actively worked |

The new engine (#1) is remarkably clean: it has **zero imports from anywhere else in the platform**.
Its only external dependencies are four npm packages. All platform integration flows through props
supplied by `EstimateBuilderWorkbook.js`. It is the most cleanly separable module in the repository.

### Other major structural findings

1. **Twelve construction modules are implemented inside `pages/modules/builders/`** rather than in
   feature folders — 26,113 lines total, including a 15,266-line `selections-book.js`. Worse,
   `EstimateBuilderWorkbook.js` (a component) dynamically imports *back* from `pages/` for eight of
   them, an inverted dependency that makes both directions untestable in isolation.
2. **`pages/modules/takeoff-v3/index.js` is an unguarded production route** — no `useModuleGuard`,
   no entitlement check, no comment acknowledging it. `/modules/takeoff-v3` is publicly reachable.
3. **A tracked cross-module leak**: `EstimateBuilderWorkbook.js:45` imports `deriveJobId` from
   `modules/takeoff-v2/jobSummary.js` — production code depending on an in-progress rebuild module
   for a 6-line slug helper.
4. Two accidental routes exist under `pages/components/` (already deleted in the working tree by
   the user), plus a byte-identical duplicate route at `pages/modules/projects/project estimate.js`.

---

## 2. Git / worktree safety status

### Unfinished operations

| Check | Result |
|---|---|
| `.git/MERGE_HEAD` | absent — no merge in progress |
| `.git/rebase-merge`, `.git/rebase-apply` | absent — no rebase in progress |
| `.git/CHERRY_PICK_HEAD` | absent — no cherry-pick in progress |
| `.git/BISECT_LOG` | absent |
| `git diff --name-only --diff-filter=U` | empty — **no merge conflicts** |

**No unresolved Git operation. Read-only analysis proceeded normally.**

### Working tree inventory (`git status --short`, 431 entries)

| Code | Count | Meaning |
|---|---|---|
| `??` | 190 | Untracked |
| ` M` | 160 | Modified, unstaged |
| `D ` | 25 | Deleted, **staged** |
| ` D` | 56 | Deleted, unstaged |

**All 431 entries are treated as user-owned work. Nothing was reverted, cleaned, staged, unstaged,
overwritten or otherwise touched.**

Notable user-owned changes relevant to this audit:

- **Untracked, and load-bearing**: `components/construction-estimation/`,
  `components/project-workspace/`, `Client Portal/`, `lib/construction-estimation/finalQuotationBoq.js`,
  `pages/api/client-portal/`, `pages/api/demo-company/`, `pages/client-portal/`,
  22 files under `modules/takeoff-v2/`, and ~50 Supabase migrations under `supabase/migrations/`.
- **Already-deleted-by-user cleanup** (unstaged deletions — the user has begun the cleanup this
  audit is meant to plan): `pages/components/DashCard.js`, `pages/components/Layout.js`,
  `pages/api/affiliate/links,.js`, `pages/modules/website-builder/project/[id]/canvas.bak.js`,
  `ing leads af5336c`, `build_output.txt`, four `.next-dev*.log` files, and ~40 old-format
  `supabase/migrations/*.sql` superseded by renumbered untracked replacements.
- **Staged deletions**: `test-results/standard-inclusions-hybrid-import/*.png` (2),
  `tmp-trade-check/*.jpg` (17), `~$pricing-grid.xlsx`, and 5 build/log artefacts.

### Line-ending warning

Git reports `LF will be replaced by CRLF` for ~160 files. This is cosmetic (`core.autocrlf`
behaviour on Windows) and is **not** evidence of modification by this audit. No file content was
written by this audit apart from this report.

---

## 3. Repository architecture map

Excluded from inspection throughout: `node_modules/`, `.next/`, `.next-dev/`, `.next-build/`,
`out/`, `build/`, `coverage/`, `.git/`, `.history/` (VSCode local history, gitignored),
`test-results/`, `tmp/`, `tmp-thumbs/`, `tmp-trade-check/`, `recovery/`,
`2208a52a-8175-477e-823c-fc6de7fe4afe/`.

### Tracked file distribution

| Directory | Tracked files | Role |
|---|---|---|
| `pages/` | 845 | Routes **and** large amounts of implementation |
| `public/` | 299 | Static assets |
| `components/` | 260 | UI, grouped by module |
| `lib/` | 237 | Domain logic and services |
| `email/` | 227 | Email HTML templates |
| `modules/` | 188 | Newer feature-owned modules (takeoff-v2/v3/legacy, website-builder blocks) |
| `scripts/` | 167 | Node test scripts, catalogue importers, recovery tools |
| `supabase/` | 86 | Migrations |
| `standard-inclusions/` | 66 | Document assets |
| `docs/` | 21 | Architecture and audit documents |
| `data/`, `test/`, `styles/`, `hooks/`, `utils/`, `services/` | 15/15/15/11/7/2 | Supporting |

### Application entry points

- `pages/_app.js` — global app shell, layout switching, route progress
- `pages/_document.js`, `pages/_error.js`, `pages/404.js`, `pages/500.js`
- `middleware.js` — gates `/dev/*` and `/api/dev/*` behind a dev-login session
- `pages/modules/_guard.js` — `useModuleGuard`, `Locked`, `requireUser`, `withGuard` (also a route
  itself, with a `null` default export, because Next treats every file in `pages/` as a route)
- `pages/index.js`, `pages/dashboard.js`, `pages/[slug].js` (published funnel/site catch-all)

### Route groups

| Group | Location | Notes |
|---|---|---|
| Construction / builders | `pages/modules/builders/*` (14 files) | **Implementation, not adapters** — see §13 |
| Estimate Builder | `pages/modules/estimate-builder/*` (5) | `index.js` is a genuine thin adapter |
| Projects, Gantt, Job Board, Production, Construction | `pages/modules/{projects,gantt,jobboard,production,construction}/` | Mixed |
| Takeoff | `pages/modules/takeoff-v2/index.js`, `pages/modules/takeoff-v3/index.js` | Thin adapters into `modules/` |
| Dev sandboxes | `pages/dev/*` (10) | Deployed, gated by `middleware.js` dev login |
| QA harnesses | `pages/qa/*` (5) | Deployed, **not** gated |
| Client Portal | `pages/client-portal/` (untracked) | New |
| Marketing / CRM / Email / Social / Freedom / Website Builder | `pages/modules/*`, `pages/freedom*`, `pages/f`, `pages/p`, `pages/r` | Large |

### API routes (`pages/api/`, top groups by file count)

`email/` 55 · `social/` 44 · `automation/` 30 · `affiliate/` 19 · `freedom/` 18 · `calendar/` 18 ·
`freedom-trader/` 17 · `twilio/` 16 · `admin/` 16 · `website-builder/` 15 · `account/` 15 ·
`website/` 14 · `telephony/` 13 · `smsglobal/` 13 · `standard-inclusions/` 12 · `crm/` 12 ·
`vendor/` 11 · `ai/` 10 · `builders/` 7 · `client-portal/` 7 (untracked) · `stripe/` 7

**No API route belongs to the new Takeoff Engine.** The only takeoff-related API in the repository
is `pages/api/ai/plan-detect.js`, which serves the *legacy* engine only (see §7).

### Components (files per module folder)

`estimate-builder/` 108 · `document-engine/` 35 · `website-builder/` 12 · `standard-inclusions/` 11 ·
`nodes/` 10 · `gantt/` 9 · `crm/` 9 · `text-editor/` 8 · **`construction-estimation/` 7** ·
`freedom/` 6 · `email/` 6 · `ui/` 3 · `freedom-trader/` 3 · `automation/` 3 ·
`telephony`/`pricing`/`founding-growth-partner`/`emoji`/`account` 2 each ·
`vendor`/`qa`/`project-workspace`/`lists`/`image-editor`/`features`/`billing` 1 each ·
**`standard-inclusions-v2/` 0 — empty directory**

### Libraries and utilities

`lib/construction-estimation/` 54 · `lib/website-builder/` 53 · `lib/freedom-trader/` 15 ·
`lib/social/` 12 · `lib/builders/` 11 · `lib/freedom/` 9 · `lib/smsglobal/` 8 · `lib/gantt/` 7 ·
`lib/email/` 7 · `lib/text-editor/` 6 · `lib/standard-inclusions/` 6 ·
**`lib/standard-inclusions-v2/` 0 — empty directory**

### Hooks

`hooks/useWorkspace.js`, `hooks/useJobFile.ts`, `hooks/estimate-builder/useEstimateBuilderWorkbook.js`
(the largest hook in the repo), plus 8 others.

### Storage and persistence

| Layer | Location |
|---|---|
| Supabase client (browser) | `utils/supabase-client.js`, `lib/supabaseClient.js` |
| Supabase admin (server) | `lib/supabaseAdmin.js`, `lib/withWorkspace.js`, `lib/withAdmin.js` |
| Migrations | `supabase/migrations/` (86 tracked + ~50 untracked renumbered replacements) |
| Job file (`.gr8job`) | `lib/jobFile.ts`, `hooks/useJobFile.ts`, `components/estimate-builder/JobFileMenu.jsx` |
| Local browser stores | `gr8:takeoff:v1` (legacy), `gr8:takeoff-v2:*`, `gr8:takeoff-v3:*` |
| Website builder local snapshots | `website-builder-sites/` |

### Styles and assets

15 files in `styles/` (global CSS + CSS modules). **No takeoff-related CSS exists** —
`grep -rln "takeoff" styles/` returns nothing. **No takeoff-related asset exists** in `public/`
(`find public -iname '*takeoff*'` returns nothing).

### Tests and test scripts

- `scripts/` — 167 Node assertion/browser scripts; 36 registered in `package.json`
- `modules/takeoff-v2/tests/` — 47 files; `modules/takeoff-v3/tests/` — 7 files
- `components/estimate-builder/takeoff-engine/tests/` — 13 files
- `test/` — 15 files (mostly Freedom)

### Build / deployment configuration

`next.config.mjs`, `vercel.json`, `.vercelignore`, `middleware.js`, `tsconfig.json`,
`jsconfig.json`, `eslint.config.mjs`, `postcss.config.js` **and** `postcss.config.mjs` (duplicate
config pair — see §14), `tailwind.config.js`, `ecosystem.config.cjs`, three `docker-compose*.yml`,
`deno.json`, `scripts/run-next-clean.mjs` (wraps every `dev`/`build`/`start` script).

### Temporary, backup and suspicious files

Root: `tmp-caesarstone.html`, `tmp-neolith.html`, `tmp-neolith-state.js`, `tmp-smartstone.html`,
`tmp-stoneambassador.html` (all untracked, all 2026-08-31), `eng.traineddata` (5.2 MB Tesseract
model, untracked), `take off.code-workspace`, `pricing-grid.xlsx`,
`2208a52a-8175-477e-823c-fc6de7fe4afe/` (gitignored website-builder scratch), `recovery/`, `tmp/`.

Tracked generated output: `public/tmp-project-debug.json` — the only committed file matching
generated/temp naming patterns.

---

## 4. New Working Takeoff Engine — entry points

Traced from live application routes, not from folder names.

### Entry chain

```
/modules/estimate-builder?page=aiPlanTakeoff
  └─ pages/modules/estimate-builder/index.js          (thin Next.js route adapter, 40 lines)
       └─ components/estimate-builder/EstimateBuilderWorkbook.js
            ├─ :98    const AIPlanTakeoffPage = dynamic(() =>
            │            import("../construction-estimation/ai-plan-takeoff/AIPlanTakeoffPage.jsx"))
            ├─ :575   const takeoffEngineContext = useMemo(() => ({ ... }))
            └─ :1141  {activePageKey === "aiPlanTakeoff" && <AIPlanTakeoffPage {...takeoffEngineContext} />}
                 └─ components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffPage.jsx
                      └─ AIPlanTakeoffStandalone.jsx  (embedded)
```

### User-facing entry points

| Entry point | Location | Evidence |
|---|---|---|
| Project Dashboard card "AI Plan Takeoff" | `EstimateBuilderWorkbook.js:1472-1478` | `{ title: "AI Plan Takeoff", page: "aiPlanTakeoff", visualKey: "aiPlanTakeoff", badge: "Plans" }` |
| Workspace page switcher | `hooks/estimate-builder/useEstimateBuilderWorkbook.js:15` | `{ key: "aiPlanTakeoff", label: "AI Plan Takeoff" }` |
| Workspace visual/theme registration | `EstimateBuilderWorkbook.js:195-203` | `aiPlanTakeoff: { title: "AI Plan Takeoff", Icon: Ruler, ... }` |
| Deep link | `pages/modules/estimate-builder/index.js` | `?page=aiPlanTakeoff` → `routePageFromRouter()` → `initialPage` |
| Global side nav | `components/nav-config.js:26` | `/modules/estimate-builder?page=projectDashboard` → dashboard card → takeoff |

There is **no standalone `/modules/...` route for the new engine**. It is reachable only inside the
Estimate Builder workspace. `AIPlanTakeoffStandalone.jsx` supports an unembedded mode
(`embedded = false` default), so a standalone route could be added later without changes.

### Verification performed

`scripts/test-ai-plan-takeoff-integration.mjs` was executed read-only:

```
$ node scripts/test-ai-plan-takeoff-integration.mjs
AI Plan Takeoff integration regression checks passed.   (exit 0)
```

This test asserts the dashboard card target, the workflow-card nav render, the exact mount
expression, the `platformContext.projectId` hand-off, the `saveAiPlanTakeoffJob` persistence path,
the `selectAiPlanTakeoffJob` selector, `hasRecoverablePlanPages`, and `prepareAiPlanTakeoffJobForSave`
— then exercises the schedule, quote-preview and job-persistence logic directly.

---

## 5. New Working Takeoff Engine — dependency manifest

### Primary folder: `components/construction-estimation/ai-plan-takeoff/`

**Status: 7 files, all untracked. Never committed.**

| File | Lines | Role | Reachable from live mount? |
|---|---|---|---|
| `AIPlanTakeoffPage.jsx` | 5 | Platform entry wrapper — renders `AIPlanTakeoffStandalone` with `embedded` | **Yes — root** |
| `AIPlanTakeoffStandalone.jsx` | 3336 | The entire engine: viewer, tools, calibration, walls, openings, floorplans, eaves, floor coverings, schedule UI, save/load | **Yes** |
| `floorplanGeometry.js` | 59 | Polygon area (m²), corner snapping, free-point resolution | **Yes** — 3 of 4 exports used |
| `jobPersistence.js` | 383 | Job model, checksums, embedded plan pages, portable `.gr8takeoff` export/import, revisioned save preparation, save verification | **Yes** |
| `takeoffSchedule.js` | 358 | Takeoff → schedule, CSV/Excel-XML export, Job Setup payload, quote-preview rows | **Yes** |
| `OpeningsModal.jsx` | 115 | Window/door picker modal | **No — zero importers repo-wide** |
| `wallUtils.js` | 209 | Standard wall thicknesses, thickness detection from raster, intersection snapping, offset polygons | **No — zero importers repo-wide** |

Search performed for the two unreferenced files (ripgrep, whole repo, `.history/` excluded):

```
rg "OpeningsModal|wallUtils|floorplanGeometry" -g '!.history/**'
→ components/construction-estimation/ai-plan-takeoff/wallUtils.js:1        (its own header comment)
→ components/construction-estimation/ai-plan-takeoff/OpeningsModal.jsx:3   (its own export)
→ components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx:4  (floorplanGeometry import)
```

`floorplanGeometry.js` is imported; `OpeningsModal.jsx` and `wallUtils.js` are not — see §7 Category D.

### npm package dependencies

| Package | Version in `package.json` | Used for |
|---|---|---|
| `react` | `^18.3.1` | Framework |
| `react-konva` | `18.2.16` | Canvas stage/layer rendering — `Stage, Layer, Image, Line, Circle, Text, Rect, Group` |
| `lucide-react` | `^0.545.0` | Toolbar icons |
| `pdfjs-dist` | `^6.1.200` | PDF parsing and page rendering |

`pdfjs-dist` is a **real npm dependency** here, imported as `import * as pdfjsLib from 'pdfjs-dist'`.
Only the *worker* is loaded from CDN:

```js
// AIPlanTakeoffStandalone.jsx:18
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
```

This is a meaningful improvement over the legacy engine, which injected the *entire* PDF.js library
from CDN at runtime. It does mean the engine still needs network access to `cdnjs.cloudflare.com`
for the worker in local dev.

### Environment variables

**None.** The engine reads no `process.env` value and calls no API route. All identity and project
context arrives as the `platformContext` prop.

### Storage and persistence

The engine performs **no direct storage I/O**. Everything routes outward:

| Operation | Mechanism |
|---|---|
| Save to platform | `onSaveToPlatform(jobData)` prop → `prepareAiPlanTakeoffJobForSave()` → `sheet.saveAiPlanTakeoffJob()` |
| Load from platform | `initialJob` prop ← `selectAiPlanTakeoffJob(sheet.workbook)` |
| Job Setup sync | `onJobSetupUpdate(payload)` prop → `sheet.updateData("inputDataSheet", ...)` |
| Quote sheet sync | `onQuoteSheetUpdate({previewRows, mappings, ...})` prop |
| Local file export | `window.showSaveFilePicker` (File System Access API), `AIPlanTakeoffStandalone.jsx:499` |
| Local file import | `window.showOpenFilePicker`, `AIPlanTakeoffStandalone.jsx:550-555` |
| Durable persistence | Via the Estimate Builder workbook → `.gr8job` file and/or Supabase |

**No `localStorage`, no `indexedDB`, no `supabase`, no `fetch`, no API route.** This is the cleanest
persistence boundary of any module audited.

### Tests

`scripts/test-ai-plan-takeoff-integration.mjs` (untracked). It imports `jobPersistence.js` and
`takeoffSchedule.js` directly and reads `EstimateBuilderWorkbook.js` as text to assert the wiring.

**Gap:** this script is **not registered in `package.json`**. Compare `test:takeoff-v2`,
`test:takeoff-v3`, `test:takeoff-v2-acceptance`, which are. The new engine's only regression test is
therefore not part of any runnable suite.

---

## 6. Files outside the primary folder that the new engine requires

**9 items.** Every one is a platform host or contract, not takeoff logic that escaped the folder.

| # | Path | Why required | Classification |
|---|---|---|---|
| 1 | `components/estimate-builder/EstimateBuilderWorkbook.js` | Mounts the engine (`:1141`), builds `takeoffEngineContext` (`:575-660`), owns the four callback bridges, defines `deriveTakeoffEngineJobId` (`:14937`), `selectAiPlanTakeoffJob` (`:14955`), `quoteRowsForAiPlanTakeoff` (`:14980`), `takeoffQuantityByItem` (`:14996`), `takeoffWallLength` (`:15001`) | **Thin platform adapter** — though currently embedded in an 18,700-line file. The ~90 lines of takeoff glue should become a dedicated adapter module. |
| 2 | `hooks/estimate-builder/useEstimateBuilderWorkbook.js` | Owns `saveAiPlanTakeoffJob()` (`:409`), `updateTakeoffEngineState()` (`:402`), `updateTakeoffProject()` (`:394`), the page registry entry (`:15`), and the save-verification round trip using the engine's own `verifyAiPlanTakeoffSavedJob` (`:10`, `:432`) | **Thin platform adapter** |
| 3 | `pages/modules/estimate-builder/index.js` | Next.js Pages Router requires a physical route file; parses `?page=aiPlanTakeoff` | **Framework route adapter — must remain** |
| 4 | `hooks/useJobFile.ts` | `.gr8job` open/save; fingerprints `workbook.aiPlanTakeoffJob` including embedded plan-page and completed-area counts (`:108-118`) so reopening saved takeoff work is detectable | **Genuinely shared platform dependency** |
| 5 | `lib/jobFile.ts` | `.gr8job` serialisation writes the `takeoff` section carrying `aiPlanTakeoffJob` (`:189`) | **Genuinely shared platform dependency** |
| 6 | `hooks/useWorkspace.js` | Supplies `moduleWorkspaceId` → `platformContext.workspaceId` / `organisationId` | **Genuinely shared platform dependency** |
| 7 | `scripts/test-ai-plan-takeoff-integration.mjs` | The engine's only regression test | **Takeoff-owned — candidate to move into the module** (`features/ai-plan-takeoff/tests/`) and to register in `package.json` |
| 8 | `package.json` | Declares `react-konva`, `pdfjs-dist`, `lucide-react` | **Shared platform manifest — must remain** |
| 9 | `components/construction-estimation/` (parent folder name) | Sibling to `lib/construction-estimation/` (54 files of estimating engines) — the naming implies a relationship the code does not have | **Unclear — see §18** |

### Cross-check: nothing else reaches into the engine

`rg "ai-plan-takeoff|AIPlanTakeoff"` across the repository (excluding `.history/`) returns importers
in exactly three files: `EstimateBuilderWorkbook.js` (2 imports + 1 dynamic import),
`hooks/estimate-builder/useEstimateBuilderWorkbook.js` (1 import), and
`scripts/test-ai-plan-takeoff-integration.mjs` (2 imports). Everything else is documentation prose
or the engine's own internal strings.

---

## 7. Legacy takeoff classification (Categories A–D)

### Search methodology

Terminology sweep performed with ripgrep across all tracked and relevant untracked source, excluding
`node_modules/`, `.next*/`, `.history/`, `.git/`:

`takeoff` · `take-off` · `plan takeoff` · `AI plan takeoff` · `AIPlanTakeoff` · `floor plan` ·
`plan analyser` / `analyzer` · `wall detection` · `wallDetection` · `wall tracing` · `traceGraph` ·
`exterior wall` / `vectorExteriorDetection` · `interior wall` · `calibration` / `scaleCalibration` ·
`pixels_per_meter` / `pixelsPerMm` / `pixelsPerMetre` · `openings` · `windows` · `doors` ·
`footprint` · `room detection` / `roomBoundaryDetection` · `vectorisation` / `vectorization` /
`wallMaskVectorisation` · `segmentation` / `semanticSegmentation` · `upload-plan` · `plan workspace` ·
`plan-detect` · `gr8:takeoff` · `.bak` / `.old` / `.copy` / `.tmp` / numbered duplicates.

Per-file proof loops were then run for every file in the two `components/estimate-builder/` takeoff
trees, checking for external importers, dynamic imports, re-exports, route exposure, test references
and `package.json` script references.

### Summary

| Category | Files |
|---|---|
| **A — Proven legacy, safe deletion candidate** | **73** |
| **B — Probably legacy, requires verification** | **40** |
| **C — Still active or shared, do not delete** | **169** |
| **D — Unknown ownership** | **5** |

---

### Category A — Proven legacy and safe deletion candidate (73 files)

#### A.1 — `components/estimate-builder/ai-takeoff/` — 16 of 20 files

**What it is:** the previous live AI-assisted manual takeoff implementation. Its own entry file now
carries the marker `// LEGACY AIPlanTakeoffPage.jsx — AI-assisted Manual Takeoff.`
(`AIPlanTakeoffPage.jsx:1`), added in the user's uncommitted edits.

**Evidence it is superseded:** at HEAD, `EstimateBuilderWorkbook.js:42` imported
`./ai-takeoff/AIPlanTakeoffPage` and mounted it at `:894`. In the working tree both were replaced by
the `construction-estimation/ai-plan-takeoff` dynamic import and mount. Nothing now imports
`ai-takeoff/AIPlanTakeoffPage`.

**Reference findings:** a per-file external-importer loop over all 20 files found external
references to only four names, and two of those are prose:

```
PlanCanvas.jsx        → modules/takeoff-v2/takeoff/snapping.js:3   (COMMENT: "Ported/adapted from…")
planCoordinateUtils.js→ modules/takeoff-v2/takeoff/geometry.js:2   (COMMENT: "Ported/adapted from…")
TakeoffToolbar.jsx    → modules/takeoff-v2/components/TakeoffV2Page.jsx:16  (FALSE POSITIVE —
                        that is `./TakeoffToolbar.jsx`, takeoff-v2's own file)
pdfPlanRendering.js   → components/estimate-builder/EstimateBuilderWorkbook.js:44   (REAL IMPORT → Category C)
```

The two comment matches were verified by reading `modules/takeoff-v2/takeoff/geometry.js:1-8` and
`snapping.js:1-8` — both are attribution comments above the imports, not imports.

| Path | What it does | Route? | Other module uses it? | Risk |
|---|---|---|---|---|
| `AIPlanTakeoffPage.jsx` | Legacy takeoff tab shell; wires the 7 panels | No | No | Low |
| `AIReviewPanel.jsx` | AI detection review UI | No | No | Low |
| `MeasurementSummary.jsx` | Measurement totals panel | No | No | Low |
| `ObjectPanel.jsx` | Wall/object list panel | No | No | Low |
| `PDFUploadPanel.jsx` | PDF upload + the six-field rotation model | No | No | Low |
| `PlanCanvas.jsx` | Legacy canvas: fit-to-view, wheel zoom, pan, overlays | No | Comment only | Low |
| `PushToEstimatorPanel.jsx` | Push quantities to estimator | No | No | Low |
| `RoomAnalysisPanel.jsx` | Room analysis UI | No | No | Low |
| `RoomPanel.jsx` | Room list panel | No | No | Low |
| `ScaleCalibrationPanel.jsx` | Scale preset / two-point calibration | No | No | Low |
| `TakeoffToolbar.jsx` | Legacy toolbar | No | No (false positive resolved) | Low |
| `aiDetectionService.js` | `fetch("/api/ai/plan-detect")` | No | No | Low |
| `aiTakeoffPersistence.js` | Legacy project persistence | No | No | Low |
| `aiTakeoffPersistence.test.mjs` | Test for the above | No | Not in `package.json` | Low |
| `takeoffTypes.js` | `TOOLS`, `STYLE`, `OT`, `FLOOR_FINISHES`, `WALL_TYPES`, `LEVELS`, `SCALE_PRESETS`, `createPage`, `createProject` | No | No | Low |
| `takeoffUtils.js` | `saveProject`/`loadByJobId` against `localStorage["gr8:takeoff:v1"]` (`:161,:171`) | No | No | Low |

**Proposed action:** delete all 16 together, in one commit, after §8's preconditions.
**Verification required before deletion:** run the §17 plan; confirm `pdfPlanRendering.js` and
`planCoordinateUtils.js` (Category C) are **retained**.

#### A.2 — `modules/takeoff-legacy/` — 56 of 57 files

**What it is:** a deliberate read-only archive created 2026-07-22 in commit `9625643`, documented by
its own `RECOVERY.md`, which states: *"This is a read-only reference copy. The live code is still at
its original location and is untouched by this archive."*

**Evidence:**
- `git log --diff-filter=A -- modules/takeoff-legacy` → created in `9625643` (2026-07-22); last
  commit touching it is the same commit. Never modified since.
- It is a snapshot copy of `components/estimate-builder/ai-takeoff/` (20 files) and
  `components/estimate-builder/takeoff-engine/` (36 files). `diff -rq` against both originals shows
  the originals have drifted since the archive (15 and 21 files respectively now differ) — confirming
  the archive is a frozen point-in-time copy, not a live fork.
- Zero importers. `rg "takeoff-legacy"` returns only `RECOVERY.md` itself and prose in `docs/`.
- No route, no dynamic import, no test, no `package.json` reference.

**Why deletion is safe:** the archive's own recovery instructions rely on git, not on the archive:
`git show 03ba8fb:<path>` and `git worktree add ../takeoff-legacy-compare 03ba8fb`. Commit `03ba8fb`
and the safety branch `safety/pre-takeoff-v2-20260722` preserve everything the archive holds.

| Path | Files | Risk |
|---|---|---|
| `modules/takeoff-legacy/ai-takeoff/` | 20 | Low |
| `modules/takeoff-legacy/takeoff-engine/` | 36 | Low |

**Proposed action:** delete both subtrees; **retain `RECOVERY.md`** (Category B.4) by relocating it
to `docs/`.
**Verification required:** confirm `safety/pre-takeoff-v2-20260722` and commit `03ba8fb` still
resolve — `git rev-parse safety/pre-takeoff-v2-20260722` and `git cat-file -t 03ba8fb`.

#### A.3 — `components/estimate-builder/takeoff-engine/workbook/TakeoffEngineWorkbookPage.jsx` — 1 file

**What it is:** a workbook-page host for the abandoned rebuild engine.

**Evidence:** zero importers anywhere — including inside its own directory tree. The full internal
import graph of `takeoff-engine/` was mapped; `TakeoffEngineWorkbookPage.jsx` imports 8 siblings and
**nothing imports it**. `pages/dev/takeoff-engine-test.jsx` mounts `viewer/TakeoffViewer.jsx`
directly, bypassing this file. `docs/MODULE_ARCHITECTURE_AUDIT.md:134` independently recorded the
same conclusion: *"has zero importers anywhere — fully orphaned."*

**Risk:** Low. **Verification:** `rg "TakeoffEngineWorkbookPage"` must return only the file itself.

---

### Category B — Probably legacy but requires verification (40 files)

#### B.1 — `components/estimate-builder/takeoff-engine/` — remaining 35 files

**What it is:** a parallel rebuild attempt started 2026-07-15 (`e629318`) and abandoned. Its
TypeScript architecture layer was already deleted before the archive was taken (per `RECOVERY.md`).

**Why not Category A:** it **is route-exposed**. `pages/dev/takeoff-engine-test.jsx` imports 8 of its
modules and is a real deployed route — `.vercelignore` does not exclude `pages/dev/`, and
`middleware.js:19,44-51` gates `/dev/*` behind a dev-login session rather than removing it. A
developer can still open `/dev/takeoff-engine-test` today.

**Reference findings:** external importers of this tree are exclusively
`pages/dev/takeoff-engine-test.jsx` (for `imageOrientationAnalysis.js`, `orientation.js`,
`imageNormalizer.js`, `pdfToRaster.js`, `takeoffPersistence.js`, `takeoffReducer.js`,
`TakeoffViewer.jsx`). The apparent matches from `modules/takeoff-v2/takeoff/{geometry,snapping}.js`
were verified as attribution **comments**, not imports.

**Breakdown:** `analysis/` 4 · `core/` 7 · `import/` 3 · `state/` 2 · `tests/` 13 · `tools/` 3 ·
`viewer/` 3 = 35 (the 36th, `workbook/TakeoffEngineWorkbookPage.jsx`, is Category A.3).

**Proposed action:** delete the tree **together with** `pages/dev/takeoff-engine-test.jsx` (B.2) in
one commit.
**Risk:** Medium — only because it removes a working dev sandbox.
**Verification required:** owner confirms the `/dev/takeoff-engine-test` sandbox is no longer needed
(it was the only place the abandoned rebuild ran), and that the takeoff-v2/v3 rebuilds have
superseded whatever it was used to test.

#### B.2 — `pages/dev/takeoff-engine-test.jsx` — 1 file

Dev-only harness for B.1; the sole entry point into that tree.
**Risk:** Medium. **Verification:** delete only in the same commit as B.1.

#### B.3 — `pages/api/ai/plan-detect.js` — 1 file

**What it is:** GPT-4o vision floor-plan detection endpoint.

**Evidence:** `rg "plan-detect"` returns exactly four hits — the route file's own header comment,
`components/estimate-builder/ai-takeoff/aiDetectionService.js:2,12` (Category A.1), and the archive
copy `modules/takeoff-legacy/ai-takeoff/aiDetectionService.js:2,12` (Category A.2). **The new engine
does not call it** — it issues no `fetch` at all.

**Why B not A:** the endpoint is route-exposed and callable by anything (including external tools or
a future feature). It becomes provably orphaned only once A.1 and A.2 land.
**Risk:** Low–Medium. **Verification:** delete in a commit *after* A.1/A.2; re-run `rg "plan-detect"`
and confirm zero callers; confirm no external/n8n automation posts to it.

#### B.4 — `modules/takeoff-legacy/RECOVERY.md` — 1 file

Not code. It is the **only prose record** of why the legacy engine broke (the `gr8:takeoff:v1`
single-blob localStorage design; the six-field rotation model) and the only written recovery path to
commit `03ba8fb`.
**Proposed action:** **do not delete — relocate** to `docs/takeoff-legacy-recovery.md`.
**Risk:** Low to keep; Medium to lose.

#### B.5 — `pages/dev/plan-import-test.js` — 1 file (862 lines)

A self-contained plan-import spike (imports only `next/head` and React). Documented by
`docs/dev-plan-import-test-audit.md`. It is the **only source-code consumer of `eng.traineddata`**
in the takeoff area (Tesseract OCR).
**Risk:** Medium. **Verification:** confirm the OCR scale-text approach it prototypes is not being
carried into the new engine or takeoff-v2 before removal.

#### B.6 — `pages/dev/takeoff-viewer-spike.jsx` — 1 file (714 lines)

An OpenSeadragon tiled-viewer spike (`import("openseadragon")`, dynamic). `openseadragon@^6.0.2` is
a declared dependency. It is the **only importer** of that package.
**Risk:** Medium. **Verification:** confirm the tiled-viewer strategy (mandated by
`TAKEOFF_ENGINE_ARCHITECTURE.md` rule 4, "do not rebuild mature tiling") is abandoned before
removing this and `openseadragon` from `package.json`.

---

### Category C — Still active or shared; do not delete (169 files)

| Group | Files | Why it must stay |
|---|---|---|
| **New engine** `components/construction-estimation/ai-plan-takeoff/` (5 reachable files) | 5 | The live engine |
| `scripts/test-ai-plan-takeoff-integration.mjs` | 1 | New engine's regression test; passes |
| **`components/estimate-builder/ai-takeoff/pdfPlanRendering.js`** | 1 | **`loadPdfJs` is imported by `EstimateBuilderWorkbook.js:44` and called at 8 sites** (`:5826, :5904, :5925, :9299, :9954, :10326, :10586, :10612`) for Project Estimate / Standard Inclusions PDF import — **nothing to do with takeoff** |
| **`components/estimate-builder/ai-takeoff/planCoordinateUtils.js`** | 1 | Sole import of `pdfPlanRendering.js:1` (`calculateFinalRotation`, `normalizeRotation`) |
| `components/estimate-builder/ai-takeoff/pdfPlanRendering.test.mjs`, `planCoordinateUtils.test.mjs` | 2 | Cover the two live files above |
| `modules/takeoff-v2/` | 133 | Route `/modules/takeoff-v2`; `pages/dev/takeoff-v2-test.jsx`; `package.json` `test:takeoff-v2` + `test:takeoff-v2-acceptance`; **`EstimateBuilderWorkbook.js:45` imports `deriveJobId` from `jobSummary.js`**; last commit 2026-08-18; 22 untracked files = active work |
| `modules/takeoff-v3/` | 18 | Route `/modules/takeoff-v3`; `pages/dev/takeoff-v3-test.jsx`; `package.json` `test:takeoff-v3`; last commit 2026-08-12 |
| `pages/modules/takeoff-v2/index.js`, `pages/modules/takeoff-v3/index.js`, `pages/dev/takeoff-v2-test.jsx`, `pages/dev/takeoff-v3-test.jsx` | 4 | Framework route adapters for the above |
| `scripts/test-takeoff-v2-acceptance.mjs`, `scripts/test-takeoff-v3-acceptance.mjs`, `scripts/takeoff-hybrid-raster-prototype.mjs` | 3 | Registered / referenced test + prototype scripts |
| `eng.traineddata` | 1 | 5.2 MB Tesseract model — used by `pages/dev/plan-import-test.js` **and by `lib/freedom/tradeImport.js`**, an active Freedom module |

**The two most dangerous files in this audit** are `pdfPlanRendering.js` and `planCoordinateUtils.js`.
They sit inside a directory that is otherwise 100% legacy. Deleting
`components/estimate-builder/ai-takeoff/` wholesale would break Project Estimate PDF import, PDF
proposal import and Standard Inclusions PDF import — **eight call sites**, none of them takeoff.

---

### Category D — Unknown ownership (5 files)

| Path | What it appears to be | Why unknown | Recommended resolution |
|---|---|---|---|
| `components/construction-estimation/ai-plan-takeoff/OpeningsModal.jsx` | Window/door opening picker modal, 115 lines | Part of the **new** engine's import drop, but zero importers repo-wide. Either dead-on-arrival from the source project, or a feature not yet wired. `AIPlanTakeoffStandalone.jsx` renders openings inline instead. | Ask whether openings-modal UI is planned. Do **not** delete during a takeoff-legacy cleanup — it is new-engine territory. |
| `components/construction-estimation/ai-plan-takeoff/wallUtils.js` | Standard wall thicknesses, raster thickness detection, intersection snapping, offset polygons, 209 lines | Same as above — zero importers. Substantial and non-trivial logic; likely intended for a next phase. | Same. |
| `docs/manual-pdf-rotation-audit.md` | Audit of the legacy six-field rotation model | Describes only files in Category A.1 | Retain as history, or fold into `docs/takeoff-legacy-recovery.md` |
| `docs/takeoff-regression-restoration-audit.md` | Audit of the `0a49e39` regression and restoration | Same | Same |
| `docs/dev-plan-import-test-audit.md` | Audit of `pages/dev/plan-import-test.js` (Category B.5) | Fate follows B.5 | Decide with B.5 |

---

## 8. Proposed Takeoff Engine deletion list — Category A only (73 files)

**Do not execute during Stage 1. Execute only after approval and after the preconditions below.**

### Preconditions (all must hold)

1. `components/construction-estimation/ai-plan-takeoff/` (7 files) is **committed**.
2. The uncommitted rewiring in `EstimateBuilderWorkbook.js` and
   `hooks/estimate-builder/useEstimateBuilderWorkbook.js` is **committed**.
3. `git rev-parse safety/pre-takeoff-v2-20260722` and `git cat-file -t 03ba8fb` both succeed.
4. A tag is cut at the pre-deletion commit, e.g. `safety/pre-takeoff-legacy-removal-20260901`.
5. `node scripts/test-ai-plan-takeoff-integration.mjs` passes (confirmed passing at audit time).

### Deletion list

```
# --- A.1 — legacy ai-takeoff, 16 of 20 files (KEEP pdfPlanRendering.js,
#           planCoordinateUtils.js and their two .test.mjs files) ---
components/estimate-builder/ai-takeoff/AIPlanTakeoffPage.jsx
components/estimate-builder/ai-takeoff/AIReviewPanel.jsx
components/estimate-builder/ai-takeoff/MeasurementSummary.jsx
components/estimate-builder/ai-takeoff/ObjectPanel.jsx
components/estimate-builder/ai-takeoff/PDFUploadPanel.jsx
components/estimate-builder/ai-takeoff/PlanCanvas.jsx
components/estimate-builder/ai-takeoff/PushToEstimatorPanel.jsx
components/estimate-builder/ai-takeoff/RoomAnalysisPanel.jsx
components/estimate-builder/ai-takeoff/RoomPanel.jsx
components/estimate-builder/ai-takeoff/ScaleCalibrationPanel.jsx
components/estimate-builder/ai-takeoff/TakeoffToolbar.jsx
components/estimate-builder/ai-takeoff/aiDetectionService.js
components/estimate-builder/ai-takeoff/aiTakeoffPersistence.js
components/estimate-builder/ai-takeoff/aiTakeoffPersistence.test.mjs
components/estimate-builder/ai-takeoff/takeoffTypes.js
components/estimate-builder/ai-takeoff/takeoffUtils.js

# --- A.2 — archive copy, 56 of 57 files (KEEP RECOVERY.md; relocate to docs/) ---
modules/takeoff-legacy/ai-takeoff/          (all 20 files)
modules/takeoff-legacy/takeoff-engine/      (all 36 files)

# --- A.3 — fully orphaned, 1 file ---
components/estimate-builder/takeoff-engine/workbook/TakeoffEngineWorkbookPage.jsx
```

**Total: 73 files.**

### Explicitly excluded from Category A

```
components/estimate-builder/ai-takeoff/pdfPlanRendering.js         # loadPdfJs — 8 live call sites
components/estimate-builder/ai-takeoff/planCoordinateUtils.js      # required by the above
components/estimate-builder/ai-takeoff/pdfPlanRendering.test.mjs   # covers live code
components/estimate-builder/ai-takeoff/planCoordinateUtils.test.mjs# covers live code
modules/takeoff-legacy/RECOVERY.md                                 # only prose record — relocate
```

### Follow-up required in the same commit

After deletion, `components/estimate-builder/ai-takeoff/` will contain only the four retained PDF
files. That directory name will then be misleading. **Recommended in Stage 2** (a rename, not a
delete): move the four files to `lib/pdf/` or `components/estimate-builder/pdf/` and update the
single import at `EstimateBuilderWorkbook.js:44`.

---

## 9. Category B manual verification list (40 files)

| Item | Files | Question that must be answered before deletion | Who can answer |
|---|---|---|---|
| B.1 `components/estimate-builder/takeoff-engine/` (35) + B.2 `pages/dev/takeoff-engine-test.jsx` (1) | 36 | Is the `/dev/takeoff-engine-test` sandbox still used to test orientation analysis, PDF rasterisation or the reducer? Have takeoff-v2/v3 fully replaced it? | Repository owner |
| B.3 `pages/api/ai/plan-detect.js` | 1 | Does any external caller (n8n workflow, Postman collection, mobile client, another deployment) POST to `/api/ai/plan-detect`? | Owner + n8n/`n8n-automation/` review |
| B.4 `modules/takeoff-legacy/RECOVERY.md` | 1 | Approve relocation to `docs/takeoff-legacy-recovery.md` rather than deletion | Owner |
| B.5 `pages/dev/plan-import-test.js` | 1 | Is Tesseract OCR scale-text detection still on the roadmap? If not, `eng.traineddata` stays anyway for `lib/freedom/tradeImport.js` | Owner |
| B.6 `pages/dev/takeoff-viewer-spike.jsx` | 1 | Is OpenSeadragon tiled viewing still the intended strategy per `TAKEOFF_ENGINE_ARCHITECTURE.md` rule 4? If abandoned, `openseadragon@^6.0.2` can also leave `package.json` | Owner |

### Verification commands for Stage 2

```bash
# B.1/B.2 — confirm the dev route is the only entry
rg "takeoff-engine/" -g '!.history/**' -g '!modules/takeoff-legacy/**'

# B.3 — confirm zero callers after A.1/A.2 land
rg "plan-detect" -g '!.history/**'
rg -i "plan-detect" n8n-automation/

# B.6 — confirm sole importer
rg "openseadragon" -g '!.history/**'
```

---

## 10. Active / shared files that must NOT be deleted

### Absolute do-not-touch list

```
components/construction-estimation/ai-plan-takeoff/         # THE LIVE ENGINE — and untracked
components/estimate-builder/ai-takeoff/pdfPlanRendering.js  # loadPdfJs, 8 live call sites
components/estimate-builder/ai-takeoff/planCoordinateUtils.js
components/estimate-builder/ai-takeoff/pdfPlanRendering.test.mjs
components/estimate-builder/ai-takeoff/planCoordinateUtils.test.mjs
components/estimate-builder/EstimateBuilderWorkbook.js
hooks/estimate-builder/useEstimateBuilderWorkbook.js
hooks/useJobFile.ts
hooks/useWorkspace.js
lib/jobFile.ts
pages/modules/estimate-builder/index.js
modules/takeoff-v2/                                          # incl. jobSummary.js, imported by the workbook
modules/takeoff-v3/
pages/modules/takeoff-v2/index.js
pages/modules/takeoff-v3/index.js
pages/dev/takeoff-v2-test.jsx
pages/dev/takeoff-v3-test.jsx
scripts/test-takeoff-v2-acceptance.mjs
scripts/test-takeoff-v3-acceptance.mjs
scripts/test-ai-plan-takeoff-integration.mjs
eng.traineddata                                              # also used by lib/freedom/tradeImport.js
package.json                                                 # react-konva, pdfjs-dist, openseadragon
TAKEOFF_ENGINE_ARCHITECTURE.md
```

### The three traps

1. **`components/estimate-builder/ai-takeoff/` is 80% legacy and 20% live platform infrastructure.**
   Deleting the directory breaks Project Estimate PDF import, PDF proposal import and Standard
   Inclusions PDF import — none of which are takeoff features.
2. **`modules/takeoff-v2/` looks like a rebuild you might retire, but production imports one of its
   files.** `EstimateBuilderWorkbook.js:45` → `deriveJobId` from `modules/takeoff-v2/jobSummary.js`.
   Removing takeoff-v2 breaks the live workbook's takeoff job-id derivation.
3. **`eng.traineddata` looks like a takeoff OCR leftover but is shared with Freedom.**

---

## 11. Risk of removing the earlier implementation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Losing the new engine before deletion even starts** — it is untracked and its wiring is uncommitted | **High** while uncommitted | **Catastrophic** — total loss, no git recovery | **Commit the 7 files and the wiring edits before anything else.** This is the top priority of Stage 2. |
| Deleting `ai-takeoff/` wholesale breaks PDF import in three unrelated features | Medium (the directory reads as fully legacy) | High — Project Estimate / Standard Inclusions PDF import fail at runtime | Use §8's per-file list. Never `rm -rf` the directory. |
| Deleting `modules/takeoff-legacy/` loses the only prose record of the legacy failure modes | Medium | Low–Medium | Relocate `RECOVERY.md` to `docs/` first |
| Removing `pages/api/ai/plan-detect.js` breaks an unknown external caller | Low | Medium | Verify per §9 before removal |
| Removing the `/dev/takeoff-engine-test` sandbox loses a working orientation/raster testbed | Medium | Low | Owner confirmation; the code stays recoverable in git |
| Deleting `modules/takeoff-v2/` breaks the live workbook via `deriveJobId` | Low (it is Category C) | High | Explicitly excluded; §16 proposes inlining `deriveJobId` to sever the leak |
| The new engine has no committed test in `package.json`, so regressions go unnoticed | **High** | Medium | Register `test:ai-plan-takeoff` in `package.json` |
| Two substantial new-engine files (`OpeningsModal.jsx`, `wallUtils.js`) are unreferenced and may be mistaken for legacy in a later sweep | Medium | Medium | Documented as Category D; resolve with the owner |

### What is *not* at risk

- **No database or Supabase change is implied.** No table, bucket, migration or RLS policy is tied
  to the legacy engine — `RECOVERY.md` states plainly: *"No database table and no storage bucket back
  this feature at all."* The legacy engine used only `localStorage["gr8:takeoff:v1"]`.
- **No environment variable** is used by either the old or the new engine.
- **No CSS or public asset** relates to takeoff — both searches returned empty.
- **No npm package becomes removable** from A.1–A.3 alone. `openseadragon` becomes removable only
  if B.6 is approved.
- **Users' saved legacy takeoff data** in `localStorage["gr8:takeoff:v1"]` becomes unreadable once
  `takeoffUtils.js` is deleted. **This is the one user-visible consequence.** Decide explicitly
  whether a one-time migration or export path is needed before Stage 2 — see §18.

---

## 12. Major module ownership matrix

Legend for **Copyable?**: can the module be copied to a new repository and developed with a clear
dependency boundary? *Yes* / *Partial* / *No*.

| Module | Primary folder | Routes | Files spread elsewhere | APIs owned | Shared deps | Ownership clear? | Copyable? | Target folder | Thin adapters that must remain | Risk | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **AI Plan Takeoff (new)** | `components/construction-estimation/ai-plan-takeoff/` (7) | `/modules/estimate-builder?page=aiPlanTakeoff` | 9 (§6) — all host/contract | **None** | react-konva, pdfjs-dist, lucide-react | **Yes** | **Yes** — best in repo | `features/ai-plan-takeoff/` | `pages/modules/estimate-builder/index.js`; a takeoff adapter extracted from the workbook | **High (untracked)** | **1** |
| Quotation / Estimate Builder | `components/estimate-builder/` (108) | `/modules/estimate-builder/*` (5) | `hooks/estimate-builder/`, `lib/construction-estimation/` (54), `lib/estimate-builder/`, `lib/builders/` (11), `lib/jobFile.ts`, `hooks/useJobFile.ts` | `pages/api/builders/` (7), `pages/api/project-estimate/` | Supabase, workspace, document-engine | Partial — one 18,700-line file mounts 8 sibling modules from `pages/` | **No** | `features/estimate-builder/` | Route + API adapters | High | 8 |
| Job Details / Project Setup | *none* — inside `EstimateBuilderWorkbook.js` (`inputDataSheet`) | `?page=dataInput` | `lib/construction-estimation/estimateInput*.js`, `PROJECT_SETUP_SCHEMA.md` | none | Workbook state | **No** | No | `features/job-details/` | Workbook page slot | Medium | 6 |
| Project Estimate | `components/estimate-builder/project-estimate/` | `?page=projectEstimate`, `pages/modules/projects/` | `lib/projectEstimate/`, `pages/api/project-estimate/`, `pages/qa/project-estimate-visual-editor.js` | `pages/api/project-estimate/` | document-engine, PDF import (`loadPdfJs`) | Partial | Partial | `features/project-estimate/` | Route + API adapters | Medium | 5 |
| Client Selections | split: `lib/builders/clientSelectionWorkflow.js` + `pages/modules/builders/client-selections.js` (1,596) | `/modules/builders/client-selections`, `?page=clientSelections` | `pages/modules/builders/selections-book.js` (15,266), `lib/builders/*Workflow.js`, `public/images/client-selections/` | none dedicated | Supabase, product-library | **No** — implementation in `pages/` | **No** | `features/client-selections/` | Route adapters | **High** | 3 |
| Gantt Chart | `components/gantt/` (9) + `components/estimate-builder/gantt/` | `/modules/gantt`, `/modules/gantt/[id]` (1,790), `?page=gantt` | `lib/gantt/` (7), `pages/api/gantt/` | `pages/api/gantt/` | Supabase | Partial — **two** component folders | Partial | `features/gantt/` | Route + API adapters | Medium | 6 |
| Job Board | `pages/modules/jobboard/index.js` (1,519) | `/modules/jobboard`, `?page=jobBoard` | none | `pages/api/jobboard/` | Supabase | **No** — no component folder; **the workbook dynamically imports the page** | **No** | `features/job-board/` | Route + API adapters | Medium | 7 |
| BOQ | `pages/modules/builders/boq.js` (859) | `/modules/builders/boq`, `?page=boq` | `lib/construction-estimation/finalQuotationBoq.js` (untracked) | none | Supabase | **No** | **No** | `features/boq/` | Route adapter | Medium | 4 |
| Supplier & Procurement | `pages/modules/builders/{purchase-orders,supplier-invoices,procurement-schedule}.js` (2,263) | 3 routes + 3 workbook slots | `lib/construction-estimation/procurementEngine.js`, `data/procurementLeadTimes.js` | none | Supabase | **No** | **No** | `features/procurement/` | Route adapters | Medium | 4 |
| Variations | `pages/modules/builders/variations.js` (788) | `/modules/builders/variations`, `?page=variations` | none | none | Supabase | **No** | **No** | `features/variations/` | Route adapter | Low | 4 |
| Document Vault | `pages/modules/builders/document-vault.js` (653) | `/modules/builders/document-vault`, `?page=documentVault` | `lib/supabaseFiles.js` | none | Supabase Storage | **No** | **No** | `features/document-vault/` | Route adapter | Low | 4 |
| RFIs | `pages/modules/builders/rfis.js` (689) | `/modules/builders/rfis`, `?page=rfis` | none | none | Supabase | **No** | **No** | `features/rfis/` | Route adapter | Low | 4 |
| Budget vs Actual | `pages/modules/builders/budget-vs-actual.js` (605) | `/modules/builders/budget-vs-actual`, `?page=budgetVsActual` | none | none | Supabase | **No** | **No** | `features/budget-vs-actual/` | Route adapter | Low | 4 |
| Quote Approvals | `pages/modules/builders/quote-approvals.js` (633) | `/modules/builders/quote-approvals`, `?page=quoteApprovals` | none | none | Supabase | **No** | **No** | `features/quote-approvals/` | Route adapter | Low | 4 |
| Standard Inclusions | `components/standard-inclusions/` (11) + `lib/standard-inclusions/` (6) | `pages/qa/standard-inclusions-*.js` (3) | `standard-inclusions/` (66 assets), `pages/api/standard-inclusions/` (12), `lib/standard-inclusions/pdfPageImportModel.js` | `pages/api/standard-inclusions/` | OnlyOffice, document-engine | Partial — **empty `-v2` folders exist** | Partial | `features/standard-inclusions/` | API + QA adapters | Medium | 5 |
| Product Library | `lib/product-library/` (2) | `/modules/builders/product-library` (2,386) | `data/product-library/catalogues/`, `public/images/product-library/`, `pages/api/product-library/`, 12 `scripts/` importers | `pages/api/product-library/` | Supabase | Partial | Partial | `features/product-library/` | Route + API adapters | Medium | 5 |
| Estimating Catalogue | `lib/construction-estimation/data/` + `assemblies/` (13) | none directly | `lib/construction-estimation/` engines (54) | none | — | Partial | **Yes** — pure data/logic | `features/estimating-catalogue/` or `shared/estimating/` | none | Low | 7 |
| Client Portal | `Client Portal/` (14, untracked, **space in name**) | `pages/client-portal/`, `?page=clientPortal` | `pages/api/client-portal/` (7), `supabase/migrations/20260901000100_*` | `pages/api/client-portal/` | Supabase | Partial — folder name breaks tooling | Partial | `features/client-portal/` | `RouteBridge.js` + API adapters | Medium | 3 |
| Website Builder | `components/website-builder/` (12) + `lib/website-builder/` (53) + `modules/website-builder/` (2) | `pages/modules/website-builder/*`, `pages/sites/`, `pages/[slug].js` | `pages/api/website-builder/` (15), `pages/api/websites/`, `pages/api/website/` (14), `website-builder-sites/`, `styles/website-builder-*.css` (2) | 3 API groups | Supabase, publishing | **No** — **three** component homes, **three** API groups | **No** | `features/website-builder/` | Route + API adapters | **High** | 8 |
| Freedom (Trader / Investment / Terminal / Portfolio) | `components/freedom/` + `components/freedom-trader/` + `lib/freedom/` + `lib/freedom-trader/` + `lib/freedom-terminal/` + `lib/freedom-investment/` | `pages/freedom/`, `pages/freedom-trader/` (11), `pages/freedom-investment.js`, `/modules/freedom-portfolio` | `test/freedom-*.test.mjs` (11), `pages/api/freedom*/` (4 groups, 35 routes), `eng.traineddata` | 4 API groups | Supabase, market data | **No** — **six** lib folders, **four** API groups | **No** | `features/freedom/` with sub-features | Route + API adapters | Medium | 7 |
| CRM & Marketing (Email, Social, SMS, Automation, Funnels, Calendar) | `components/crm/`, `components/email/`, `components/automation/`, `lib/email/`, `lib/social/`, `lib/crm/`, `lib/campaigns/`, `lib/smsglobal/`, `lib/automation/` | `pages/modules/email/*`, `pages/modules/social_media/*`, `pages/modules/funnels/*`, `pages/modules/calendar/*` | `email/` (227 templates), `pages/api/{email,social,automation,crm,smsglobal,twilio,telephony}/` (183 routes) | 7 API groups | Supabase, SendGrid, Twilio, SMSGlobal | **No** | **No** | `features/marketing/*` | Route + API adapters | Medium | 9 |

### Module count summary

- Modules with a **clear primary folder**: 1 of 22 (**AI Plan Takeoff**, the new engine).
- Modules **currently copyable** with a clean boundary: 2 of 22 (AI Plan Takeoff; Estimating Catalogue).
- Modules whose **implementation lives in `pages/`**: **12** (all the `pages/modules/builders/*` set,
  plus Job Board).

---

## 13. Duplicate and competing implementation findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **Five takeoff codebases** — `construction-estimation/ai-plan-takeoff` (7), `estimate-builder/ai-takeoff` (20), `estimate-builder/takeoff-engine` (36), `takeoff-legacy` (57), `takeoff-v2` (133) + `takeoff-v3` (18) = **271 files across 5 generations** | §7 | **Critical** |
| 2 | `modules/takeoff-legacy/` is a **verbatim archive copy** of two live directories | `diff -rq` confirms same file inventory, drifted contents; `RECOVERY.md` documents it as intentional | High |
| 3 | **`pages/modules/builders/` is the real home of 12 modules** — 26,113 lines of implementation inside the routes directory | `wc -l pages/modules/builders/*.js`; imports are `next/head`, `useWorkspace`, `supabase` directly — no feature-folder import | **Critical** |
| 4 | **Inverted dependency**: `EstimateBuilderWorkbook.js` (a component) dynamically imports 8 modules **from `pages/`** | `EstimateBuilderWorkbook.js:93` `import("../../pages/modules/jobboard")`, `:103` `.../builders/boq`, `:108` `purchase-orders`, `:113` `variations`, `:118` `budget-vs-actual`, `:123` `supplier-invoices`, `:128` `procurement-schedule`, `:145` `quote-approvals`, `:150` `document-vault`, `:155` `rfis` | **Critical** |
| 5 | **Byte-identical duplicate route**: `pages/modules/projects/project estimate.js` vs `pages/modules/projects/index.js` — `diff` reports **IDENTICAL** (336 lines each). The copy's own first line reads `// /pages/modules/projects/index.js`. Filename contains a space and a leading BOM | `diff` exit 0; `head -20` | High |
| 6 | **Accidental routes** `pages/components/DashCard.js` and `pages/components/Layout.js` — duplicates of `components/DashCard.js` and `components/Layout.js`, exposed as `/components/DashCard` and `/components/Layout` | `git ls-files pages/components` returns both; **already deleted in the working tree by the user** | High (resolved by user) |
| 7 | **Empty `-v2` module folders**: `components/standard-inclusions-v2/` and `lib/standard-inclusions-v2/` both contain **0 files**; `rg "standard-inclusions-v2"` across `pages components lib hooks` returns **no matches** | `find … | wc -l` = 0 | Medium |
| 8 | **Duplicate PostCSS config**: `postcss.config.js` **and** `postcss.config.mjs` both at root | `git ls-files` | Medium |
| 9 | **Two Gantt component homes**: `components/gantt/` (9) and `components/estimate-builder/gantt/` | Directory listing | Medium |
| 10 | **Three Website Builder homes**: `components/website-builder/` (12), `lib/website-builder/` (53), `modules/website-builder/` (2); **three** API groups: `api/website-builder/` (15), `api/websites/`, `api/website/` (14) | Directory listing | High |
| 11 | **Six Freedom lib folders**: `lib/freedom/`, `lib/freedom-trader/`, `lib/freedom-terminal/`, `lib/freedom-investment/`; **two** component folders; **four** API groups; **two** route trees (`pages/freedom/`, `pages/freedom-trader/`) | Directory listing | Medium |
| 12 | **Duplicate email templates**: `pages/modules/email/templates/import/progress (2).html`, `welcome (2).html`, `New Template.html` | `git ls-files` | Low |
| 13 | **Duplicate public assets**: `public/assets/Group-481785 (1).png`, `admin-ajax (1).jpeg`, `admin-ajax (2).jpeg` | `git ls-files` | Low |

---

## 14. Broader repository cleanup candidates

Every item below carries reference/route evidence. **None is recommended on filename appearance alone.**

### 14.1 Accidental routes under `pages/`

| Path | Route it creates | Evidence | Status |
|---|---|---|---|
| `pages/components/DashCard.js` | `/components/DashCard` | Tracked; duplicate of `components/DashCard.js` | **User already deleted in worktree** |
| `pages/components/Layout.js` | `/components/Layout` | Tracked; duplicate of `components/Layout.js` | **User already deleted in worktree** |
| `pages/api/affiliate/links,.js` | `/api/affiliate/links,` | Malformed — trailing comma | **User already deleted in worktree** |
| `pages/modules/projects/project estimate.js` | `/modules/projects/project%20estimate` | **Byte-identical** to `index.js`; no `href` anywhere links to it | **Untracked — recommend removal, owner to confirm** |
| `pages/modules/_guard.js` | `/modules/_guard` | Intentional: Next requires a default export; returns `null` | **Keep — documented in the file** |
| `pages/qa/*.js` (5) | `/qa/*` | Deployed and **not** gated by `middleware.js` (which covers only `/dev`) | **Verify intent** |

### 14.2 Backup / temp / malformed filenames

| Path | Evidence | Status |
|---|---|---|
| `pages/modules/website-builder/project/[id]/canvas.bak.js` | `.bak` inside `pages/` → a live route `/modules/website-builder/project/[id]/canvas.bak` | **User already deleted in worktree** |
| `ing leads` (with a trailing PUA char) | Malformed root file | **User already deleted in worktree** |
| `~$pricing-grid.xlsx` | Excel lock file | **User already staged for deletion** |
| `tmp-caesarstone.html`, `tmp-neolith.html`, `tmp-neolith-state.js`, `tmp-smartstone.html`, `tmp-stoneambassador.html` | Untracked root scratch from stone-benchtop catalogue scraping (2026-08-31); `.vercelignore` does not cover `tmp-*.html` at root | **Recommend removal or move to `tmp/`** |
| `public/tmp-project-debug.json` | **Tracked** generated debug output served publicly | **Recommend removal — verify no fetch references it** |
| `take off.code-workspace` | VSCode workspace file, tracked, space in name | Low priority; harmless |
| `email/Black friday.html`, `index black.html`, `New Template.html`, etc. (7) | Spaces in filenames | Low priority |
| `public/assets/*(1).png`, `*(2).jpeg` | Numbered duplicate assets | Low priority — verify no reference first |

### 14.3 Dead APIs

| Path | Evidence | Category |
|---|---|---|
| `pages/api/ai/plan-detect.js` | Only callers are Category A files | **B.3** |
| `pages/api/_debug-env.js`, `debug-env.js`, `debug-sms-queue.js`, `fix-sms-column.js`, `fix-sms-queue.js`, `hello.js` | Debug/one-shot endpoints at `pages/api/` root, publicly routable | **Audit separately — outside takeoff scope; `_debug-env` in particular should be reviewed for secret exposure** |

### 14.4 Tests for features that no longer exist

| Path | Evidence |
|---|---|
| `components/estimate-builder/ai-takeoff/aiTakeoffPersistence.test.mjs` | Tests `aiTakeoffPersistence.js` (Category A.1); not in `package.json` |
| `components/estimate-builder/takeoff-engine/tests/*.mjs` (13) | Test the abandoned rebuild (Category B.1); not in `package.json` |
| `modules/takeoff-legacy/**/*.test.mjs` (15) | Archive copies (Category A.2) |

**Counter-finding:** `scripts/test-ai-plan-takeoff-integration.mjs` tests the **live** engine and is
**not** registered in `package.json`, while three obsolete-adjacent takeoff scripts **are**. This is
backwards and should be corrected in Stage 2.

### 14.5 Generated output committed as source

Only one tracked file matches: `public/tmp-project-debug.json`. The repository is otherwise clean
here — logs, build output and test screenshots are either gitignored or already staged for deletion
by the user.

### 14.6 Old screenshots and diagnostic assets

| Path | Status |
|---|---|
| `test-results/standard-inclusions-hybrid-import/*.png` (2) | **User already staged for deletion**; `test-results/` is gitignored |
| `tmp-trade-check/*.jpg` (17) | **User already staged for deletion**; gitignored |
| `tmp/` (~195 MB: `HALLMARK INCLUSIONS.pdf`, `WebsiteBlockRenderer.ed4c2a3.js`, `agency-*.png`, logs) | Gitignored, untracked — local only, safe to clear at will |
| `recovery/`, `2208a52a-8175-477e-823c-fc6de7fe4afe/` | Gitignored scratch |
| `.history/` | VSCode local history, gitignored — **excluded from every search in this audit** |

### 14.7 Files stored in misleading directories

| Path | Why misleading |
|---|---|
| `pages/modules/builders/*.js` (12 files, 26,113 lines) | Full module implementations inside a routes directory |
| `pages/modules/jobboard/index.js` (1,519) | Same, and dynamically imported *back* into a component |
| `Client Portal/` (root, with a space) | A feature module at the repository root; breaks glob/CLI tooling; imported as `"../../Client Portal/RouteBridge"` |
| `components/estimate-builder/ai-takeoff/` (after Category A) | Will contain only 4 shared PDF files — name no longer describes contents |
| `components/construction-estimation/` vs `lib/construction-estimation/` | Sibling names, unrelated contents (§18) |
| `modules/website-builder/` (2 files) | A near-empty third home for a module that lives in `components/` and `lib/` |

### 14.8 Large modules with unclear ownership

| Path | Lines | Concern |
|---|---|---|
| `components/estimate-builder/EstimateBuilderWorkbook.js` | ~18,700 | Hosts 20+ page slots, 10 dynamic imports from `pages/`, and all module glue |
| `hooks/estimate-builder/useEstimateBuilderWorkbook.js` | ~6,600 | All workbook state, persistence, migrations and normalisation in one hook |
| `pages/modules/builders/selections-book.js` | 15,266 | Single largest source file; lives in `pages/` |
| `pages/modules/website-builder/visual-builder.js` | 4,692 | Implementation in `pages/` |
| `pages/modules/funnels/edit/[id].js` | 4,692 | Implementation in `pages/` |

---

## 15. Recommended target structure

### Principles

1. **Preserve Next.js Pages Router requirements.** Files under `pages/` stay where the framework
   needs them, but shrink to adapters of roughly 5–40 lines.
2. **`features/<module>/` owns its own code**, with a documented public entry point. Nothing outside
   a feature may import its internals.
3. **`shared/` (or the existing `lib/`, `hooks/`, `utils/`) holds genuinely cross-module code.**
   Do **not** copy shared infrastructure into every feature.
4. **Cross-module communication uses explicit contracts** — props, callbacks and typed payloads —
   never deep imports into another feature's internals.
5. **Incremental.** One module per step, each independently revertible.

### Five categories every file falls into

| Category | Definition | Home |
|---|---|---|
| **1. Feature-owned** | Only this module uses it | `features/<module>/` |
| **2. Shared platform** | Genuinely cross-module (Supabase clients, workspace/auth, job file, layout, UI kit) | `lib/`, `hooks/`, `utils/`, `components/ui/` |
| **3. Framework route adapter** | Exists solely because Next requires a file at that path | `pages/`, `pages/api/` |
| **4. Cross-module contract** | The typed shape two modules exchange | `contracts/` or `features/<module>/types/` |
| **5. Generated or obsolete** | Build output, archives, dead code | Deleted or gitignored |

### Feature folder shape

```
features/<module-name>/
  components/     # React components
  screens/        # Full page-level views mounted by route adapters
  hooks/
  lib/            # Pure domain logic
  api/            # Handler implementations; pages/api/* re-exports these
  storage/        # Persistence adapters
  types/
  styles/
  assets/
  tests/
  index.js        # THE public entry point — the only file others may import
  README.md       # Purpose, entry points, dependencies, how to run its tests
```

### Target for the new Takeoff Engine

```
features/ai-plan-takeoff/
  index.js                       # export { default as AIPlanTakeoffPage } from './screens/AIPlanTakeoffPage.jsx'
  README.md
  screens/
    AIPlanTakeoffPage.jsx        # ← components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffPage.jsx
    AIPlanTakeoffStandalone.jsx  # ←   "                                    /AIPlanTakeoffStandalone.jsx
  components/
    OpeningsModal.jsx            # ←   "                                    /OpeningsModal.jsx      (Category D)
  lib/
    floorplanGeometry.js
    takeoffSchedule.js
    wallUtils.js                 # (Category D)
  storage/
    jobPersistence.js
  types/
    takeoffContext.d.ts          # NEW — the platformContext / callback contract, currently implicit
  tests/
    integration.test.mjs         # ← scripts/test-ai-plan-takeoff-integration.mjs

# Adapters that remain outside
components/estimate-builder/takeoffAdapter.js   # NEW — the ~90 lines currently at
                                                #       EstimateBuilderWorkbook.js:575-660, :14937-15005
pages/modules/estimate-builder/index.js         # unchanged framework route adapter
```

### Platform-wide target

```
features/                 # one folder per module (§12 "Target folder" column)
  ai-plan-takeoff/        # step 1
  client-selections/
  boq/
  procurement/
  variations/
  document-vault/
  rfis/
  budget-vs-actual/
  quote-approvals/
  job-board/
  gantt/
  project-estimate/
  estimate-builder/
  standard-inclusions/
  product-library/
  client-portal/
  website-builder/
  freedom/
  marketing/{email,social,sms,automation,funnels,calendar}/

contracts/                # cross-module payload shapes (takeoff→estimate, selections→BOQ, …)

pages/                    # thin route adapters ONLY
pages/api/                # thin API adapters ONLY

lib/  hooks/  utils/  components/ui/   # genuinely shared platform code
modules/                  # retire once takeoff-v2/v3 resolve, or rename to features/
```

### What deliberately does **not** move

- `lib/supabaseClient.js`, `lib/supabaseAdmin.js`, `utils/supabase-client.js`, `lib/withWorkspace.js`
- `hooks/useWorkspace.js`, `hooks/useJobFile.ts`, `lib/jobFile.ts`
- `components/Layout.js`, `components/SideNav.js`, `components/nav-config.js`, `components/ui/`
- `middleware.js`, `pages/_app.js`, `pages/modules/_guard.js`
- `supabase/migrations/`, `styles/globals.css`

---

## 16. Incremental migration plan

**Step 0 is mandatory and must precede everything else.**

| Step | Scope | Actions | Revert |
|---|---|---|---|
| **0. Protect** | Git only | Commit the 7 untracked new-engine files **and** the `EstimateBuilderWorkbook.js` + `useEstimateBuilderWorkbook.js` rewiring. Tag `safety/pre-takeoff-cleanup-20260901`. Verify `safety/pre-takeoff-v2-20260722` and `03ba8fb` resolve. | n/a |
| **1. Register the test** | `package.json` | Add `"test:ai-plan-takeoff": "node scripts/test-ai-plan-takeoff-integration.mjs"`. Confirm it passes. | Revert one line |
| **2. Delete Category A** | 73 files (§8) | Single commit. Re-run §17. | `git revert` |
| **3. Resolve Category B** | 40 files (§9) | One commit per B-item, in order: B.1+B.2 together → B.3 → B.4 (relocate) → B.5 → B.6. | Per-commit revert |
| **4. Rescue the shared PDF code** | 4 files | Move the retained `pdfPlanRendering.js` + `planCoordinateUtils.js` + 2 tests to `lib/pdf/`; update `EstimateBuilderWorkbook.js:44`. Remove the now-empty `ai-takeoff/`. | `git revert` |
| **5. Sever the takeoff-v2 leak** | 2 files | Inline `deriveJobId` (6 lines) into the workbook or `lib/jobFile.ts`; drop `EstimateBuilderWorkbook.js:45`. `modules/takeoff-v2/` then has **zero** production importers. | `git revert` |
| **6. Create `features/ai-plan-takeoff/`** | 7 + 1 files | Move the module per §15. Extract `components/estimate-builder/takeoffAdapter.js`. Add `index.js`, `README.md`, `types/takeoffContext.d.ts`. Update 3 import sites. | `git revert` |
| **7. Guard the takeoff routes** | 2 files | Add `useModuleGuard` to `pages/modules/takeoff-v3/index.js`; decide whether `/modules/takeoff-v2` should stay unguarded (its comment says the guard is deferred to "Phase 12"). | Trivial |
| **8. Duplicate/accidental route sweep** | ~8 files | Remove `pages/modules/projects/project estimate.js`, `public/tmp-project-debug.json`, the empty `*-v2` folders, one of the two PostCSS configs, root `tmp-*.html`. Confirm the user's existing worktree deletions. | `git revert` |
| **9. Migrate `pages/modules/builders/`** | 12 modules | **One module per commit**, smallest first: Variations (788) → Budget vs Actual (605) → Procurement Schedule (615) → Quote Approvals (633) → Document Vault (653) → RFIs (689) → Supplier Invoices (797) → Purchase Orders (851) → BOQ (859) → Client Selections (1,596) → Product Library (2,386) → Selections Book (15,266). Each: create `features/<m>/`, move code, leave a thin `pages/` adapter, switch the workbook's dynamic import from `../../pages/...` to `../../features/...` — **this is what fixes the inverted dependency**. | Per-commit revert |
| **10. Job Board, Gantt, Project Estimate** | 3 modules | Same pattern. Merge the two Gantt component folders. | Per-commit revert |
| **11. Client Portal** | 14 files | `Client Portal/` → `features/client-portal/` — removes the space from the path. | `git revert` |
| **12. Website Builder, Freedom, Marketing** | Large | Last. Consolidate the three WB homes and six Freedom lib folders first, then migrate. | Per-commit revert |
| **13. Retire `modules/`** | — | Once takeoff-v2/v3 resolve, fold `modules/` into `features/`. | — |

**Takeoff is step 2–6 because the new engine works, the abandoned build must go safely, and it is the
module with the cleanest boundary — it proves the pattern at the lowest risk.**

---

## 17. Verification and regression test plan

### Before any deletion (baseline)

```bash
git status --short > /tmp/baseline-status.txt
git rev-parse HEAD
git rev-parse safety/pre-takeoff-v2-20260722
git cat-file -t 03ba8fb

node scripts/test-ai-plan-takeoff-integration.mjs   # must print "…checks passed."
npm run test:takeoff-v2
npm run test:takeoff-v3
npm run typecheck
npm run lint
npm run build                                        # record warning/error counts
```

### Static checks after each deletion commit

```bash
# 1. No dangling imports of deleted paths
rg "ai-takeoff/(AIPlanTakeoffPage|AIReviewPanel|MeasurementSummary|ObjectPanel|PDFUploadPanel|PlanCanvas|PushToEstimatorPanel|RoomAnalysisPanel|RoomPanel|ScaleCalibrationPanel|TakeoffToolbar|aiDetectionService|aiTakeoffPersistence|takeoffTypes|takeoffUtils)" -g '!.history/**'
rg "takeoff-legacy" -g '!.history/**'
rg "TakeoffEngineWorkbookPage" -g '!.history/**'

# 2. The shared PDF code SURVIVED — this must still return the workbook import
rg "ai-takeoff/pdfPlanRendering" -g '!.history/**'
rg "loadPdfJs" components/estimate-builder/EstimateBuilderWorkbook.js   # expect 8 call sites + 1 import

# 3. The new engine is intact
ls components/construction-estimation/ai-plan-takeoff/    # expect 7 files
rg "construction-estimation/ai-plan-takeoff" -g '!.history/**'  # expect 3 importing files

# 4. Build integrity
npm run typecheck && npm run lint && npm run build
```

### Automated regression

```bash
node scripts/test-ai-plan-takeoff-integration.mjs
npm run test:takeoff-v2
npm run test:takeoff-v3
npm run test:project-estimate-pdf-importer       # guards the loadPdfJs path
npm run test:estimate-workbook-sheet-tabs
npm run test:standard-inclusions-management
npm run test:final-quotation-boq-filter
```

`test:project-estimate-pdf-importer` is the key one — it is the automated guard on the
`loadPdfJs` dependency that §10 identifies as the most dangerous file to delete by accident.

### Manual regression — the new Takeoff Engine

| # | Check |
|---|---|
| 1 | `/modules/estimate-builder?page=projectDashboard` renders the **AI Plan Takeoff** card |
| 2 | Clicking it opens the engine; `/modules/estimate-builder?page=aiPlanTakeoff` deep-links directly |
| 3 | Upload a multi-page PDF plan; pages render; page navigation works |
| 4 | Rotate the plan; the rotation persists across page changes |
| 5 | Two-point scale calibration produces a correct `pixelsPerMm` |
| 6 | Draw exterior and interior wall runs; thickness and length are correct |
| 7 | Place window and door openings |
| 8 | Trace a floorplan footprint; the m² area is correct |
| 9 | Add floor-covering areas and eaves |
| 10 | Open the schedule panel; totals match the drawn geometry |
| 11 | **Save Job** → reload the page → the takeoff reopens with all geometry and embedded plan pages |
| 12 | Export CSV and Excel XML |
| 13 | Push to Job Setup: `projectName`, `siteAddress`, `lowerFloorAreaM2`, `lowerExternalWallsLm`, `lowerInternalWallsLm` update on the Job Details sheet |
| 14 | Push to the quote sheet: quantities update, **rates and formulas are preserved** |
| 15 | Local export (`.gr8takeoff`) and re-import round-trips |
| 16 | Save a `.gr8job`, close, reopen — the takeoff is restored |
| 17 | **Back to Dashboard** returns to the project dashboard |

### Manual regression — the shared PDF path (the highest-risk collateral)

| # | Check |
|---|---|
| 18 | Project Estimate → import a PDF → pages render |
| 19 | Standard Inclusions → import a PDF → hybrid page model builds |
| 20 | Quote proposal → import a PDF document |

### Manual regression — routes that must still respond

`/modules/takeoff-v2` · `/modules/takeoff-v3` · `/dev/takeoff-v2-test` · `/dev/takeoff-v3-test` ·
`/modules/estimate-builder` · `/modules/builders/boq` · `/modules/jobboard`

### Rollback

Every deletion step is a single revertible commit, with `safety/pre-takeoff-cleanup-20260901` as the
floor. No database, storage or configuration change is involved, so rollback is purely a git operation.

---

## 18. Unanswered questions and evidence gaps

| # | Question | Why it matters | How to resolve |
|---|---|---|---|
| 1 | **Should the new engine be committed now?** It is 7 untracked files plus uncommitted wiring. | A `git clean -fd` destroys it permanently. | Owner decision — recommended immediately |
| 2 | `OpeningsModal.jsx` and `wallUtils.js` (new engine) have **zero importers**. Dead on arrival, or a planned next phase? | 324 lines of substantial logic (wall thickness detection, offset polygons) whose fate a later cleanup could get wrong | Ask the owner / check the upstream source project |
| 3 | Users with legacy takeoff work in `localStorage["gr8:takeoff:v1"]` lose access once `takeoffUtils.js` is deleted. | The only user-visible consequence of Category A | Decide whether a one-time export or migration is needed **before** step 2 |
| 4 | Is `/dev/takeoff-engine-test` still used? | Gates 36 files (Category B.1/B.2) | Owner |
| 5 | Does anything external POST to `/api/ai/plan-detect`? | Gates Category B.3 | Owner + review `n8n-automation/` |
| 6 | Are `takeoff-v2` **and** `takeoff-v3` both still wanted? Two parallel rebuilds (151 files) alongside a working engine. | The largest remaining duplication after Category A | Owner — outside this audit's remit; both are Category C on current evidence |
| 7 | Why does `components/construction-estimation/` (7 takeoff files) sit beside `lib/construction-estimation/` (54 estimating-engine files) with no code relationship? | Misleading sibling naming | Confirm the intended taxonomy before §15 renames anything |
| 8 | Is `pages/qa/*` (5 routes, ungated) intentionally public? | `middleware.js` gates `/dev` but not `/qa` | Owner |
| 9 | Should `/modules/takeoff-v2` and `/modules/takeoff-v3` remain unguarded? v2's file comments say the guard is deferred to "Phase 12"; v3 has **no** guard and **no** comment. | Unguarded production routes | Owner |
| 10 | ~50 untracked renumbered `supabase/migrations/*.sql` replace ~40 deleted tracked ones. | Outside this audit's remit (explicitly excluded from analysis), but it is a large uncommitted change sitting under the same working tree | Owner — flagging only |
| 11 | `.history/` was excluded from every search. Could it hide a live import? | It is gitignored VSCode local history, not part of the build; Next.js does not compile it | Low risk; noted for completeness |
| 12 | Git history was searched by directory creation/last-touch date rather than by exhaustive content archaeology across all branches. | A takeoff file deleted on another branch would not surface | Run `git log --all --diff-filter=D -- '*takeoff*'` if a deeper sweep is wanted |

---

## 19. Proposed Stage 2 execution plan

**Awaiting approval. Nothing below has been executed.**

### Stage 2A — Protect (do this first, independent of any deletion approval)

1. `git add components/construction-estimation/ai-plan-takeoff/ scripts/test-ai-plan-takeoff-integration.mjs`
2. `git add components/estimate-builder/EstimateBuilderWorkbook.js hooks/estimate-builder/useEstimateBuilderWorkbook.js`
3. Commit: `feat(takeoff): commit new AI Plan Takeoff engine and platform wiring`
4. `git tag safety/pre-takeoff-cleanup-20260901`
5. Add `"test:ai-plan-takeoff"` to `package.json`; confirm it passes.

**Deliverable:** the working engine is recoverable. **Risk: none.** *This step is recommended
regardless of what is approved in 2B–2D.*

### Stage 2B — Delete Category A (73 files)

Preconditions per §8. One commit. Verification per §17.
**Deliverable:** the abandoned takeoff implementation is gone.
**Risk: Low** — every file proven unreferenced by a per-file loop.

### Stage 2C — Resolve Category B (40 files)

One commit per item, in the order given in §16 step 3, each gated on the §9 answer.
**Risk: Medium** — depends entirely on owner answers.

### Stage 2D — Establish `features/ai-plan-takeoff/`

§16 steps 4–7: rescue the shared PDF code, sever the takeoff-v2 leak, create the feature folder,
extract the adapter, guard the routes.
**Deliverable:** the first module with a real, documented, copyable boundary — the template for
everything after.
**Risk: Low–Medium** — mechanical moves with only 3 import sites to update.

### Stage 2E — Repository-wide sweep and module migration

§16 steps 8–13. Should be scoped as its own stage after 2D proves the pattern.

### What Stage 2 will not do

- No database, Supabase, migration or RLS change
- No environment or Vercel/deployment configuration change
- No package install, update or removal (except `openseadragon`, and only if B.6 is approved)
- No repository-wide reformatting
- No dev server
- No modification to the user's 431 existing working-tree changes beyond the specific files named above

---

## Appendix — Evidence index

| Claim | Command / location |
|---|---|
| Branch, HEAD, clean merge state | `git rev-parse --abbrev-ref HEAD`; `git rev-parse HEAD`; `.git/{MERGE_HEAD,CHERRY_PICK_HEAD,rebase-*}` absent; `git diff --diff-filter=U` empty |
| 431 status entries, 190/160/25/56 split | `git status --short | awk '{print substr($0,1,2)}' | sort | uniq -c` |
| New engine untracked | `git ls-files components/construction-estimation/ai-plan-takeoff` → 0; `git ls-files --others --exclude-standard` → 7 |
| HEAD still mounts the legacy engine | `git show HEAD:components/estimate-builder/EstimateBuilderWorkbook.js | grep -n AIPlanTakeoff` → `:42`, `:894` |
| New engine live mount | `EstimateBuilderWorkbook.js:98`, `:575`, `:1141-1143` |
| New engine self-containment | `grep -nE "^import" components/construction-estimation/ai-plan-takeoff/*` — only npm + siblings |
| `loadPdfJs` is live and shared | `grep -n loadPdfJs components/estimate-builder/EstimateBuilderWorkbook.js` → import at `:44`, calls at `:5826,5904,5925,9299,9954,10326,10586,10612` |
| Per-file legacy proof | External-importer loop over all 20 `ai-takeoff/` and all 36 `takeoff-engine/` files |
| `modules/takeoff-v2` comment-only refs | `sed -n '1,8p' modules/takeoff-v2/takeoff/{geometry,snapping}.js` |
| `TakeoffEngineWorkbookPage.jsx` orphaned | Full internal import graph of `takeoff-engine/`; corroborated by `docs/MODULE_ARCHITECTURE_AUDIT.md:134` |
| `plan-detect` callers | `rg "plan-detect"` → 4 hits, all legacy or the route's own comment |
| Archive provenance | `modules/takeoff-legacy/RECOVERY.md`; `git log --diff-filter=A -- modules/takeoff-legacy` → `9625643` |
| Duplicate route identical | `diff "pages/modules/projects/project estimate.js" pages/modules/projects/index.js` → exit 0 |
| `pages/modules/builders/` line counts | `wc -l pages/modules/builders/*.js` → 26,113 total |
| Inverted dependency | `EstimateBuilderWorkbook.js:93,103,108,113,118,123,128,145,150,155` |
| takeoff-v2 leak | `EstimateBuilderWorkbook.js:45` |
| Empty `-v2` folders | `find components/standard-inclusions-v2 lib/standard-inclusions-v2 -type f | wc -l` → 0 |
| No takeoff CSS or assets | `grep -rln takeoff styles/` → empty; `find public -iname '*takeoff*'` → empty |
| `eng.traineddata` shared | `rg -l "tesseract|traineddata"` → `pages/dev/plan-import-test.js`, `lib/freedom/tradeImport.js`, `package.json` |
| Dev routes deployed but gated | `middleware.js:19,44-51`; `.vercelignore` does not exclude `pages/dev` |
| takeoff-v3 unguarded | `grep -c useModuleGuard pages/modules/takeoff-v3/index.js` → 0 |
| New engine test passes | `node scripts/test-ai-plan-takeoff-integration.mjs` → exit 0 |
| npm deps | `package.json`: `react-konva@18.2.16`, `pdfjs-dist@^6.1.200`, `lucide-react@^0.545.0`, `openseadragon@^6.0.2` |
