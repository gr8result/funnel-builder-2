# Large-file cleanup — Phase 1 (10,000+ line tracked files) — 2026-09-19

Source inventory: [complete-file-inventory-2026-09-18.csv](complete-file-inventory-2026-09-18.csv).
This phase covers every currently existing Git-tracked text file with 10,000+ lines. `package-lock.json` (19,185 lines) is excluded per instruction — it is a generated dependency lock, not an architecture target.

## Result: 0 of 14 files were safely actionable today

Every one of the 14 target files is currently **BLOCKED BY ACTIVE WORK**. This is not a default/cautious guess — it is confirmed by three independent, fresh signals gathered before touching anything:

1. **`ListAgents` shows 5 other interactive Claude sessions currently running against this exact repository** — one started 17 hours ago, four started 2 days ago. The 2-day-old sessions align exactly with the timestamps on the pre-existing `2026-09-16-*` cleanup reports in this same folder, which already investigated this identical file list and reached the identical blocked conclusion.
2. **7 of the 14 files are directly modified in the working tree right now** (`git status`), and one of them — `pages/modules/builders/selections-book.js` — had a filesystem mtime only **15 seconds** before it was checked, i.e. it was being written to at the moment of inspection.
3. **The other 7 files are git-clean themselves, but every one of them is read through a shared consumer layer that is itself actively modified right now**: `lib/product-library/catalogueService.js`, `lib/product-library/catalogueModel.js`, `hooks/estimate-builder/useEstimateBuilderWorkbook.js`, `lib/construction-estimation/estimateBuilderWorkbookCalculations.js`, `estimateBuilderWorkbookDefaults.js`, `inputDataSheetTemplate.js/.json`, `lib/builders/clientSelectionWorkflow.js`, `lib/builders/applianceClientSelectionFlow.js`, `pages/modules/builders/product-library.js`, and `pages/modules/builders/client-selections.js` are all currently modified. Re-partitioning a clean data file that a mid-edit reader depends on risks colliding with in-flight code, so these are blocked too, exactly as the 2026-09-16 reports already concluded.

This matches the pre-existing investigation almost exactly: `docs/reports/repository-cleanup/2026-09-16-remaining.md` already lists all 14 of these same files as `BLOCKED BY ACTIVE WORK` two days ago, with the same dependency reasoning. Nothing has been released or committed since. No file was modified, moved, deleted, restored, or reset in this phase — this is a re-verification of an existing freeze, not a new finding created by inaction.

## Classification table

| Original file | Original lines | Classification | New structure | Largest resulting file | Validation | Status |
|---|---:|---|---|---|---|---|
| `data/product-library/source-evidence/internal-finishing/corinthian-media.json` | 133,097 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git status: modified today; diff is +71,897/-0 lines (pure growth vs HEAD) — an active media-import job is mid-run | BLOCKED |
| `data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json` | 109,563 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git status: modified (+17,845/-…); depends on active `catalogueService.js`/`catalogueModel.js` | BLOCKED |
| `lib/construction-estimation/importedExcelWorkbookTemplate.json` | 97,096 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git-clean, but `hooks/estimate-builder/useEstimateBuilderWorkbook.js` (its reader) is modified right now | BLOCKED |
| `data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json` | 68,596 (on disk now; diff shows +67,368/-… vs HEAD) | DECOMPOSE DATA BY DOMAIN (deferred) | Full architecture already designed — see `2026-09-16-appliance-plan.md` (brand→category tree, lossless-reconciliation gate, writer/reader migration list) | — | git status: modified this morning; explicitly the subject of the existing appliance-plan freeze | BLOCKED |
| `lib/construction-estimation/windowsDoorsWorkbookRows.json` | 22,495 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git-clean, but workbook reader layer (`useEstimateBuilderWorkbook.js`, workbook calc/defaults files) is modified | BLOCKED |
| `data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json` | 21,681 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git status: modified (+13,160/-…); depends on active catalogue service layer | BLOCKED |
| `data/product-library/catalogues/exterior/AU-ENTRY-DOOR-FURNITURE-CATALOGUE.json` | 20,814 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git-clean, but catalogue service/model layer is modified | BLOCKED |
| `components/estimate-builder/EstimateBuilderWorkbook.js` | 19,622 | DECOMPOSE SOURCE (deferred) | Page registry / sheet components / persistence / hooks split, per existing ownership plan | — | git status: modified (+193/- lines); active Job/workbook/Takeoff persistence work in progress | BLOCKED |
| `package-lock.json` | 19,185 | GENERATED / LEAVE ALONE | — | — | Excluded per instruction — generated dependency lock | LEAVE AS GENERATED |
| `data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json` | 17,450 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git status: modified (+471/-…); catalogue service dependency | BLOCKED |
| `pages/modules/builders/selections-book.js` | 17,122 | DECOMPOSE SOURCE (deferred) | Category screens / selection hooks / persistence / export services split, per existing ownership plan | — | git status: modified; filesystem mtime 15 seconds before inspection — **actively being written right now** | BLOCKED |
| `data/product-library/catalogues/roofing/AU-BRISTILE-ROOF-TILES-CATALOGUE.json` | 16,978 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git-clean, but catalogue service/model layer is modified | BLOCKED |
| `data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json` | 12,124 | DECOMPOSE DATA BY DOMAIN (deferred) | — | — | git-clean, but catalogue service/model layer is modified | BLOCKED |
| `data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.js` | 10,712 | DUPLICATE REPRESENTATION — INVESTIGATED, RESOLVED (no action needed); decomposition itself deferred | See investigation below | — | git-clean, but catalogue service/model layer is modified | BLOCKED (decomposition); investigation complete |
| `data/product-library/catalogues/cabinetry/AU-POLYTEC-CABINETRY-COLOURS.json` | 10,712 | DUPLICATE REPRESENTATION — INVESTIGATED, RESOLVED (no action needed) | See investigation below | — | See below | BLOCKED (decomposition); investigation complete |

