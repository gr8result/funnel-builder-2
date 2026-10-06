# Repository cleanup continuation - revised size policy

This continues the successful initial batches. It does not restart the audit. The current policy is: 10,000+ normally needs decomposition; 5,000-9,999 is a strong candidate; 2,000-4,999 requires architectural inspection; below 2,000 is not a cleanup problem without specific evidence. Counts alone do not justify a split.

## Completed independent batches

| Original file | Before | After | Extracted responsibilities |
|---|---:|---:|---|
| `components/website-builder/website-renderer/wbBlockComponents.js` | 8,398 | 550 | Eight modules for common block helpers, media, columns, overlays, services, showcases, accordions and video |
| `components/website-builder/page-builder/pbPropertiesPanels.js` | 7,056 | 4,834 | Shared editor controls and navigation property panels |
| `components/website-builder/WebsiteBlockRenderer.js` | 5,717 | 4,480 | Hero/parallax rendering and its private video/orbit helpers |
| `components/website-builder/page-builder/pbCanvasComponents.js` | 5,613 | 2,491 | Block frames, image stacks, columns, grids, showcases and contact-form property panels |

Seventeen implementation modules were added within the existing website-builder ownership folders. The largest extracted file is 1,836 lines. Existing entrypoints retain substantive implementations and stable exports. They are not empty compatibility shims. Files were separated by responsibility, without another pass to force the remaining 2,000-4,999-line entrypoints below an arbitrary limit.

One clean regression test, `scripts/test-website-builder-sticky-scroll-stack-regressions.mjs`, now reads the extracted accordion implementation. Its assertions and line count are unchanged. No catalogue/data decomposition occurred in these batches, and no files were deleted. The complete [change manifest](2026-09-16-changes.csv) includes before/after counts for every cleanup-owned file.

## Shared-tree safety and prior-change disclosure

Current Git status, initial status and file contents/hashes were checked before each source batch. All five existing source/test files changed in this continuation were clean in the initial snapshot and immediately before their respective batches. New destinations were checked for collisions. No cleanup-owned source collision was detected. Active changes elsewhere, including product-library, appliances and Takeoff, were preserved.

The initial snapshot contained 952 deleted, 187 modified and 3,990 untracked paths. None of the twelve existing files changed by the earlier cleanup batches overlapped that initial dirty set. Cleanliness does not establish that another session has no readers or unsaved work. The earlier edits with relevant shared dependencies are disclosed explicitly:

| Earlier file/change | Status before cleanup | Overlap assessment and current treatment |
|---|---|---|
| `lib/sharedMediaLibrary.js`: funnel catalogue import path migrated | Clean | The workbook calls `/api/assets/list-library`; this shared media path participates even when email references are disabled. No further edits. |
| `lib/website-builder/templateLibraryAssets.js`: funnel catalogue import path migrated | Clean | Used by the same generic shared-media loop. No further edits. |
| `lib/website-builder/templates.js`: profile import migrated | Clean | Consumed by protected `projectStore.js`. No further edits. |
| `components/email/editor2/EmailEditor.jsx`: existing email save/localStorage callbacks extracted into `useDocumentPersistence.js` and `useSavedBlocks.js` | Clean; destinations absent | This was an email persistence extraction in the earlier authorized batch. It did not modify Job/Takeoff/appliance storage. Those persistence responsibilities are now frozen. |

The [earlier batch report](2026-09-16-batches.md), [email report](2026-09-16-email-editor-batch.md) and manifest identify all other earlier changes. Nothing was undone. No reset, restore, checkout, clean, stash, commit, push, merge or deployment was performed.

This continuation left the actual Team/Stats persistence bodies in `pbPropertiesPanels.js`, footer/contact submission bodies in `WebsiteBlockRenderer.js`, and the canvas save callback wiring unchanged. Protected source-reading persistence tests were not rewritten to accommodate moved bodies. Existing NavBar and global-navigation implementations remain in their public entrypoints where those tests expect them.

## Validation

Each extraction was checked against its original clean implementation, with focused checks before the batch was considered complete:

| Batch | Reconciliation and focused evidence |
|---|---|
| Block components | All 56 declarations and 41 exports preserved; 76 server-rendered comparisons across editor/published and desktop/mobile modes matched; import resolution and cycle checks passed. |
| Property panels | All 96 declarations, 77 exports and nine datasets preserved; 17 server-rendered comparisons matched, totaling 187,307 bytes; imports resolve without a new cycle. |
| Hero renderer | All 12 moved and 21 retained declarations, the hero body and 41 other switch clauses preserved; 330 complete-renderer server-rendered comparisons matched. Independent read-only review confirmed captured bindings and unchanged footer/contact bodies. |
| Canvas panels | All 31 declarations and 23 exports preserved; hook bodies/order and callback wiring unchanged; imports resolve without a new cycle; focused undefined-binding checks passed. |

Final independent verification resolved all 137 direct imports/reexports/dynamic imports; the 97-file local dependency graph has no cycles or unresolved paths, and all 21 changed/new implementation files parse.

Targeted ESLint reported zero errors. Block, property and canvas batches retained their respective 29, 15 and 18 pre-existing warnings. The hero/main-renderer lint pass reported 16 image warnings. Diff whitespace checks and the revised audit script syntax check passed.

Passing focused commands:

