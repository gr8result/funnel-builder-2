# Estimate / Quotation Builder persistence repair

The changes are in the local workspace. Browser verification uses the isolated development server at localhost:3012; this is not a production deployment.

## Root causes and corrections

1. The old dirty fingerprint omitted Data Input, formulas, client-page and payment data. Those changes could bypass autosave. The new signature covers the complete workbook, including unknown module fields, excluding only root save timestamps and the visible-page marker.
2. Restore normalisation reapplied row/formula migrations and template defaults to saved jobs. The diagnostic reproduced a saved `123+7` becoming the default floor-area expression. Saved schedules, formula maps, deleted rows and order now remain authoritative. The screen and calculation engine also now use the saved formula; `123+7` evaluates to 130.
3. Local job keys depended on editable names. Renaming could address another record, and local jobs were excluded from Recent Jobs. New jobs receive a UUID, and persistence uses `job:<jobId>`; local jobs appear in Recent Jobs.
4. Manual Save used the file workflow and its completion callback reopened the saved snapshot. That could replace newer edits. Save Job now persists the complete current workbook to application storage; saving a computer file no longer triggers restoration.
5. Project Estimate delayed promotion of edits to shared state; navigation could cancel that delay. Edits now reach the shared workbook immediately, and saved documents (including deliberately empty documents) are protected from asynchronous server/default hydration.
6. Startup omitted takeoff hydration and briefly rendered defaults before restoring the saved job. The editor now waits for complete hydration, with an explicit load-error state.

Reproduction evidence: `test-results/job-persistence-repair-before/root-cause.json`. Before-edit source copies and a focused diff are in the same directory.

## Storage and recovery

- Canonical local job: IndexedDB `estimate-builder-template-db`, object store `jobs`, key `job:<stable jobId>`.
- The workbook contains all job modules under that identity. localStorage holds navigation/recent-job metadata, not the canonical module payload.
- Each successful save carries a revision, SHA-256 checksum and required-section list. Native IndexedDB writes the current record and revision snapshots atomically. The code reads the record back and checks identity, revision, checksum and required sections before reporting success.
- Saves are serialized per job. An incomplete payload is rejected; previous successful snapshots remain available through Restore Previous Successful Save.
- Existing computer files are read and preserved before replacement. `Save Job to Computer` explicitly uses the browser file picker/handle for a single `.gr8job` package with separate module sections and checksums. No physical Windows folder is silently created or claimed.
- Before storage changes, browser storage was copied to `test-results/johnson-browser-storage/2026-09-05T19-52-23-780Z/`, including raw profile storage and `browser-storage-export.json`. No existing jobs, templates or databases were cleared.

## Changed implementation files

- `lib/construction-estimation/jobPersistence.js`: complete restoration, whole-workbook signature, atomic revisions and verified persistence.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`: stable identity, full save/load, dirty/error status, hydration protection, revisions and local Recent Jobs.
- `components/estimate-builder/EstimateBuilderWorkbook.js`: full-job Save actions, explicit computer export, restoration UI, immediate shared Project Estimate edits and saved-formula display.
- `components/estimate-builder/project-estimate/persistence/useProjectEstimateInstanceSync.js`: prevent stale server hydration and job-switch callbacks from replacing the current document.
- `lib/construction-estimation/estimateBuilderWorkbookCalculations.js`: evaluate explicitly saved formulas.
- `hooks/useJobFile.ts` and `lib/jobFile.ts`: preserve current editor state on save, preserve unknown fields, validate file sections and revisions.
- `lib/construction-estimation/inputDataSheetTemplate.js` and `.json`: exact INTERNAL WALL FINISH default.

## Verification scope

The browser regression uses Chrome, real UI edits and native IndexedDB. It does not mock storage. It saves from Data Input, Calculations and Quote Sheet, closes the page completely, opens a fresh page, reopens the named job and compares restored state. A separately saved job must remain unchanged.

The restoration test additionally covers unknown fields/modules, stable image references, payment extensions, zero values and authoritative empty/deleted schedules. Those are unit-level checks; the browser comparison verifies restored sections but does not interactively edit every separate job module.

The physical-file test writes and rereads a real `.gr8job` file: revision 1 to 2, 3,518 to 6,675 bytes in the final run. A tampered ZIP section is rejected by checksum, and the valid file stays unchanged. The test uses a filesystem-backed file-handle adapter; it does not automate the operating-system picker.

A Chromium quota override did not induce a quota error; it is not evidence of disk-full handling. Actual disk-full UI behaviour remains unproven. The native persistence test separately checks that an incomplete payload aborts without replacing the successful record.

Tests added: `scripts/verify-job-persistence-repair-browser.mjs`, `scripts/test-complete-job-restoration.mjs`, `scripts/test-job-file-integrity.mjs`.

## Final real-browser results

PASS: `test-artifacts/job-persistence-repair/1788640911966/report.json`. Reopened screenshot: `reopened.png` in that directory. The complete verified record is `saved-complete-job.json`.

Stable job ID: `8c67469d-441e-4d17-bf6c-e44de65a8cf8`. Data Input save revision 4: 3,796,580 JSON characters. Calculations save revision 6. Quote Sheet save revision 15: 3,797,566 JSON characters (string length, not a compressed or UTF-8 byte count). SHA-256: `5315fe0646230f25c595510ad76a12150fca75a0cc7ddae5e21611c721768ea3`. Automatic saves account for intermediate revisions.

The old record shape had a workbook but no mandatory verified revision/checksum envelope; the new record includes `schemaVersion`, `jobId`, `revision`, `checksum`, `requiredSections` and the complete `workbook`, plus retained snapshots. Full payloads are not replaced by page-specific payloads.

Verified edits: wall finish changed from Plasterboard to framed walls to Battened and plasterboard lined; client name Persistent Client; margin 23; saved formula 123+7; edited quote description Persisted edited description, quantity 7, unit LM and rate 123.45; inserted row New persistent row with quantity 3 and rate 42; deleted quote-5; inserted row reordered before quote-4. The restored data, quotation, formulas, formulaRows, clientPage, cashflowPayments, productLibrary and windowsDoors sections matched the saved sections. The separate job remained unchanged. Browser page errors: none.

The native IndexedDB partial-payload test omitted productLibrary. Persistence rejected it with `Incomplete job: missing saved section productLibrary.` and preserved successful revision 16.

After the browser run, a targeted new-template sanitizer correction was verified by the restoration test: new templates get the exact wall finish default while the source job retains Raw blockwork. The broader browser run preceded that isolated template correction.
