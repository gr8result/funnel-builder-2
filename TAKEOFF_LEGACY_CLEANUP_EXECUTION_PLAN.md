# Takeoff Legacy Cleanup — Execution Plan

**Planning document. Batches 1–8 are NOT authorised yet. Batch 0 is complete.**

- Produced: 2026-09-01
- Companion document: [REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md](REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md)
- Safety branch: `safety/pre-takeoff-cleanup-2026-09-01`
- Checkpoint commit: `a50f14b3f2d4d042bd0570419e89dd56baeabf3a`
- Engine to retain: `components/construction-estimation/ai-plan-takeoff/`

---

## Owner decisions applied

| Decision | Effect on this plan |
|---|---|
| The new engine at `components/construction-estimation/ai-plan-takeoff/` is retained | Protected in Batch 0; excluded from every deletion batch |
| All earlier takeoff builds are to be removed once dependencies are separated | `ai-takeoff`, `takeoff-engine`, `takeoff-legacy`, `takeoff-v2`, `takeoff-v3` all move to the deletion set |
| Route exposure or a passing test is **not** grounds to retain | `/modules/takeoff-v2`, `/modules/takeoff-v3`, `/dev/takeoff-*`, `test:takeoff-v2/v3` are all reclassified as legacy |
| `OpeningsModal.jsx` and `wallUtils.js` are retained new-engine files | Reclassified out of Category D into **retained**; never appear in a deletion list |
| `localStorage["gr8:takeoff:v1"]` need not remain supported | No migration code. Consequence documented in §Batch 3 |
| The new engine and integrated platform must remain functional | Batch 1 precedes all deletion; Batch 8 verification is mandatory |

---

## Batch 0 — Safety proof ✅ COMPLETE

### Recorded state before the checkpoint

| Item | Value |
|---|---|
| Branch at start | `production/website-builder-20260808` |
| HEAD at start | `81c5613d247ce1d16c20e23de9728858efd142e2` |
| Unfinished merge / rebase / cherry-pick / revert / bisect | **None** — `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `BISECT_LOG`, `rebase-merge/`, `rebase-apply/`, `sequencer/` all absent |
| Merge conflicts | **0** (`git diff --diff-filter=U` empty) |
| Working tree entries | 436 (195 `??`, 160 ` M`, 25 `D ` staged, 56 ` D` unstaged) |
| Remote | `origin` → `https://github.com/gr8result/funnel-builder-2.git` |

### Untracked-file safety screen (performed before staging)

| Check | Result |
|---|---|
| Environment files (`.env*`) | **None staged.** `.env`, `.env.local`, `.env.production`, `.env.example` are all gitignored by `.gitignore:40` (`.env*`) and are **not tracked** — `git ls-files --error-unmatch .env.example` → *did not match* |
| Credentials / secrets in the commit set | **Clean.** Scanned all 12 paths for `sk-proj-*`, `sk-*`, `eyJ*` JWTs, `SUPABASE_SERVICE_ROLE_KEY=`, `AKIA*`, PEM private keys → zero hits |
| `node_modules` | **None** — no untracked path matches |
| Generated build output | **None** — `.next*`, `dist`, `build`, `out`, `coverage` all absent from untracked set |
| Large files | Excluded: `public/images/catalogues/` (71 MB), `eng.traineddata` (5.2 MB), `data/product-library/catalogues/cabinetry/` (1.2 MB) |
| Empty/tool artifacts | Excluded: `.codex-schema-dump.sql` (0 bytes, created by another tool mid-session) |
| User documents / temp | Excluded: `tmp-*.html`, `tmp-neolith-state.js`, `pricing-grid.xlsx`, `tmp/`, `recovery/` |

`git add -A` was **not** used. Every path was named explicitly.

### Origin and purpose confirmation (Stage 2A item 4)

**`lib/projectStore.ts`** — created 2026-09-01 11:15, during the audit session, **not by this agent**
(only read commands and one read-only assertion script were run before it appeared). It is a new
**master `.gr8job` package layer** built on `lib/jobFile.ts`, exposing `updateMasterJobSection`,
`markMasterJobSectionDirty` and `saveMasterJob` over ten named sections including `"takeoff"`.

Its relationship to the current takeoff integration:

- **Not wired into it.** No production file imports `lib/projectStore.ts`. Its only consumer is
  `scripts/test-master-gr8job-package.mjs` (untracked), which passes:
  `Master .gr8job package contract tests passed.`
- The eleven `projectStore` hits elsewhere in the repo all resolve to a **different, unrelated
  module**, `lib/website-builder/projectStore.js`.
- It is **architecturally adjacent**: it sits on the same `lib/jobFile.ts` save/load path the takeoff
  engine uses to persist and reopen work, and it declares a `"takeoff"` section.

**Conclusion: `lib/projectStore.ts` is related to the takeoff *persistence architecture* but is not
part of the current integration.** It was committed to the checkpoint because it is new, untracked,
passing its contract test, and on the same job-file path — losing it would be silent data-model loss.

**The seven new-engine files** — all untracked, mtimes 2026-08-28 → 2026-09-01, never committed at
any point in history. Purpose confirmed by tracing from the live route (audit §4) and by the passing
integration test.

**The integration changes** — confirmed by diffing HEAD against the working tree:

```
git show 81c5613:components/estimate-builder/EstimateBuilderWorkbook.js | grep -n AIPlanTakeoff
  42:import AIPlanTakeoffPage from "./ai-takeoff/AIPlanTakeoffPage";     ← OLD engine
 894:            <AIPlanTakeoffPage sheet={sheet} />
```
versus working tree line 98 (`dynamic(() => import("../construction-estimation/ai-plan-takeoff/…"))`)
and line 1141. This is precisely the switch from the legacy engine to the new one.

### The checkpoint commit

```
branch : safety/pre-takeoff-cleanup-2026-09-01
commit : a50f14b3f2d4d042bd0570419e89dd56baeabf3a
author : Grant, 2026-09-01 12:27:13 +1000
parent : 81c5613d247ce1d16c20e23de9728858efd142e2
```

### Exact protected files (31 paths)

