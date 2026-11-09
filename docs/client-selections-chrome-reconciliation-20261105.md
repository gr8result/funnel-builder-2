# Client Selections — Chrome reconciliation and O.Novo recurrence (4–5 Nov 2026)

Status: software fix and merged job verified in isolated browsers. **Actual Chrome acceptance is not done**: it needs the import below, carried out by the builder in their own Chrome. Not production-ready until then.

## Cabinetry review acceptance failure (6 Nov 2026)

The cabinetry landing screen must use confirmed project room identities rather than
the catalogue's default room names. The second bedroom's ensuite is the saved room
`location-bedroom-2-ensuite@upper`, displayed as **B2 Ensuite**; it is not the other
**Ensuite**. **Bathroom** is an explicit historical alias of **Main Bathroom**,
not an additional room. Existing cabinetry record IDs and specifications are retained.

Specification completion and review approval are separate states. The final review
action is **Confirm & Approve [room] Cabinetry**. It saves an idempotent approval
against the job ID, stable project room ID, and exact current specification revision.
It stays in the reviewed room and reports success only after the job save succeeds.
Draft saves, legacy `status: complete`, and a historical `confirmedAt` do not create
this approval. Review Schedule lists unapproved cabinetry rooms individually.

Approval persists in `cabinetrySelection.locations[].reviewApproval`. Relevant
product, finish, quantity, dimension, handle, benchtop, feature or note changes require
reapproval. Timestamps and catalogue price/status refreshes do not. Other rooms'
approvals and all existing quotation charges are independent of this action.

Focused regressions:

- `scripts/test-client-selections-cabinetry-approval.mjs`
- `scripts/test-client-selections-cabinetry-approval-browser.mjs`
- `scripts/test-cabinetry-room-navigation.mjs`

The browser harness uses a protected exported real job in a disposable Chrome
profile, assigns an isolated job ID, and intercepts cloud/API writes. Set
`CLIENT_SELECTIONS_JOB_FILE` to the protected package and
`CLIENT_SELECTIONS_BASE_URL` to the validation server. Use `--reproduce` only
with pre-fix source to capture the original room-list/approval failure.
This does not certify production readiness without successful browser acceptance.

### Session recovery checkpoint (7 Nov 2026)

VS Code crashed during the 6 Nov real-job browser acceptance (`ERR_INSUFFICIENT_RESOURCES`
while waiting for the cabinetry step menu). All code survived. State after recovery:

- The 6 Nov reproduction on the real job confirmed the defects. Before the fix the cards were
  Kitchen, Butler's Pantry, Bathroom (Not added), Ensuite, Powder Room, Laundry, Other (Not added),
  Main Bathroom. There was no B2 Ensuite and no approval button.
- The partial acceptance run after the fix showed the corrected identities: B2 Ensuite present,
  no Bathroom or Other card, and Kitchen "Specification complete - approval required". The cards
  were in model order, though (Powder Room first). Fixed on 7 Nov: `cabinetryRoomRank` in
  `lib/builders/cabinetryWorkflow.js` orders both the landing cards and Next/Previous as Kitchen,
  Butler's Pantry, Main Bathroom, Ensuite(s), Powder Room, Laundry, then the rest.
- Node: 53/55 Client Selections suites pass. The 2 skipped need a browser. Cabinetry invariants
  are 17/17 after updating a stale benchtop assertion. The committed inline "Enter benchtop
  length" action is intended behaviour.
- The shared `node_modules` was left incomplete by the 7 Nov worktree incident: 1,401 missing
  files and 8 truncated files across 17 packages. These were restored from the offline npm cache
  (missing or truncated files only), and now match the cache tarballs for every affected package.
  This also fixed `test-selections-schedule-pdf`.
- Not yet run, because there was not enough memory (2.6 GB commit free while two other dev
  servers held about 9.5 GB): the real-job browser acceptance of approval, persistence, export and
  reopen; `tsc`; and the isolated production build.
- Checkpoint copy of the 66 Client Selections working files:
  `C:\Users\grant\cs-backup-20261031\checkpoint-20261107-cabinetry` (SHA256SUMS, HEAD).

### Release gates (7 Nov 2026, afternoon)

Builds were isolated, with production `next start` on port 3125, one heavy operation at a time.
Port 3000 was not touched. The idle Quotation Builder dev server on 3121 was stopped with the
user's approval.

