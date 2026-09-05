# Recovery copy-on-write save repair

## Cause and implementation

`assertTakeoffRecoveryWriteAllowed` rejected the live key `job:03-09/123` in normal save, import and snapshot paths. It protected the active job itself, rather than retaining an immutable copy of the original.

That refusal is removed. The canonical working job still uses ID `03-09/123` and key `job:03-09/123` in IndexedDB `estimate-builder-template-db`, store `jobs`. The protected original is retained at `job:03-09/123:snapshot:recovery-original` as an immutable `job-recovery-backup` whose `originalRecord` contains the complete unchanged original record, including its original envelope and workbook.

Opening the protected source automatically initializes a working revision. Initialization re-reads the source under the same per-job queue/Web Lock used for saves, and does nothing if a working revision already exists. It cannot reset a newer save to the original. A normal Save from an already open editor also performs this copy-on-write transition directly; it does not require reopening, Save As or a new name.

The original backup is created using IndexedDB `add`, never `put`. Original creation, working record, revision snapshot and active pointer are committed together in a native transaction. Subsequent saves keep the same backup and update only the working record and new successful revisions. Invalid backups abort the transaction. Save still verifies the committed ID, revision, SHA-256 and required payload sections before reporting success.

Snapshot keys remain non-writable through the normal job-save interface. Recovery originals are excluded from the normal job list and retained for recovery. The existing revision restoration code understands the new original-record envelope.

A mount-effect guard also prevents development Fast Refresh from re-running startup hydration over an already open workbook. Normal Save does not restore its completed snapshot into React state.

## Safety before edits

Before modifying source, stored Chrome profile data was copied to:

`test-results/johnson-browser-storage/2026-09-05T21-17-31-737Z/`

The manifest is `browser-storage-export.json`; the console log is `test-results/recovery-copy-on-write-before-backup.log`. No user databases, localStorage, templates or browser profiles were cleared. Original source copies and `repair.diff` are in `test-results/recovery-copy-on-write-before/`.

Chrome exposed no remote debugging connection, so capturing the user's current in-memory, unsaved workbook was not technically available. This backup preserves stored state; it is not a claim that unsaved memory was captured. The user's browser was not restarted or navigated by the repair.

## Files changed

- `lib/construction-estimation/jobPersistence.js`: atomic copy-on-write archive and working revisions; immutable backup validation; idempotent initialization using the existing save locks.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`: removes blanket refusal; initializes protected records on open; routes protected imports through verified persistence; protects live state during Fast Refresh; supports restoring the original envelope.
- `scripts/verify-recovery-copy-on-write-browser.mjs`: real UI/native IndexedDB save, complete page destruction, reopen, original preservation and name/key regression.

## Browser test scope

The test uses Chrome with real UI input and native IndexedDB at the isolated local development server `localhost:3012`. It restores an actual archived New Job 03/09 workbook from `recovery/emergency-2026-09-05T00-42-37-307Z/0001-job_03-09_123_snapshot_2026-09-04T21_10_42.804Z.raw.json` into the protected source key in an isolated browser profile. The archived file and user's live browser are untouched. This is an archived recovery revision, not a capture of current unsaved edits.

The test checks that opening creates a writable revision and an exact original backup, changes Driveway to 60 and Sales Commissions to 4, clicks normal Save, changes name formatting while asserting one storage ID, completely destroys the page, starts a fresh page, explicitly reopens the same job using its stable job number, and checks both displayed values and exact original preservation. Storage is not mocked.

A prior test run saved successfully but stopped on an incorrect menu-label selector (the menu shows the filename with spaces). The selector now uses the stable job number. Another attempt encountered a transient development chunk-load failure before opening a job; it is not counted as a successful regression.

## Passed real-browser results

`test-artifacts/recovery-copy-on-write/1788643690662/report.json` records the successful run.

- Opening the protected recovered source created writable revision 1 automatically, before editing.
- Driveway was changed to `60`, Sales Commissions to `4`, and normal Save succeeded at revision 5 with `Saved at 07:29:06`. Intermediate revisions include autosaves.
- Display names `New Job 03/09/123`, `New Job 03-09` and `New Job 03/09` all retained ID `03-09/123` and key `job:03-09/123`. No name-derived conflicting job keys appeared.
- The page was completely closed. A fresh page loaded the application, then explicitly reopened the same Recent Job using its stable job number.
- Both displayed values remained exactly `60` and `4`.
- The immutable original still existed at `job:03-09/123:snapshot:recovery-original`; its full original record matched the pre-edit source exactly, and the backup itself matched its pre-edit copy.
- No browser page errors were recorded. No recovery-safe-mode Save error occurred.

Screenshots: `reopened-driveway.png` and `reopened-commissions.png` in the same artifact directory. The complete-restoration/defaults test also passed, as a supplementary check rather than the basis for the browser result.

These are local workspace changes verified at localhost:3012, not a claim that a production deployment or the user's current browser-memory state was modified.