| Group | Paths | State |
|---|---|---|
| **The engine (7)** | `components/construction-estimation/ai-plan-takeoff/{AIPlanTakeoffPage.jsx, AIPlanTakeoffStandalone.jsx, OpeningsModal.jsx, floorplanGeometry.js, jobPersistence.js, takeoffSchedule.js, wallUtils.js}` | was untracked → **added** |
| **The integration (2)** | `components/estimate-builder/EstimateBuilderWorkbook.js`, `hooks/estimate-builder/useEstimateBuilderWorkbook.js` | modified → **complete current version committed, no hunks discarded** |
| **Job-file / persistence layer (3)** | `hooks/useJobFile.ts`, `lib/jobFile.ts` (modified), `lib/projectStore.ts` (added) | takeoff save/reopen path |
| **Coherence dependencies (16)** | `components/project-workspace/ProjectCompactBanner.jsx`, `lib/construction-estimation/finalQuotationBoq.js`, `Client Portal/` (14 files) | untracked modules the workbook imports — without them the commit would not be a buildable tree |
| **Tests (2)** | `scripts/test-ai-plan-takeoff-integration.mjs`, `scripts/test-master-gr8job-package.mjs` | added |
| **Audit (1)** | `REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md` | added |

The 16 coherence dependencies were included because a dependency-closure scan proved
`EstimateBuilderWorkbook.js` and `useEstimateBuilderWorkbook.js` import them; committing the
integration without them would have produced a checkpoint that could not build.

### The owner's own work was preserved, not swept in

`git commit --only <paths>` was used so the index was not blanket-committed. **All 25 owner-staged
deletions remain staged and uncommitted** (`.next-dev*.log`, `build_output.txt`,
`test-results/*.png`, `tmp-trade-check/*.jpg`, `~$pricing-grid.xlsx`) — verified after the commit by
`git diff --cached --name-status` returning exactly those 25 entries. The 56 unstaged deletions are
also untouched.

| Metric | Before | After | Delta |
|---|---|---|---|
| Untracked (`??`) | 195 | 187 | −8 (the 8 paths committed) |
| Modified (` M`) | 160 | 156 | −4 (the 4 modified files committed) |
| Staged deletions (`D `) | 25 | **25** | **0 — preserved** |
| Unstaged deletions (` D`) | 56 | **56** | **0 — preserved** |

### Recovery commands

```bash
# List the engine inside the checkpoint
git ls-tree -r --name-only a50f14b -- components/construction-estimation/ai-plan-takeoff

# Restore the whole engine into the working tree
git checkout a50f14b -- components/construction-estimation/ai-plan-takeoff/

# Restore the integration
git checkout a50f14b -- components/estimate-builder/EstimateBuilderWorkbook.js \
                        hooks/estimate-builder/useEstimateBuilderWorkbook.js

# Restore one file
git checkout a50f14b -- components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx

# Inspect without touching the working tree
git show a50f14b:components/construction-estimation/ai-plan-takeoff/jobPersistence.js

# Extract to a scratch directory
git archive a50f14b -- components/construction-estimation/ai-plan-takeoff | tar -x -C /some/scratch/dir

# Full side-by-side worktree
git worktree add ../takeoff-checkpoint-compare a50f14b
```

### Proof the working engine exists in the checkpoint

Extraction test performed into scratch space (not the repository):

```
git archive a50f14b -- components/construction-estimation/ai-plan-takeoff | tar -x -C <scratch>
→ 7 files recovered
```

| File | Result |
|---|---|
| `AIPlanTakeoffPage.jsx` | content-identical (EOL filter only: worktree LF, archive CRLF) |
| `AIPlanTakeoffStandalone.jsx` | content-identical (EOL only) |
| `OpeningsModal.jsx` | **byte-identical** |
| `floorplanGeometry.js` | content-identical (EOL only) |
| `jobPersistence.js` | content-identical (EOL only) |
| `takeoffSchedule.js` | content-identical (EOL only) |
| `wallUtils.js` | **byte-identical** |

`diff --strip-trailing-cr` returns zero differences for all seven. The five EOL-only differences are
`core.autocrlf` on Windows applying the checkout filter during `git archive`; they are inert for
Node/Next. **All seven files are fully recoverable.**

Post-checkpoint sanity: `node scripts/test-ai-plan-takeoff-integration.mjs` → *passed*;
`node scripts/test-master-gr8job-package.mjs` → *passed*; working tree still holds 7 engine files.

### ⚠️ Branch-switch hazard

The engine is tracked on `safety/pre-takeoff-cleanup-2026-09-01` but **not** on
`production/website-builder-20260808` (still at `81c5613`). Running
`git checkout production/website-builder-20260808` **would delete the 7 engine files and the other 21
newly-added files from the working tree**, because they are tracked here and absent there.

**Stay on the safety branch for Batches 1–8.** If you must return to the production branch, first
merge or cherry-pick `a50f14b` into it. Nothing was pushed; `origin` is unchanged.

---

## Batch 1 — Shared-code extraction

**No legacy deletion in this batch.** Both moves must land and verify before anything is removed.

### 1A — `deriveJobId`

**Current owner:** `modules/takeoff-v2/jobSummary.js:44` — a six-line filename-to-slug helper with no
takeoff-specific logic, currently imported by production code from an abandoned rebuild module.

**Consumer census (whole repo, `.history/` excluded):**

```
grep -rn "deriveJobId|readJobSummaryFromQuery|jobSummaryFromJobFileData|NOT_ENTERED_LABEL|DEFAULT_JOB_ID"
  components/estimate-builder/EstimateBuilderWorkbook.js:45   import { deriveJobId } from "../../modules/takeoff-v2/jobSummary.js";
  components/estimate-builder/EstimateBuilderWorkbook.js:14949   const derived = deriveJobId(candidate);
  modules/takeoff-v2/jobSummary.js  (the definitions themselves)
```

**Exactly one consumer.** The file's other four exports have **zero** consumers — not even inside
`modules/takeoff-v2/`. Once `deriveJobId` moves, `jobSummary.js` deletes with Batch 4 in full.

**Proposed destination: `lib/jobFile.ts`** — exported as `deriveJobId`.

Rationale:
- `lib/jobFile.ts` already owns `.gr8job` file identity: `JOB_FILE_EXTENSION = ".gr8job"` (`:3`),
  `slugFileName()` (`:90`), `jobFileName()` (`:442`).
- It already contains near-identical logic. `canonicalProjectId()` at `:275-281` does
  `slugFileName(...).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")` — the same
  slug shape `deriveJobId` produces, and `:342` already strips `/\.gr8job$/i`.
- The workbook already imports across the JS→TS boundary (`hooks/useJobFile.ts` at `:26`), so a
  `.js` file importing from `lib/jobFile.ts` is an established pattern here.