| Gate | Result |
|---|---|
| Real-job browser acceptance (`test-client-selections-cabinetry-approval-browser.mjs`, merged candidate under an isolated job ID) | **PASS** on both builds |
| `test-client-selections-memory.mjs` (10-minute soak, real job) | **PASS**: heap peak 256 MB, renderer peak 1,259 MB |
| `test-selections-cover.mjs` | **PASS** |
| Node Client Selections suites | **53/53 PASS** (plus the 2 browser suites above = 55/55) |
| `tsc --noEmit` | **PASS**, 0 errors, 3.0 GB |
| Production build `.next-cs-release-20261107` (with lint) | **PASS**, peak 7.7 GB, free commit briefly 0 |
| Rebuild `.next-cs-release-20261107b` (banner CSS fix, `--no-lint`) | **PASS**, peak 5.5 GB |

Acceptance covers:
- rooms Kitchen, Butler's Pantry, Main Bathroom, Ensuite, B2 Ensuite, Powder Room, Laundry, in that order, with no Bathroom or Other card;
- Review Schedule lists Kitchen before approval;
- "Confirm & Approve Kitchen Cabinetry" records `reviewApproval`;
- Kitchen leaves the queue immediately;
- repeat approval is idempotent;
- reload, app export and reopen keep the approval;
- a quantity change requires reapproval;
- charges, other selections and O.Novo are unchanged; no page errors; no cloud writes.

Harness fixes (test-only):
- the review-queue match was too loose (it matched the Tiling item);
- the native Save picker is answered with Chrome's intercepted-picker error, which sends the app down its own verified download;
- the memory test inlines `knownAssetIds.js`, which `planBlobStorage.js` now imports.

App fix: the cabinetry banner title was squeezed behind the stat tiles. It now wraps (`.cabinetryBanner` in `selections-book.js`).

Verification copy for the builder's own Chrome check: `C:\Users\grant\cs-backup-20261031\checkpoint-20261107-cabinetry\New Job 03 09 - VERIFICATION COPY 2026-11-07.gr8job`.
- The app exported it.
- It has its own job ID, `recovered-03-09-123-verify-20261107`, and opens as a separate job, so the live job is not replaced.
- No approvals are pre-recorded and charges are unchanged. SHA-256 is in `VERIFICATION-COPY.sha256`.

## 1. What Chrome holds (read-only, from a copy of Chrome Profile 6 storage)

| | Chrome (live) | Corrected export 04-11 | Merged candidate |
|---|---|---|---|
| Job / revision | `recovered-03-09-123` rev 20, saved 2026-11-04 17:18:25 AEST | package rev 1 | package rev 2 |
| Checksum | `202852a63bea54ad415eec021bf8cfb46a2d0ed6a352d4c23ced82493a19ee18` | (package checksums valid) | (package checksums valid) |
| Workbook keys | 76 | 76 | 76 |
| Guided selection records | 43 | 43 | 43 |
| Schedule entries | **155** | 154 | **154** |
| O.Novo conflicts | **3** (Main Bathroom, B2 Ensuite, Ensuite) | 0 | 0 |
| Kitchen cabinetry | 1 of 6 rooms (confirmed 17:14:53) | 1 of 7 rooms | 1 of 6 rooms |

Only Profile 6 has current localhost:3000 data. No Chrome save has happened since rev 20.

## 2. Cause of the Chrome discrepancy

- Chrome's job descends from `New Job 03 09 - latest live revision corrected 2026-11-02.gr8job`, opened in Chrome on 2 Nov (22:37 UTC). That file already had the obsolete row: Shower Rail / Rose = O.Novo ×5 + Vivid ×4.
- The O.Novo and sink corrections were made later (2 Nov 22:49 and 3 Nov 02:02 UTC) in another browser and exported as the corrected file. **That file was never opened in Chrome** (Chrome's recent-files list has only the 2 Nov open; there is no file-open revision in the job's history).
- **155th entry:** row `row-1790389148888-4ebcff090b01f` (`shower-fixtures`), "O.Novo Style Shower/Bath Mixer ×5; Vivid Slimline Single Shower on Rail ×4", updated 2026-09-30. The second outdated row is `sink` (2026-09-27; no variation; the corrected row has −$152.73).
- Artwork (63 references) and plan images (5) in Chrome are byte-identical to the corrected file.

## 3. Root cause of the recurrence (software)

1. **The browser draft is re-stamped on every write.** `saveEmbeddedBookDraft` gave the draft `savedAt = now`, and `reconcileSelectionBookSources` chose the newest copy. An old book became "newer" than any job file opened afterwards. Demonstrated two ways:
   - with Chrome's real draft, the old chooser picks the draft over the corrected file;
   - the pre-fix build shows **155** after opening the corrected file with that draft present.
2. **Client Selections saves did not check revision.** `saveClientSelectionsBookNow` wrote whatever book the page held over the job. The stale book on screen therefore became permanent at the next autosave.
3. **Process gap.** The O.Novo removal existed only in exported files. It was never in the job's confirmed-corrections ledger, so nothing re-applied it to an older copy.

