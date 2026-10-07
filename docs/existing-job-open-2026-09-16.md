# Existing job file open verification — 16 September 2026

The actual **Open Job File from Computer** menu now opens the selected existing job, and F5 restores the same persisted job. Verification used a native OPFS file handle containing the exact original bytes in an isolated browser. It did not substitute a generated test job or modify the original file.

The selected file was `C:/Users/grant/Downloads/New Job 03 09.gr8job`, **65,734,589 bytes**, named **New Job 03/09**, with job ID `recovered-03-09-123`. Its ZIP CRC and all ten manifest section checksums passed. Its SHA-256 remained unchanged after verification:

`833c96afc38ca71cae8339c34f89e6d83817d8e073a296244eefe82be80e4ac0`

The original archive contains no saved takeoff in either its dedicated section or workbook. No matching `.bak` was found in the searched locations; the search scope and its limits are recorded in [alternate-archive-audit.json](../artifacts/recovery/existing-job-open-20260916/alternate-archive-audit.json). Valid alternatives exist at `C:/Users/grant/Documents/GR8 Jobs/New Job 03-09/New Job 03 09.gr8job` and `E:/GR8 Jobs/New Job 03-09/New Job 03 09.gr8job`. Both contain five plan pages, 39 wall runs and 50 openings, but use the different ID `recovered-03-09-123-mtrqpjz8` and have older Job Setup content: 212 input rows versus 311 in Downloads. The E: archive also differs in selections, quotations and procurement. This task did not replace or wholesale merge those archives.

Confirmed changes:

- Picker-open failures retain the selected filename and underlying error. An already open workbook no longer silently clears the error. The interface displays **Opening job file…** while the operation runs.
- The earlier handle-lifecycle repair was preserved: opening a different job clears a stale computer-file handle after successful hydration; a failed open preserves the current job and handle. Legacy job IDs remain available for recent-job identity.
- Restoration preserves the original root `projectEstimateBuilder` and legacy `clientPage.proposalBuilder` locations independently. It no longer adds a second copy of a large document or replaces independently saved values. For the selected file, the prepared workbook signature fell from **191,611,180** to **98,845,400 characters**, with document content preserved. Compatible concurrent work also removed redundant JSON cloning during restoration.
- ZIP serialization preserves legacy-only and independently saved dual documents. A root-only document remains a single stored copy.
- The existing save-deadlock repair remains: `saveStoredJob` delegates directly to `persistCompleteJob`, which owns the save lock. Startup reads remain outside that lock. Complete-job validation guards were not weakened.

The user's historical failure was **not reproduced as an exception** during this verification. Document duplication and hidden diagnostics were confirmed defects; neither duplication nor a stale lock was proven to be the cause of that earlier failure.

[open-reload-report.json](../artifacts/recovery/existing-job-open-20260916/open-reload-report.json) records a passing actual-menu import and reload, with visible opening status. Both sides of reload retained revision **5**, job ID `recovered-03-09-123`, and checksum `e8e2202c39543928d0ed63b74f15758f1df1b6b463178cbcd009877f0934ec90`. No save locks were held or pending at either checkpoint.

| Persisted content | Before F5 | After F5 |
| --- | ---: | ---: |
| Job Setup input rows | 311 | 311 |
| Quotation sections / rows | 160 / 1,873 | 160 / 1,873 |
| Selection rooms / rows | 19 / 149 | 19 / 149 |
| Project Estimate document pages | 29 | 29 |
| Root document / extra legacy copy | present / absent | present / absent |

Passing checks include `test-job-file-open-handle-lifecycle.mjs`, `test-job-file-picker-activation.mjs`, `test-job-file-project-estimate-restoration.mjs` (including the original selected file), `test-job-file-project-estimate-roundtrip.mjs`, `test-master-job-file-roundtrip-runtime.mjs`, `test-complete-job-restoration.mjs`, and `test-job-setup-reopen-regression.mjs`. Targeted lint reported no errors and 25 existing warnings. Two existing static checks, `test-local-job-file-open-integrity.mjs` and `test-master-job-file-architecture.mjs`, still fail because they expect the old `dirty: jobFile.hasActiveJob && jobFile.dirty` expression; the implementation already used `dirty: sheet.dirty` before this task. Those checks were not changed.

Task source edits are limited to `components/estimate-builder/EstimateBuilderWorkbook.js`, `hooks/estimate-builder/useEstimateBuilderWorkbook.js`, `hooks/useJobFile.ts`, and `lib/jobFile.ts`. Test changes are the lifecycle script and the two new project-estimate restoration/roundtrip scripts listed above. Other working-tree changes belong to earlier or concurrent work.

The final [module visibility check](../artifacts/recovery/existing-job-open-20260916/module-visibility-report.json) passed for the active Project Estimate and Client Selections screens. The estimate displays its 21 imported PDF pages; the eight retained template pages explain the 29 stored pages. The selection review displays 42 mapped items, including the archived Westinghouse WVE6515SD oven. Its count is not the raw 149-room-row count. The archive's 16 cabinetry-related rows are legacy Builder Standard defaults; no configured cabinetry items appeared in contract review, so this does not claim a completed cabinetry configuration. Takeoff visibility cannot pass for this selected file because its takeoff is empty. Archive evidence is in [archive-audit.json](../artifacts/recovery/existing-job-open-20260916/archive-audit.json).

The original files and user browser storage were not cleared or overwritten. No commit, push, or deployment was performed.