- It is **not** duplicated anywhere: one definition, one home.

`lib/projectStore.ts` was considered and rejected — it is a higher-level master-package layer with no
production consumers yet, so putting a load-bearing production helper there would couple live code to
unfinished scaffolding.

**Exact changes:**

| File | Change |
|---|---|
| `lib/jobFile.ts` | **Add** `export function deriveJobId(fileName: string): string \| null` — verbatim logic from `jobSummary.js:44-53`, typed. Place beside `slugFileName`. |
| `components/estimate-builder/EstimateBuilderWorkbook.js:45` | Replace `import { deriveJobId } from "../../modules/takeoff-v2/jobSummary.js";` with `import { deriveJobId } from "../../lib/jobFile";` |
| `modules/takeoff-v2/jobSummary.js` | **No change now.** Deleted in Batch 4. |

Behaviour must be preserved exactly:

```js
const trimmed = String(fileName || "").trim();
if (!trimmed) return null;
const withoutExtension = trimmed.replace(/\.gr8job$/i, "");
const slug = withoutExtension.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
return slug || null;
```

**Tests to add:** extend `scripts/test-ai-plan-takeoff-integration.mjs` (or a new
`scripts/test-job-id-derivation.mjs` registered as `test:job-id`) covering: `"Johnson.gr8job"` →
`"johnson"`; `"JOHNSON.GR8JOB"` → `"johnson"` (case-insensitive extension); `"  "` → `null`;
`"!!!"` → `null`; `"A B—C"` → `"a-b-c"`; and that the workbook's `deriveTakeoffEngineJobId` still
falls back to `"estimate-builder-unsaved"` when every candidate is empty.

### 1B — `loadPdfJs`

**Current owner:** `components/estimate-builder/ai-takeoff/pdfPlanRendering.js:208`.

**Exact callers — one import, eight call sites, none of them takeoff:**

```
components/estimate-builder/EstimateBuilderWorkbook.js:44    import { loadPdfJs } from "./ai-takeoff/pdfPlanRendering";
  :5826   const pdfjsLib = await loadPdfJs();
  :5904   const pdfjsLib = await loadPdfJs();
  :5925   const pdfjsLib = await loadPdfJs();
  :9299   const pdfjsLib = await loadPdfJs();
  :9954   const pdfjs   = await loadPdfJs();
  :10326  const pdfjs   = await loadPdfJs();
  :10586  const pdfjsLib = await loadPdfJs();
  :10612  return loadPdfJs();
```

A repo-wide scan for `pdfPlanRendering` (excluding the legacy directory itself and the archive)
returns **only** line 44. These call sites serve **Project Estimate PDF import** and **Standard
Inclusions PDF import** — no takeoff involvement.

**Other genuinely shared exports in that file: none.** `pdfPlanRendering.js` exports 20 symbols
(`DEFAULT_PDF_TARGET_DPI`, `renderPdfDataUrlPage`, `rotateRasterImageDataUrl`, `buildRasterPageMetadata`,
`detectOrientationFromTextItems`, …). Every one except `loadPdfJs` is consumed only by files inside
`components/estimate-builder/ai-takeoff/`, all of which are deleted in Batch 3.

**`loadPdfJs` is fully self-contained.** It needs four module-level items and **does not** touch
`planCoordinateUtils.js`:

```js
const PDFJS_VERSION = "3.11.174";                                    // :3
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;  // :4
let pdfJsPromise = null;                                             // :14
function workerSrcForPdfJs(pdfjsLib) { … }                           // :16-20
export function loadPdfJs() { … }                                    // :208-229
```

**Consequence:** once `loadPdfJs` moves, `planCoordinateUtils.js` has **no retained consumer**. Its
only importers are `pdfPlanRendering.js`, `PlanCanvas.jsx`, `takeoffUtils.js` and its own test — all
Batch 3 deletions. So all four files previously held back as "shared" become deletable in Batch 3.

**Proposed destination: `lib/pdf/pdfjsLoader.js`** (new directory; `lib/pdf/` does not exist today).

Rationale: it is browser-side shared infrastructure with no domain ownership; `lib/` is where this
repo puts shared services; the name states exactly what it is. It must **not** live under
`components/estimate-builder/` — the eight callers are workbook-level PDF import, and a future
non-workbook caller should not have to reach into a component folder.

**Exact changes:**

| File | Change |
|---|---|
| `lib/pdf/pdfjsLoader.js` | **New.** Move `PDFJS_VERSION`, `PDFJS_CDN`, `pdfJsPromise`, `workerSrcForPdfJs`, `loadPdfJs` verbatim. Add a header comment noting this loads PDF.js **from CDN** and is distinct from the `pdfjs-dist` npm package the new takeoff engine uses. |
| `components/estimate-builder/EstimateBuilderWorkbook.js:44` | Replace with `import { loadPdfJs } from "../../lib/pdf/pdfjsLoader";` |
| `components/estimate-builder/ai-takeoff/pdfPlanRendering.js` | **No change now.** Deleted in Batch 3. |

**Tests to add:** `scripts/test-pdfjs-loader.mjs` (register as `test:pdfjs-loader`) asserting the
module exports `loadPdfJs`; that it rejects with `"SSR"` when `window` is undefined; that the promise
is memoised (two calls return the same promise object); and that `workerSrcForPdfJs` returns the
CDN worker URL for version `3.11.174` and the unpkg legacy URL otherwise. Also re-run
`npm run test:project-estimate-pdf-importer`, which is the existing automated guard on this path.

### ⚠️ Known issue to record, not fix in this batch

The repository now has **two PDF.js strategies**: the CDN script-tag loader (`loadPdfJs`, pinned to
3.11.174, used by the workbook) and the `pdfjs-dist@^6.1.200` npm package (used by the new engine,
which pulls only its worker from CDN). Unifying them is a sensible follow-up but is **out of scope** —
changing the workbook's PDF engine version during a cleanup would risk the very import paths Batch 8
is meant to protect.

### Batch 1 exit criteria

```bash
npm run typecheck && npm run lint
node scripts/test-ai-plan-takeoff-integration.mjs
npm run test:project-estimate-pdf-importer
node scripts/test-pdfjs-loader.mjs          # new
node scripts/test-job-id-derivation.mjs     # new
grep -rn "modules/takeoff-v2/jobSummary" components pages lib hooks   # expect: no results
grep -rn "ai-takeoff/pdfPlanRendering"      components pages lib hooks   # expect: no results
```