## Duplicate-representation investigation: `AU-POLYTEC-CABINETRY-COLOURS.js` vs `.json`

This was safe to investigate (read-only) even under the freeze, and is fully resolved:

- Both files are **byte-identical in content** (parsed and compared: 306 records each, `JSON.stringify` equal).
- Both are written **together, atomically, by the same generator**: `scripts/sync-polytec-cabinetry-catalogue.mjs:275-276` fetches the live Polytec colour-matrix pages and writes `AU-POLYTEC-CABINETRY-COLOURS.json` and `AU-POLYTEC-CABINETRY-COLOURS.js` (an `export default [...]` wrapper around the same array) from the same in-memory `uniqueRecords` value in the same run.
- The runtime selector, `lib/product-library/cabinetryCatalogueSelectors.js:2`, imports the **`.js`** file as an ES module (needed for webpack/browser bundling — JSON can't be a default-export ESM import without a loader).
- The **`.json`** file is read by Node tooling directly via `fs` in `scripts/test-polytec-cabinetry-catalogue.mjs:13` (cheaper than an ESM import for a script) and by the generator's own round-trip validation.
- `scripts/test-polytec-cabinetry-catalogue.mjs:82` **already asserts** that the selector must keep importing the `.js` file — this pairing is an intentional, tested contract, not an oversight.

**Verdict: both representations are genuinely required. This is not duplication to eliminate — it is one generated dataset published in two formats for two different consumers (browser-bundled ESM vs. Node tooling).** No consumer migration, no deletion, no action needed. The same generated-pair pattern almost certainly applies to the other `.js`/`.json` catalogue pairs noted in the inventory (`AU-STONE-BENCHTOP-CATALOGUE`, `AU-LAMINEX-CABINETRY-COLOURS`), but those weren't individually re-verified today since they sit outside the 10,000+ band.

## What remains before the 5,000–9,999 group

Spot-checked ahead of time so the next phase isn't a surprise:

- `components/construction-estimation/ai-plan-takeoff/AIPlanTakeoffStandalone.jsx` (5,629) and its dependency `takeoffSchedule.js` are **both directly modified right now** → will be BLOCKED.
- `data/product-library/catalogues/roofing/AU-MONIER-ROOF-TILES-CATALOGUE.json` (8,977) is git-clean but sits behind the same dirty `catalogueService.js`/`catalogueModel.js` layer → will be BLOCKED.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js` (8,288) is **directly modified right now** → BLOCKED.
- `data/product-library/catalogues/benchtops/AU-STONE-BENCHTOP-CATALOGUE.js`/`.json` (6,256/6,254) — same catalogue-service dependency → will be BLOCKED, and is the same generated-pair pattern as Polytec above.
- `data/website-builder-defaults.json` (8,921) and its consumer `lib/website-builder/projectStore.js` are git-clean today (this has changed since the 2026-09-16 report, which flagged it for a different reason: it's a **live runtime read/write target** — an API route persists to this exact path at request time, independent of git state). This one needs an actual read of the API route before Phase 2, not just a git-status check, since a naive split could break a live write path even with no other session mid-edit.

## Recommendation

I'm stopping here rather than guessing past this. Every file in the requested 10,000+ group is currently gated by real, concurrently-running work — this isn't a policy default, it's re-confirmed with fresh evidence (git status, diff, mtimes, and 5 live peer sessions). Options:

1. **Wait** — revisit once the other sessions commit or the working tree quiets down, then resume Phase 1 for real.
2. **You confirm scope** — if some of the "active work" is actually your own abandoned/stale edits (not another session's live task), tell me which files are safe to treat as if clean, and I'll proceed on those specifically.
3. **Redirect to unblocked work** — the 2,000–4,999 inspection band and the website-builder/email/Gantt files noted as "Clean at audit" in the 2026-09-16 reports may have smaller, genuinely independent opportunities outside this cluster; I can scope that instead while the product-library/estimate-builder freeze is in effect.

No files were split, moved, deleted, or modified in this phase. No commit, push, merge, or deploy was performed.

---

## Interim work while Phase 1 stays frozen (Option 3) — 2026-09-19

Per instruction, Phase 1 (the 14 files above) remains untouched and frozen. This section tracks independent, unblocked cleanup done in the meantime in the website-builder/email/Gantt/CRM area. `ListAgents` was re-checked before and during this work; the same 5 peer sessions are still active, so this is time-boxed, low-risk work only — not a start of Phase 1.

### Completed: `data/website-builder-defaults.json` (8,921 lines → sharded by page)

| Original file | Original lines | Classification | New structure | Largest resulting file | Validation | Status |
|---|---:|---|---|---|---|---|
| `data/website-builder-defaults.json` | 8,921 | DECOMPOSE DATA BY DOMAIN | See tree below | `pages/home.json` (69,667 bytes / ~1,850 lines) | See below | COMPLETE |

**Why this one was genuinely safe:** git-clean, no fresh activity (mtime unrelated to the 00:17 repo-wide event also seen on `package.json`/`README.md`, which was ruled a bulk git operation, not live editing — confirmed by checking control files outside the website-builder area). Its only two real runtime consumers (`pages/api/website-builder/defaults.js`, `lib/sharedMediaLibrary.js`) and two script consumers were both clean or carrying only the already-known, already-documented Sept-16 leftover diff (verified by diff size matching the documented batch numbers exactly).

**Structure found:** the file had exactly one `templateOverrides` entry (`business-solution-template`) containing 12 pages (335,590 bytes) plus 11 `blockDefaults` entries (21,981 bytes) — a real per-page domain boundary already existed inside the data (`pageBlocks[pageName]`), the same pattern used elsewhere in this codebase (brand→category).

```text
data/website-builder-defaults/
  index.js                                   # Node aggregator: read + per-page/per-blockType writes
  template-slugs.json                         # ordered manifest: ["business-solution-template"]
  block-defaults.json                         # 11 block-type entries, unchanged content
  template-overrides/
    business-solution-template/
      meta.json                               # updatedAt, globalNavBlock, globalFooterBlock
      page-order.json                         # ordered [{pageName, file}] manifest — preserves exact key order
      pages/
        home.json, project-hub.json, email.json, social-media.json, funnels.json,
        pricing.json, crm.json, website-builder.json, contact-us.json, modules.json,
        about-us.json, sms.json                # 12 files, 6,558–69,667 bytes each
```

**Consumers migrated (4, all found by grepping every source directory for the literal filename):**
- `pages/api/website-builder/defaults.js` — read/write API; `save-template-page`, `save-template-site`, `save-block-default` actions now call the aggregator instead of read-modify-write on one file.
- `lib/sharedMediaLibrary.js` — `listWebsiteBuilderTemplateReferencedImages()`; switched to the aggregator. The `stableId`/`storage_path` seed string was deliberately kept as the original absolute file path (not the new directory) to avoid silently changing every image ID this function has ever produced.
- `scripts/test-website-footer-navigation-regression.mjs` — switched its `fs.readFileSync` to the aggregator.
- `scripts/create-test-page.cjs` (CommonJS) — switched to a dynamic `import()` of the ESM aggregator; preserved its shallow-merge-onto-existing-block-defaults behavior exactly (the aggregator's `saveBlockDefault` does a full replace, so the merge is now done at the call site before calling it, matching the original semantics).

**Validation performed:**
- Full deep-equality reconstruction: original file vs. aggregator output — 0 diffs, including exact object key order, run twice (immediately after migration and again after the round-trip test below), plus explicit page-count (12=12), block-count (132=132), and block-default-key checks.
- `node --check` on all 4 edited/created files.
- End-to-end round-trip test calling the exact functions the API route calls: added a throwaway page via `saveTemplatePage`, confirmed it read back correctly and every pre-existing page was untouched; added a throwaway block-default via `saveBlockDefault`, confirmed existing entries were untouched; then reverted every touched file to its exact pre-test bytes and re-ran the full deep-equality check to confirm the data was restored byte-for-byte.
- `scripts/test-website-footer-navigation-regression.mjs` run before and after migration: identical pre-existing failure both times (a `#blog` vs `/blog` href mismatch already documented in the 2026-09-16 audit as unrelated to this work) — proves zero regression, and the pre-existing failure was left untouched, not repaired.
- Not done: a live authenticated HTTP round-trip against the Next.js route (it's behind `withAuth`, and standing up a dev server risked port/build-cache contention with the 5 other live sessions). The function-level round-trip above exercises the identical code the route calls, which was judged a reasonable substitute given that constraint.

**Files created:** `data/website-builder-defaults/index.js`, `template-slugs.json`, `block-defaults.json`, `template-overrides/business-solution-template/{meta.json,page-order.json}`, 12 files under `template-overrides/business-solution-template/pages/`.
**Files removed:** `data/website-builder-defaults.json` (only after all 4 consumers were migrated and verified, and a final grep confirmed no remaining reference to the literal filename anywhere in `lib/pages/components/hooks/modules/scripts/utils/services/context/platform-core/test`).
**Consumers migrated:** 4 (listed above).

### Investigated and left alone, with reasons (not blocked by git status — blocked by genuine architecture)

Per policy ("2,000–4,999: refactor only for a genuine architectural reason... do not split files mechanically just to meet a line count"), each of these was actually read, not just carried forward from the old report:

| File | Lines | Finding | Decision |
|---|---:|---|---|
| `components/gantt/GanttPageLayout.js` | 2,558 | One `GanttPageLayout()` component. Lines 1–1,317 are ~30 helper functions, but nearly all close over component state/refs (drag handlers, task CRUD, CSV import/export, delay tracking, localStorage read/write keyed by `user`) — no clean seam. JSX render body is lines 1,318–2,558. | DEFER — no genuine architectural reason found; a forced split would risk drag/CSV/modal behavior with no way to browser-test it safely alongside 5 other live sessions. |
| `components/crm/LeadDetailsModal.js` | 3,705 | Only lines 23–105 (~82 lines: `LEAD_SOURCE_OPTIONS`, `DEFAULT_QUOTE_TEMPLATES`, `QUOTE_LAYOUT_OPTIONS`) are pure module-scope data; the remaining ~3,600 lines are one `LeadDetailsModal()` component wiring call-recording playback, a dialer, and quote building together. | DEFER — the only clean extraction candidate is too small to be a real architectural win, and policy says not to split just to move the number. |
| `pages/modules/website-builder/visual-builder.js` | 4,692 | Lines 46–867 (~820 lines) are pure, non-closure, module-scope helper functions — genuinely and mechanically safe to move on their own. But their names are the tell: `buildCanonicalSubmittedPageBlocksForSave`, `buildDeletedBlockTombstones`, `filterDeletedBlocks`, `shouldUseEmergencyDraft`, `applyEmergencyDraftToProject`, `isPersistenceDiagnosticPage` — this **is** the website-project save/autosave/recovery logic itself, which is exactly why the 2026-09-16 audit blocked this file (for architectural reasons, not git status). | LEFT ALONE — treating "website project save/load/recovery" as one of the "currently active shared consumer layers" the instruction named, regardless of today's clean git status. Moving pure functions would probably work, but the domain is production persistence and the risk/reward doesn't clear the bar here. |
| `components/website-builder/PageBuilderCanvas.js` | 4,080 | Same shape: `stableCanvasJson`, `canvasBlocksHash`, preview-snapshot/slug helpers at module scope — same save/preview/persistence domain. | LEFT ALONE, same reasoning as above. |
| `lib/website-builder/templateBlueprints.js` | 2,899 | Consumed by `lib/website-builder/projectStore.js`, the main website-project persistence layer. | LEFT ALONE — same reasoning; not re-litigated file-by-file since the dependency is the same core persistence layer. |

No files were touched for any of the five above — this is a documented "looked and declined," not a skip.

### Completed: `pages/modules/email/crm/pipelines/index.js` (2,466 lines → 1,536)

The 2026-09-16 audit's verdict on this file ("RETAIN this batch: cohesive pipeline page; storage, save-as and database loading enter frozen responsibilities") was about NOT touching the main `Pipelines()` component's state/persistence — it wasn't a claim that nothing in the file could move. Re-reading it found four components already declared as standalone, top-level, prop-only functions (not closures over `Pipelines()`'s state): `StageColumn`, `LeadCard`, `TeamManagerModal`, `StageEditor`, plus a ~500-line `styles` object they all share. That's a genuine, safe, zero-behavior-risk boundary — the same kind of move already proven safe in the Sept-16 website-builder batch.

| Original file | Original lines | Classification | New structure | Largest resulting file | Validation | Status |
|---|---:|---|---|---|---|---|
| `pages/modules/email/crm/pipelines/index.js` | 2,466 | DECOMPOSE SOURCE | See tree below | `pipelineStyles.js` (502 lines) | See below | COMPLETE |

```text
pages/modules/email/crm/pipelines/
  index.js                    # 1,536 lines: Pipelines() page + its own-only helpers (getInitials, getLeadCrmMeta, readLocalDelays/Contracts keys, DEFAULT_STAGES)
  pipelineStyles.js           # 502 lines: the shared `styles` object, unchanged content, now a single export
  pipelineSharedHelpers.js    # 33 lines: parseList, formatMoney, buildDefaultTeams (used by index.js AND the split-out components)
  LeadCard.js                 # 160 lines: LeadCard component + its private getCardVisualStyles helper (confirmed used nowhere else)
  StageColumn.js              # 77 lines: StageColumn component (renders LeadCard)
  TeamManagerModal.js         # 92 lines: TeamManagerModal component
  StageEditor.js              # 69 lines: StageEditor component
```

Total across all 7 files: 2,469 lines vs. 2,466 original — the +3 is exactly the added `export`/`import` boilerplate; nothing was duplicated or dropped.

**How dependencies were mapped before moving anything:** grep counts of every helper/constant/import inside vs. outside the `Pipelines()` function body (lines 170–1603) to determine what's genuinely shared vs. exclusive to one side — e.g. `getCardVisualStyles` had 0 uses inside `Pipelines()` (safe to move entirely into `LeadCard.js` as private), while `parseList`/`formatMoney`/`buildDefaultTeams` are used on both sides (moved to a shared helpers file both import). Caught one real mistake this way before it shipped: `Pipelines()` itself renders `<LeadCard>` directly too (inside what is almost certainly a `DragOverlay` drag-preview), which the first pass of the extraction script missed — a plain grep for `<LeadCard` inside the `Pipelines()` line range caught it before the file was left broken.

**Validation performed (a real bug was caught and fixed mid-process):**
- A first automated import-block rewrite silently no-op'd (the string match failed) — the resulting `index.js` had `styles`, `StageColumn`, `LeadCard`, etc. referenced but never imported. Plain `node --check` did not catch this (it doesn't parse JSX at all, and — confirmed by testing — inconsistently no-ops on some large JSX files rather than erroring, so its "pass" is not trustworthy signal either way here). ESLint's own config was tested and confirmed to **not** catch it either (verified by deliberately breaking a copy and re-linting: 0 errors). What actually caught it: a manual grep of the new file for the old import names, which still showed the stale imports untouched.
- Built a proper checker using `@babel/parser` (JSX-aware grammar check) and `@babel/traverse` (full scope analysis: every `Identifier` and JSX component tag resolved to either a known global or an actual binding). Validated the checker itself against a deliberately-broken copy (missing `styles` import) — it correctly flagged `styles (line 990)` where ESLint had passed it. All 7 real files then came back clean.
- A byte-for-byte content-integrity diff: every extracted function/component/object body was checked to be a verbatim substring match against the exact original source slice (not just "looks similar") — all 10 pieces (`Pipelines`, `formatMoney`, `parseList`, `buildDefaultTeams`, `getCardVisualStyles`, `StageColumn`, `LeadCard`, `TeamManagerModal`, `StageEditor`, `styles`) passed.
- Not done: an authenticated in-browser check (this page requires a logged-in Supabase session with lead/pipeline data to render meaningfully), and no dev server was started to avoid port/build-cache contention with the 5 other live sessions. This is a pure code-relocation with zero logic changes and three independent static checks confirming correct wiring, which was judged sufficient given that constraint — flagged here rather than silently assumed.

**Files created:** `pipelineStyles.js`, `pipelineSharedHelpers.js`, `LeadCard.js`, `StageColumn.js`, `TeamManagerModal.js`, `StageEditor.js`.
**Files removed:** none (this was a pure split, not a data-store migration).
**Consumers migrated:** none needed — `index.js` is the only importer of these components; nothing else in the codebase imports them directly.