```powershell
node scripts/test-website-builder-button-links-regression.mjs
node scripts/test-website-list-block-image-rendering.mjs
node --import ./scripts/register-extensionless-loader.mjs scripts/test-website-save-publish-persistence-regression.mjs
node scripts/test-website-builder-sticky-scroll-stack-regressions.mjs
node --check scripts/repository-maintenance/audit.mjs
```

The sticky-scroll command ran its source checks, not its optional interactive mode. Server-rendering comparison loaders transpiled JSX and modeled the existing webpack behavior for an unavailable `FaBadge` named export in `gridIconLibrary.js`; that unrelated application import was not changed. These comparisons establish output parity for the exercised cases, not every interactive state.

An isolated Next development server used port 3108 and `.next-cleanup-renderer-20260916`. All three routes compiled and returned HTTP 200 with Next page data and no compilation error:

- `/modules/website-builder/visual-builder`
- `/modules/website-builder/preview`
- `/qa/website-footer-navigation`

The first cold editor request timed out while compilation was still running; the completed compilation and subsequent request passed. Preview emitted a React warning about multiple children in a title element. No unrelated fix was attempted. The isolated server was stopped, and port 3108 no longer had a listener. This establishes route compilation and initial server responses, not authenticated save/load or full browser interaction.

Two pre-existing focused failures were recorded and left unchanged:

- Global-navigation regression: its line 183 assertion expects a relative sticky-navigation frame, while unchanged `stickyNavigationFrame.js` returns `position: "sticky"`.
- Footer-navigation regression: its line 95 assertion expects `/blog`, `/privacy-policy` and `/terms`, while unchanged defaults contain `#blog`, `#privacy` and `#terms`.

The relevant implementation/default files were verified against HEAD. The earlier full typecheck was blocked by active Client Selections syntax edits; it is not represented as passing, and those files were not repaired.

## Remaining inventory and decisions

| Revised category | Before this continuation | After, tracked source/data |
|---|---:|---:|
| 10,000+ | 14 | 14 |
| 5,000-9,999 | 10 | 6 |
| 2,000-4,999 | 26 | 29 |

All twenty remaining tracked files above 5,000 lines are blocked by active/frozen work or confirmed consumers in that work. This includes clean catalogue files read by the modified catalogue service, paired JS/JSON catalogues maintained together by generators, workbook data consumed by active defaults, and the writable website defaults store. File cleanliness alone would not make those migrations independent.

All 29 files in the inspection band have individual decisions in the [remaining inventory](2026-09-16-remaining.md). Cohesive variant styles, the standard-inclusions master, single-domain catalogues and the newly reduced entrypoints are retained. CRM details, Gantt presentation and social creation contain possible future boundaries, but their current storage/loading dependencies prevent an independent broad extraction in this pass. Saved project and recovery artifacts are not treated as disposable source files.

No additional dead file was proven safe to delete. Existing appliance safety/range files, catalogue JS/JSON counterparts, gallery assets, Next routes, debug/project snapshots and compatibility paths with unresolved consumers are retained. Absence from a static import search is insufficient for dynamically read data or public URLs.

## Proposed ownership tree

The implemented tree keeps the website editor and renderer responsibilities inside their existing module folders. Next route entrypoints and shared media/auth utilities retain their current locations and URLs.

```text
components/
  website-builder/
    WebsiteBlockRenderer.js
    website-renderer/
      wbBlockComponents.js        # navigation and stable block API
      wbHeroRendering.js          # hero/parallax composition
      wbBlockHelpers.js
      wbMediaBlocks.js
      wbColumnBlocks.js
      wbOverlayBlocks.js
      wbServiceBlocks.js
      wbShowcaseBlocks.js
      wbAccordionBlocks.js
      wbVideoBlocks.js
      wbVariantStyles.js          # cohesive style catalogue retained
    page-builder/
      pbPropertiesPanels.js      # remaining inspectors and frozen storage bodies
      panels/
        EditorControls.js
        NavigationPanels.js
      pbCanvasComponents.js      # property routing and navigation integration
      pbCanvasBlockFrames.js
      pbImageStackPanel.js
      pbColumnPanels.js
      pbGridSectionPanel.js
      pbShowcasePanels.js
      pbContactFormPanel.js
  email/editor2/                  # earlier responsibility split; persistence frozen
modules/
  funnels/                       # earlier catalogue/rendering ownership
  website-builder/template-profiles/
lib/
  sharedMediaLibrary.js           # genuinely shared; currently frozen dependency
  website-builder/projectStore.js # persistence freeze
data/product-library/
  catalogues/                    # existing paths retained during active work
  source-evidence/
docs/reports/repository-cleanup/
scripts/repository-maintenance/audit.mjs
```

Future catalogue decomposition is a proposal only: brand/category files, with meaningful domain subdivisions only when justified, plus small brand manifests, a catalogue API and an explicit ordered product manifest. No model-specific files, empty categories or arbitrary numbered parts are allowed. Readers, generators, dynamic scanners and public path contracts must migrate together after the freeze is released. Exact canonical equality, unique IDs, active flags, product/pack relationships and source evidence must reconcile before removing a monolith. The [updated appliance plan](2026-09-16-appliance-plan.md) records the latest architecture clarification, current snapshot and dependency map. Refresh its baseline again at implementation because the catalogue is actively changing.

The safe work identified in this pass is complete. The repository-wide backlog remains open under the active-work restrictions.