---

## Batch 2 — Remove abandoned routes and navigation

Routes are removed **before** the code they mount, so that nothing is briefly route-exposed but broken.

### Route files to delete (8)

| Path | Route | What mounts it | Evidence it is legacy-only |
|---|---|---|---|
| `pages/modules/takeoff-v2/index.js` | `/modules/takeoff-v2` | `modules/takeoff-v2/components/TakeoffV2Page.jsx` | File's own header: *"Dev-only for now… Unlinked from nav, no production data, direct-URL-only."* |
| `pages/modules/takeoff-v3/index.js` | `/modules/takeoff-v3` | `modules/takeoff-v3/components/TakeoffV3Page.jsx` | **Unguarded** — no `useModuleGuard` |
| `pages/dev/takeoff-v2-test.jsx` | `/dev/takeoff-v2-test` | takeoff-v2 | dev harness |
| `pages/dev/takeoff-v3-test.jsx` | `/dev/takeoff-v3-test` | takeoff-v3 | dev harness |
| `pages/dev/takeoff-engine-test.jsx` | `/dev/takeoff-engine-test` | `components/estimate-builder/takeoff-engine/` | the **only** entry into that tree |
| `pages/dev/takeoff-viewer-spike.jsx` | `/dev/takeoff-viewer-spike` | OpenSeadragon spike | **sole** non-legacy importer of `openseadragon` |
| `pages/dev/plan-import-test.js` | `/dev/plan-import-test` | self-contained Tesseract spike | plan-import spike |
| `pages/modules/projects/project estimate.js` | `/modules/projects/project%20estimate` | — | **byte-identical** to `pages/modules/projects/index.js`; header comment reads `// /pages/modules/projects/index.js`; untracked |

### Navigation / dashboard / page-switcher changes

**None required.** A repo-wide search for links to these routes found **zero** navigation entries,
dashboard cards, or page-switcher cases:

```
grep -rn "modules/takeoff-v2|modules/takeoff-v3|dev/takeoff" components pages lib hooks
  → components/estimate-builder/ai-takeoff/AIPlanTakeoffPage.jsx:3   (a code comment, file deleted in Batch 3)
  → components/estimate-builder/EstimateBuilderWorkbook.js:45        (the deriveJobId import, already fixed in Batch 1)
```

`components/nav-config.js` contains no takeoff entry. `pages/dev/index.js` contains no takeoff links.
The legacy engine's page-switcher case was already replaced by the new engine's in the working tree.

### Expected user-facing behaviour after Batch 2

| Before | After |
|---|---|
| `/modules/takeoff-v2` renders the v2 rebuild | **404** |
| `/modules/takeoff-v3` renders the v3 rebuild (unguarded) | **404** — closes an unguarded production route |
| `/dev/takeoff-v2-test`, `/dev/takeoff-v3-test`, `/dev/takeoff-engine-test`, `/dev/takeoff-viewer-spike`, `/dev/plan-import-test` | **404** (were behind dev login) |
| `/modules/projects/project%20estimate` | **404** — the real page remains at `/modules/projects` |
| **`/modules/estimate-builder?page=aiPlanTakeoff`** | ✅ **UNCHANGED — the new working engine** |
| Project Dashboard "AI Plan Takeoff" card | ✅ **UNCHANGED** |

**The retained route is `/modules/estimate-builder?page=aiPlanTakeoff`.** It is not touched by any
batch in this plan.

---

## Batch 3 — Remove the original takeoff implementation

**Precondition: Batch 1B complete** (`loadPdfJs` relocated), otherwise Project Estimate and Standard
Inclusions PDF import break.

### `components/estimate-builder/ai-takeoff/` — all 20 files (tracked)

```
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
components/estimate-builder/ai-takeoff/pdfPlanRendering.js          # emptied of loadPdfJs in Batch 1B
components/estimate-builder/ai-takeoff/pdfPlanRendering.test.mjs
components/estimate-builder/ai-takeoff/planCoordinateUtils.js       # last consumer removed by Batch 1B
components/estimate-builder/ai-takeoff/planCoordinateUtils.test.mjs
components/estimate-builder/ai-takeoff/takeoffTypes.js
components/estimate-builder/ai-takeoff/takeoffUtils.js
```

The directory is then empty and removed. **20 files.**

### `components/estimate-builder/takeoff-engine/` — all 36 files (tracked)

The abandoned parallel rebuild. Entry route deleted in Batch 2.

```
components/estimate-builder/takeoff-engine/analysis/{drawingBoundsAnalysis,imageOrientationAnalysis,imageTextAnalysis,titleBlockDetection}.js   (4)
components/estimate-builder/takeoff-engine/core/{geometry,measurement,orientation,scale,snapping,types,viewTransform}.js                         (7)
components/estimate-builder/takeoff-engine/import/{imageNormalizer,pdfToRaster,scaleTextDetection}.js                                            (3)
components/estimate-builder/takeoff-engine/state/{takeoffPersistence,takeoffReducer}.js                                                          (2)
components/estimate-builder/takeoff-engine/tools/{AreaTool,MeasureTool,ScaleTool}.jsx                                                            (3)
components/estimate-builder/takeoff-engine/viewer/{TakeoffCanvas,TakeoffControls,TakeoffViewer}.jsx                                              (3)
components/estimate-builder/takeoff-engine/workbook/TakeoffEngineWorkbookPage.jsx                                                                (1)
components/estimate-builder/takeoff-engine/tests/{analysis,areaTool,geometry,import,measureTool,measurement,orientation,persistence,scale,scaleTool,snapping,viewTransform,viewer}.test.mjs   (13)
```

**36 files.**

### `modules/takeoff-legacy/` — 56 of 57 files (tracked)

```
modules/takeoff-legacy/ai-takeoff/          (20 files — archive copy)
modules/takeoff-legacy/takeoff-engine/      (36 files — archive copy)
```

**Retain and relocate:** `modules/takeoff-legacy/RECOVERY.md` → `docs/takeoff-legacy-recovery.md`.
It is the only prose record of *why* the legacy engine failed (the `gr8:takeoff:v1` single-blob
design; the six-field rotation model) and the only written pointer to commit `03ba8fb` and branch
`safety/pre-takeoff-v2-20260722`. Verify both still resolve before deleting the archive:

```bash
git rev-parse safety/pre-takeoff-v2-20260722
git cat-file -t 03ba8fb
```