Checked and not at fault:
- IndexedDB hydration (checksummed revision chain);
- historical-backup fallback (opt-in, exact ID);
- import precedence (`estimate.json` workbook wins; mirrors were identical);
- other profiles.

## 4. Fixes (uncommitted)

- `lib/builders/selectionBookSource.js`:
  - a browser draft records `draftOf`, the saved revision it was made from;
  - a draft of a different revision than the job's is skipped as stale (`staleDraftReason`);
  - `staleClientSelectionsSave` is the save-side check.
- `pages/modules/builders/selections-book.js`:
  - drafts carry `draftOf`;
  - a stale draft is kept under `<draft key>:superseded`, not lost;
  - saves send `baseSelectionRevision`.
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`: a save made from another revision is refused (`STALE_CLIENT_SELECTIONS`), unless the newer revision is this tab's own earlier save.
- `components/client-selections/SelectionAttentionPanel.jsx`: group summary text 14px → 16px (16px rule).
- Merged job: the O.Novo removal is recorded in the ledger (`removeProducts`: `shower-fixtures` / `master-PLB-HNC-T165661`). Applying that rule to Chrome's row reproduces the corrected row exactly (Vivid ×4, $1,564, variation −$2,178.18).

## 5. Files (C:\Users\grant\cs-backup-20261031\chrome-reconcile-20261104)

- `New Job 03 09 - Chrome rev20 protected copy 2026-11-04 1718.gr8job`: Chrome's job exactly as is (artwork and plans restored, hash-verified).
- `New Job 03 09 - merged candidate 2026-11-04.gr8job`:
  - built from Chrome rev 20;
  - adds the corrected `sink` and `shower-fixtures` rows and the ledger entry;
  - drops the obsolete O.Novo purchase line.
- `... merged candidate app-exported backup 2026-11-05 0604.gr8job`: the app's own validated export of the candidate.
- `SHA256SUMS.txt`, `raw-chrome-profile6-snapshot-1721/`, `evidence/`, `scripts/`, `pre-edit-source-copies/`, `chrome-readonly-diagnostic.js`.

## 6. Import procedure (builder, in Chrome; port 3000 picks up the fix on reload)

1. Close every other GR8 tab. Reload the remaining tab.
2. Optional: paste `chrome-readonly-diagnostic.js` into the Console. It should show revision 20 and checksum `202852a6…`.
3. File → Download Backup Copy.
4. Open the merged candidate (Open Job File). If an "older file" choice appears, stop and report it.
5. Client Selections → Review Schedule. Expect:
   - 154 schedule entries;
   - 43 of 43 represented;
   - duplicates group absent (0);
   - 5 client decisions;
   - "6 requirements remain".
6. Reload and check the same figures. Then File → Download Backup Copy.

## 7. Verification

- Isolated build `.next-cs-verify-20261104` on :3121; all writes answered locally. Rebuilt with the 16px fix as `.next-cs-verify-20261105` (exit 0). Readability 9/9 and the stale-draft regression passed again on it.
- Stale-draft regression with merged job: **PASS** (154 / 0 conflicts after open and after reload). Pre-fix build: **FAIL, 155** (control).
- Real PDF: 15/15 PASS.
  - 17 pages.
  - O.Novo once, Qty 4 (Ensuite, Main Bathroom ×2, B2 Ensuite).
  - Production book and rows unchanged.
- Quotation: proposed **$885,641.53** (+$49,089.77, 107 lines). It is held for approval; nothing was approved.
  - The current approved quotation charges O.Novo twice (shower-fixtures ×5 @ $304.55 + bath-mixer ×4).
  - The proposal charges ×4 once.
  - No duplicate charges; Apply stays disabled until the price-pending items are decided.
- Final Output readability 9/9; 29/29 category walkthrough; app backup export + reopen in a fresh profile: PASS (round-trip lossless).
- Node: 51 Client Selections / persistence tests pass, including typography after the 16px fix.

Still failing, not caused by these changes:
- `test-client-selections-memory` (4 workbook clones per save; same copy calls before and after);
- `test-benchtop-selection`;
- `test-client-selections-product-card-render` (`templatePriceReference` undefined);
- `test-selections-book-schedule-layout`;
- `test-client-selections-room-review` (expects a pricing item for an unconfirmed Bath; current rule lists it as a decision).

## 8. Genuine decisions still open (not fabricated)

- 5 client decisions:
  - Cabinetry (1 of 6 rooms);
  - Electrical (26 of 28 rooms);
  - Tiling (ALFRESCO);
  - Internal paint colours;
  - Ceiling fans (6 of 8 unallocated).
- 10 builder price overrides await contract confirmation; 8 items need a price; 7 template estimates.
- The quotation reconciliation (+$49,089.77) is awaiting the builder's approval.