**Batch 3 total: 112 files deleted, 1 relocated.**

### Browser-data consequence (documented per owner decision)

Deleting `takeoffUtils.js` removes the only reader/writer of **`localStorage["gr8:takeoff:v1"]`**.

- **What is lost:** any takeoff work a user saved *only* in that browser key — full project JSON
  including plan pages as base64 data URLs — becomes permanently unreadable by the application. It
  remains physically in the user's browser until they clear site data; nothing in the app will ever
  surface it again.
- **Blast radius:** per-browser and per-device. It was never synced to Supabase — `RECOVERY.md`
  states plainly: *"No database table and no storage bucket back this feature at all."*
- **No migration code will be added**, per the owner's decision.
- **Condition attached to that decision:** it holds only because no active project/job file depends
  on the key. This was checked — `.gr8job` files persist takeoff data under
  `workbook.aiPlanTakeoffJob` / `takeoff.aiPlanTakeoffJob` (`lib/jobFile.ts:189`), a completely
  separate path from `gr8:takeoff:v1`. **If any user has unsaved legacy takeoff work that was never
  exported to a `.gr8job` file, it is lost at Batch 3.** Confirm no such user exists before executing.
- The new engine's own key space is untouched; it writes no `localStorage` at all.

---

## Batch 4 — Remove `takeoff-v2`

**Precondition: Batch 1A complete** (`deriveJobId` relocated). After that, `modules/takeoff-v2/` has
**zero** importers outside itself.

### 🔴 Irreversibility warning — 22 of 133 files are UNTRACKED

These files exist **only on disk**. They are in the working tree but were never committed, so
deleting them is **permanent** — no `git checkout`, no `git revert`, no reflog.

```
modules/takeoff-v2/components/WallSnapDebugPanel.jsx
modules/takeoff-v2/geometry/pdfTextExtraction.js
modules/takeoff-v2/takeoff/boundaryFill.js
modules/takeoff-v2/takeoff/manualGeometry.js
modules/takeoff-v2/takeoff/manualWallBand.js
modules/takeoff-v2/takeoff/roomIntrusions.js
modules/takeoff-v2/takeoff/structuralGraph.js
modules/takeoff-v2/takeoff/wallChainSnap.js
modules/takeoff-v2/takeoff/wallOpeningSpan.js
modules/takeoff-v2/takeoff/windowWorkflow.js
modules/takeoff-v2/tests/boundaryFill.test.mjs
modules/takeoff-v2/tests/detectionProvider.test.mjs
modules/takeoff-v2/tests/easywayGroundTruthComparison.mjs
modules/takeoff-v2/tests/easywayRealPlanProbe.mjs
modules/takeoff-v2/tests/easywayStructuralGraphProbe.mjs
modules/takeoff-v2/tests/fixtures/easywayPage2GroundTruth.js
modules/takeoff-v2/tests/manualGeometry.test.mjs
modules/takeoff-v2/tests/structuralGraph.test.mjs
modules/takeoff-v2/tests/wallChainSnap.test.mjs
modules/takeoff-v2/tests/wallEvidenceValidation.test.mjs
modules/takeoff-v2/tests/wallOpeningSpan.test.mjs
modules/takeoff-v2/tests/windowWorkflow.test.mjs
```

**Mandatory pre-step for Batch 4:** commit these 22 files to the safety branch first, so the
abandoned work is archived in history before removal:

```bash
git add modules/takeoff-v2
git commit -m "chore(takeoff): archive uncommitted takeoff-v2 work before removal"
```

This is not optional. Several of these — `structuralGraph.js`, `boundaryFill.js`, `windowWorkflow.js`,
`wallChainSnap.js` — represent the most recent wall-detection research in the repository (through
2026-08-18) and may be worth mining later even though the module is abandoned.

### Deletion scope

`modules/takeoff-v2/` — **all 133 files** (111 tracked + 22 untracked), including:

| Subtree | Files | Notes |
|---|---|---|
| `components/` | 15 | incl. `TakeoffV2Page.jsx` |
| `detection/` | 10 | **the wall-detection/backend experiment** — see Batch 6 |
| `docs/` | 1 | `wall-first-architecture.md` |
| `experimental/` | 1 | `hybridRasterWallDetection.js` |
| `geometry/` | 5 | |
| `hooks/` | 2 | |
| `orientation/` | 5 | |
| `persistence/` | 2 | `planStore.js` (`gr8:takeoff-v2:*` keys), `pdfFileStore.js` |
| `takeoff/` | 32 | |
| `tests/` | 47 | |
| `viewer/` | 8 | |
| `jobSummary.js`, `types.js` | 2 | `jobSummary.js` safe to delete **only after Batch 1A** |

### Supporting files

```
scripts/test-takeoff-v2-acceptance.mjs
scripts/takeoff-hybrid-raster-prototype.mjs
```

### Browser-data consequence

`localStorage` keys `gr8:takeoff-v2:documents:*`, `gr8:takeoff-v2:pages:*`,
`gr8:takeoff-v2:selectedPage:*` become orphaned. Impact is nil — the module was direct-URL-only with
"no production data" by its own route comment.

### External test fixtures — no repository impact

Two v2 test scripts read plans from the developer's machine:
`C:/Users/grant/Downloads/2 GROUND FLOOR PLAN.pdf` and
`C:/Users/grant/Downloads/SAMPLES PLANS W DIMS.pdf` (overridable via `TAKEOFF_EASYWAY_PDF` /
`TAKEOFF_SAMPLE_PLANS_PDF`). These live outside the repo; nothing to delete. Note that
`TAKEOFF_EASYWAY_PDF`, `TAKEOFF_MM_PER_UNIT` and `TAKEOFF_SAMPLE_PLANS_PDF` become dead env vars.

**Batch 4 total: 135 files.**

---

## Batch 5 — Remove `takeoff-v3`

All 18 files tracked; **zero untracked**; zero importers outside itself once its route goes in Batch 2.

```
modules/takeoff-v3/components/TakeoffV3Page.jsx
modules/takeoff-v3/core/{coordinateTransform,geometry,history,hitTesting,interactionState,scale,snapping,traceDiagnostics,types}.js   (9)
modules/takeoff-v3/persistence/planStore.js
modules/takeoff-v3/tests/{coordinateTransform,geometryEditor,interactionState,persistence,routeAndDetect,traceDiagnostics}.test.mjs   (6)
modules/takeoff-v3/tests/run-all.mjs
```

Supporting file:

```
scripts/test-takeoff-v3-acceptance.mjs
```

Browser-data consequence: `gr8:takeoff-v3:*` keys orphaned; no production data.

After Batches 4 and 5 the `modules/` directory retains only
`modules/website-builder/{blocks/accordion/AccordionBlock.js, utils/inlineHtml.js}`.

**Batch 5 total: 19 files.**

---

## Batch 6 — Remove abandoned backend / API experiments

### `pages/api/ai/plan-detect.js` — 1 file

GPT-4o vision plan detection (`process.env.OPENAI_API_KEY`, `model: "gpt-4o"`).

**Internal caller census — searched source, configuration, documentation and deployment files:**

| Surface searched | Result |
|---|---|
| Source (`*.js/jsx/ts/tsx/mjs`) | `components/estimate-builder/ai-takeoff/aiDetectionService.js:2,12` (Batch 3) and its archive copy `modules/takeoff-legacy/ai-takeoff/aiDetectionService.js` (Batch 3). **No other caller.** |
| The new engine | **Does not call it** — issues no `fetch` at all |
| Config (`*.json`, `*.yml`, `*.yaml`, `*.toml`, `*.cjs`, `*.mjs`) | No reference |
| Deployment (`vercel.json`, `.vercelignore`, `docker-compose*.yml`, `ecosystem.config.cjs`, `middleware.js`) | No reference |
| `n8n-automation/` | Contains only `docker-compose.yml` — no workflow definitions, no reference |
| Documentation | `ESTIMATE_BUILDER_ARCHITECTURE.md:27,81,109,115,155` describes it as *"working"* and *"Reusable"*, and `modules/takeoff-legacy/RECOVERY.md:38` mentions it — **all describing the legacy engine** |

**Statement required by the brief:** no internal consumer will remain after Batch 3, and no
configuration, documentation or deployment file registers an external consumer. **External callers
cannot be disproved from repository evidence alone** — an outside system could POST to this endpoint
without leaving any trace in this repository. Per the owner's decision that the earlier backend
experiment is abandoned, it is classified for removal. If any external integration is known to exist,
say so before Batch 6 executes.

**Related stale documentation finding:** `ESTIMATE_BUILDER_ARCHITECTURE.md` also documents
`/api/ai/plan-orientation` as a *"working AI endpoint"*. **That route does not exist** —
`pages/api/ai/plan-orientation.js` is absent. The document describes a system already partly deleted.
Handled in Batch 7.

### The wall-detection / third-party backend experiment

Contained entirely within `modules/takeoff-v2/detection/` (deleted in Batch 4) — **10 files**:

```
modules/takeoff-v2/detection/{gr8Geometry,index,kreoProvider,localQuarantinedProvider,
  normalisedGeometry,provider,semanticSegmentation,semanticWallGraph,
  wallMaskVectorisation,wallPreprocessing}.js
```

`kreoProvider.js:5` calls the third-party **Kreo** service at
`https://takeoff.kreo.net/api/ai-search/v1/takeoff2D` with an `apiKey` constructor argument. No
`process.env` binding for that key exists in the repository and no `.env.example` entry references
Kreo, so removal has no environment impact. It is **not** a self-hosted backend and there is nothing
to decommission beyond deleting the client.

### Python / model artefacts — none belong to takeoff

| Path | Verdict |
|---|---|
| `transcribe-local/server.py`, `transcribe-local/Dockerfile` | **RETAIN** — a faster-whisper audio transcription server. Unrelated to takeoff. |
| `eng.traineddata` (5.2 MB, untracked) | **RETAIN** — Tesseract English model. Used by `pages/dev/plan-import-test.js` (Batch 2) **and by `lib/freedom/tradeImport.js`, an active Freedom module.** |

No `.py`, `.ipynb`, `.onnx`, `.pt`, `.pth`, `.h5`, `.pb` or `.tflite` file anywhere in the repository
belongs to a takeoff implementation. There is no `requirements.txt`, `environment.yml`, `Pipfile` or
`pyproject.toml` — there is no Python detection backend to remove.

### Assets, styles, fixtures

**None exist.** `grep -rln "takeoff" styles/` → empty. `find public -iname '*takeoff*'` → empty. All
takeoff test fixtures live inside the module trees already scheduled for deletion.

**Batch 6 total: 1 file** (`pages/api/ai/plan-detect.js`). The 10 detection files are counted in
Batch 4.

---

## Batch 7 — Remove obsolete dependencies and configuration

### `package.json` — scripts to remove (3)

```json
"test:takeoff-v2": "node modules/takeoff-v2/tests/rotation.test.mjs && …"
"test:takeoff-v3": "node modules/takeoff-v3/tests/run-all.mjs"
"test:takeoff-v2-acceptance": "node scripts/test-takeoff-v2-acceptance.mjs"
```

### `package.json` — script to ADD (1)

```json
"test:ai-plan-takeoff": "node scripts/test-ai-plan-takeoff-integration.mjs"
```

The live engine's only regression test is currently unregistered while three obsolete ones are. This
must be corrected — ideally in Batch 1, not left to the end.

### `package.json` — dependency to remove (1)

| Package | Verdict | Evidence |
|---|---|---|
| **`openseadragon@^6.0.2`** | **REMOVE** | Every importer is deleted by this plan: `components/estimate-builder/takeoff-engine/viewer/TakeoffCanvas.jsx:45` (Batch 3), `pages/dev/takeoff-viewer-spike.jsx:63` (Batch 2), `components/estimate-builder/takeoff-engine/tests/viewer.test.mjs:44` (Batch 3), plus archive copies (Batch 3). **No retained source uses it.** |

### Dependencies to KEEP — explicitly verified

| Package | Why it stays |
|---|---|
| `react-konva@18.2.16` | The new engine's canvas layer |
| `pdfjs-dist@^6.1.200` | The new engine's PDF parsing |
| `lucide-react@^0.545.0` | Used platform-wide |
| `tesseract.js@^7.0.0` | Retained by `lib/freedom/tradeImport.js` (active Freedom module) |
| `jszip@^3.10.1` | `lib/jobFile.ts` master `.gr8job` ZIP container |
| `fabric@^5.5.2` | Workbook document editing |
| `sharp@^0.35.3` | Image processing elsewhere |

### ⚠️ Dependency gap to fix (an addition, not a removal)

**`konva` is not a direct dependency.** `react-konva@18.2.16` requires it as a peer, and
`konva@9.3.6` is present in `node_modules` only by transitive/peer auto-install. The new engine's
canvas therefore depends on a package that `package.json` never declares — fragile under `npm ci`,
lockfile regeneration, or a dedupe change.

**Recommended:** add `"konva": "^9.3.6"` to `dependencies`. Flagged rather than done, since the brief
scopes Batch 7 to removals.

### `.claude/settings.json` — 3 permission entries to remove

```
"Bash(node modules/takeoff-v2/tests/rotation.test.mjs)"
"Bash(node modules/takeoff-v2/tests/coordinateTransform.test.mjs)"
"Bash(node modules/takeoff-v2/tests/planStore.test.mjs)"
```

### Environment documentation

No `.env.example` entry references takeoff, Kreo or PDF. Three env vars become dead but are
undocumented and need no file change: `TAKEOFF_EASYWAY_PDF`, `TAKEOFF_MM_PER_UNIT`,
`TAKEOFF_SAMPLE_PLANS_PDF`. Two debug flags also die with takeoff-v2:
`NEXT_PUBLIC_TAKEOFF_GEOMETRY_DEBUG`, `NEXT_PUBLIC_TAKEOFF_ALLOW_STORED_STRUCTURAL_DEBUG`,
`NEXT_PUBLIC_TAKEOFF_AUTO_ENRICH_WALL_BANDS`.

### Documentation to update (not delete)

| File | Action |
|---|---|
| `ESTIMATE_BUILDER_ARCHITECTURE.md` | Rewrite the takeoff sections (`:14-15`, `:27`, `:81`, `:109`, `:115`, `:138`, `:155`). It documents the deleted `ai-takeoff/` engine and a `/api/ai/plan-orientation` route **that does not exist**. |
| `docs/MODULE_ARCHITECTURE_AUDIT.md`, `docs/MODULE_MIGRATION_PLAN.md` | Add a note that the takeoff sections are superseded by this plan |
| `TAKEOFF_ENGINE_ARCHITECTURE.md` | **Owner decision needed.** It is the "master rulebook" for the takeoff-v2/v3 rebuild programme that is now being deleted. Retain as design philosophy, or archive? |
| `docs/manual-pdf-rotation-audit.md`, `docs/takeoff-regression-restoration-audit.md`, `docs/dev-plan-import-test-audit.md` | **Owner decision needed.** Historical audits of removed code. Retain as history, or fold into `docs/takeoff-legacy-recovery.md`? |
| `modules/takeoff-legacy/RECOVERY.md` | Relocate to `docs/takeoff-legacy-recovery.md` (Batch 3) |
| `REPOSITORY_MODULE_AND_TAKEOFF_AUDIT.md` | Append a completion record |

**Batch 7 total: 1 dependency, 3 scripts, 3 settings entries, 1 script added, ~6 docs updated.**

---

## Batch 8 — Verification

Run **after every batch**, not only at the end. A batch is not complete until its section passes.

### 8.1 Automated — must all pass

```bash
node scripts/test-ai-plan-takeoff-integration.mjs   # THE critical one
node scripts/test-master-gr8job-package.mjs
node scripts/test-pdfjs-loader.mjs                  # new in Batch 1
node scripts/test-job-id-derivation.mjs             # new in Batch 1
npm run test:project-estimate-pdf-importer          # guards the loadPdfJs path
npm run test:project-estimate-builder-shell
npm run test:estimate-workbook-sheet-tabs
npm run test:standard-inclusions-management
npm run test:standard-inclusions-onlyoffice
npm run test:final-quotation-boq-filter
npm run lint
npm run typecheck
```

### 8.2 Broken-import and dead-route sweep

```bash
# No reference may survive to any deleted path
grep -rn "ai-takeoff/"        components pages lib hooks modules scripts   # expect: none
grep -rn "takeoff-engine/"    components pages lib hooks modules scripts   # expect: none
grep -rn "takeoff-legacy"     components pages lib hooks modules scripts   # expect: none
grep -rn "takeoff-v2"         components pages lib hooks modules scripts .claude package.json  # expect: none
grep -rn "takeoff-v3"         components pages lib hooks modules scripts .claude package.json  # expect: none
grep -rn "plan-detect"        components pages lib hooks modules scripts   # expect: none
grep -rn "openseadragon"      components pages lib modules scripts package.json  # expect: none

# The retained engine and relocated shared code must be intact
ls components/construction-estimation/ai-plan-takeoff/   # expect exactly 7 files
grep -rn "construction-estimation/ai-plan-takeoff" components pages hooks scripts  # expect 3 importers
grep -n "loadPdfJs"  components/estimate-builder/EstimateBuilderWorkbook.js  # 1 import + 8 call sites
grep -n "deriveJobId" components/estimate-builder/EstimateBuilderWorkbook.js # 1 import + 1 call site
ls lib/pdf/pdfjsLoader.js
```

### 8.3 Production build

```bash
npm run build
```

Safe in this environment — `scripts/run-next-clean.mjs` wraps it and writes to `.next-build/`, which
is gitignored and separate from the dev output. Compare warning/error counts against the pre-Batch-1
baseline. **This does not start a dev server.**

### 8.4 Route verification

| Route | Expected |
|---|---|
| **`/modules/estimate-builder?page=aiPlanTakeoff`** | ✅ **200 — the working engine renders** |
| `/modules/estimate-builder?page=projectDashboard` | ✅ 200, "AI Plan Takeoff" card present and clickable |
| `/modules/estimate-builder` | ✅ 200 |
| `/modules/builders/boq`, `/modules/jobboard`, `/modules/projects` | ✅ 200 |
| `/modules/takeoff-v2`, `/modules/takeoff-v3` | 404 |
| `/dev/takeoff-v2-test`, `/dev/takeoff-v3-test`, `/dev/takeoff-engine-test`, `/dev/takeoff-viewer-spike`, `/dev/plan-import-test` | 404 |
| `/modules/projects/project%20estimate` | 404 |
| `POST /api/ai/plan-detect` | 404 |

### 8.5 Manual functional regression — the new engine

**Rendering is not success.** The save/reopen path has already been unreliable once (the
`gr8:takeoff:v1` single-blob overwrite documented in `RECOVERY.md`), so steps 8–12 are the real test.

| # | Step | Pass criterion |
|---|---|---|
| 1 | Open `/modules/estimate-builder?page=aiPlanTakeoff` | Engine renders, no console errors |
| 2 | **Plan import** — upload a multi-page PDF | All pages render; page navigation works; sharp at zoom |
| 3 | Rotate the plan | Rotation persists across page changes and tool switches |
| 4 | **Calibration** — two-point scale | `pixelsPerMm` correct; a known dimension measures correctly |
| 5 | **Editing** — draw exterior + interior wall runs | Lengths and thicknesses correct; snapping works |
| 6 | Place window and door openings | Correctly positioned and counted |
| 7 | Trace a floorplan footprint | m² area matches expectation |
| 8 | **Floor-covering changes** — add Tiles / Carpet / Hybrid areas, then **edit and delete** one | Totals recalculate; the deleted area does **not** reappear |
| 9 | **Save Progress** (`onSaveToPlatform`) | Success message; revision increments; no error |
| 10 | **Reload the browser, reopen the takeoff page** | ⚠️ **CRITICAL** — all geometry, openings, floor coverings, eaves and embedded plan pages return exactly as saved. Nothing lost, nothing resurrected. |
| 11 | **Save to Computer** — `.gr8job` via `showSaveFilePicker` | File writes |
| 12 | **Reopen the saved job** from disk | ⚠️ **CRITICAL** — takeoff restores fully; `verifyAiPlanTakeoffSavedJob` reports no mismatch |
| 13 | Portable export/import (`.gr8takeoff`) | Round-trips |
| 14 | Schedule panel; CSV and Excel-XML export | Totals match drawn geometry |
| 15 | Push to Job Setup | `projectName`, `projectAddress`, `lowerFloorAreaM2`, `lowerExternalWallsLm`, `lowerInternalWallsLm` update on Job Details |
| 16 | Push to quote sheet | Quantities update; **rates and formulas preserved** |
| 17 | Back to Dashboard | Returns to project dashboard |

**Repeat steps 9–12 twice in one session** — the legacy failure mode was saved state overwriting live
state on the *second* save, not the first.

### 8.6 Manual regression — the shared PDF path (highest-risk collateral)

| # | Step | Pass criterion |
|---|---|---|
| 18 | **Project Estimate → import a PDF** | Pages render — exercises relocated `loadPdfJs` |
| 19 | **Standard Inclusions → import a PDF** | Hybrid page model builds |
| 20 | Quote proposal → import a PDF document | Renders |
| 21 | Project Estimate → PDF page revisions / version history | Intact |

### 8.7 Final git state

```bash
git status --short
git diff --stat HEAD~1
git log --oneline safety/pre-takeoff-cleanup-2026-09-01 ^81c5613
git rev-parse production/website-builder-20260808   # must still be 81c5613 — untouched
```

Expected: the owner's 25 staged deletions and 56 unstaged deletions still present and unmodified; no
unintended files added; nothing pushed.

### 8.8 Rollback

```bash
git revert <batch-commit>                                   # any single batch
git checkout a50f14b -- components/construction-estimation/ai-plan-takeoff/   # restore the engine
git reset --hard a50f14b                                    # ONLY with explicit owner approval
```

Every batch is one revertible commit. No database, storage or deployment change is involved, so
rollback is purely a git operation.

---

## Deletion totals

| Batch | Scope | Files |
|---|---|---|
| 0 | Safety checkpoint | 0 deleted (31 protected) |
| 1 | Shared-code extraction | 0 deleted (2 moved, 1 created, ~2 tests added) |
| 2 | Routes and navigation | **8** |
| 3 | Original implementation + rebuild attempt + archive | **112** (+1 relocated) |
| 4 | takeoff-v2 | **135** |
| 5 | takeoff-v3 | **19** |
| 6 | Backend / API experiment | **1** |
| 7 | Dependencies and configuration | 0 files (1 dep, 3 scripts, 3 settings entries) |
| **Total** | | **275 files** |

Retained throughout: the 7 new-engine files (including `OpeningsModal.jsx` and `wallUtils.js` per the
owner's decision), `lib/pdf/pdfjsLoader.js`, `deriveJobId` in `lib/jobFile.ts`,
`scripts/test-ai-plan-takeoff-integration.mjs`, `eng.traineddata`, `transcribe-local/`, and
`docs/takeoff-legacy-recovery.md`.

---

## Items still requiring an owner decision

| # | Item | Why it cannot be settled from repository evidence |
|---|---|---|
| 1 | External callers of `/api/ai/plan-detect` | An outside system could call it without leaving a repository trace. Classified for removal per the owner's abandonment decision, but this cannot be *proved* internally. |
| 2 | Users holding unsaved work in `localStorage["gr8:takeoff:v1"]` | Not observable from the repository. Batch 3 makes it permanently unreadable. |
| 3 | Fate of `TAKEOFF_ENGINE_ARCHITECTURE.md` | It is the rulebook for the rebuild programme being deleted — retain as philosophy or archive? |
| 4 | Fate of the three legacy audit docs in `docs/` | Historical value versus clutter |
| 5 | Archiving the 22 untracked takeoff-v2 files before deletion | Recommended (Batch 4 pre-step); needs the owner's go-ahead since it commits abandoned work |
| 6 | Adding `konva` as an explicit dependency | An addition, outside the removal-only scope of Batch 7 |
| 7 | `.env.example` on disk contains what looks like a **live OpenAI key** at line 122 | **Not a repository leak** — the file is gitignored (`.gitignore:40`) and untracked, so it was never committed and is not in the checkpoint. But a real key sitting in a file conventionally used for placeholders is worth rotating and replacing with a placeholder. |

---

## Execution order summary

```
Batch 0  ✅ DONE   safety checkpoint            a50f14b
Batch 1  ⏸ WAIT   extract deriveJobId + loadPdfJs, add tests, register test:ai-plan-takeoff
Batch 2  ⏸ WAIT   remove 8 route files
Batch 3  ⏸ WAIT   remove 112 files (ai-takeoff, takeoff-engine, takeoff-legacy) + relocate RECOVERY.md
Batch 4  ⏸ WAIT   archive 22 untracked files, then remove 135 (takeoff-v2)
Batch 5  ⏸ WAIT   remove 19 (takeoff-v3)
Batch 6  ⏸ WAIT   remove 1 (plan-detect API)
Batch 7  ⏸ WAIT   remove openseadragon + 3 scripts + 3 settings entries; update docs
Batch 8  ⏸ WAIT   verification (run after EVERY batch, not only at the end)
```

**Nothing beyond Batch 0 has been executed. No legacy file has been deleted. Nothing was pushed.**
