# Client Selections — restoring the corrected live job (prepared 2026-11-01, NOT carried out)

Job: "New Job 03/09" (`recovered-03-09-123`), Chrome Profile 6, Estimate Builder.
Needs separate approval before step 3. Nothing here changes the quotation price.

## Update 2026-11-01 07:30 — the browser copy of the live job is gone

Chrome Profile 6's storage for `localhost:3000` was emptied before 06:21 today: Chrome's log records
"Creating DB … http_localhost_3000.indexeddb.leveldb since it was missing" at 06:21:03, and the job's large-file
store (`http_localhost_3000.indexeddb.blob`) no longer exists. No test of this release uses the real Chrome
profile (all run in temporary profiles), and none ran at that time. No newer `.gr8job` exists in Downloads,
Documents or Desktop (the only one is the old 26 Oct file). The cloud could not be checked (no production read
access in this session); the cloud selection book for the project is the known empty template book, not the job.

Consequences:
- The newest verified copies of the job are the two above (rev 14 decoded 2026-10-31, and the reconciled file).
  Any edit made in the browser after 2026-10-31 ~10:40 (+10) is not recoverable from this machine's files.
- Step 3 below now opens the reconciled file into an empty job store, so no "older file" dialog can appear and
  there is nothing to overwrite. Step 2 (backup of the browser job) has nothing to back up; skip it.
- Proven in an isolated empty browser profile against the integrated build (2026-11-01): opening the reconciled
  file gives ICON ×4, SPYDA ×2, no Origin/STANZA/AeroFlow, 43 selections, confirmed rooms; save, reopen, PDF and
  repeated saves are stable (`artifacts/cs-main-integration/import.log`, `real-pdf.log`).
- Before step 3, check whether you have a newer copy anywhere (another computer, an emailed .gr8job, a
  Storage Settings shared job server). If you do, open THAT file instead (with the corrected app, its confirmed
  corrections are carried forward) and keep the reconciled file as the fallback.

## Files (verified)

| File | SHA-256 |
|---|---|
| Reconciled job: `E:\dev\cs-main-candidate-20261031\artifacts\reconciled\live-rev14-reconciled.gr8job` (107 MB) | `c49d959c…d83a1f` |
| Same, backup: `C:\Users\grant\cs-backup-20261031\live-rev14-reconciled.gr8job` | identical |
| Live job as decoded on 2026-10-31 (rev 14, before recovery): `C:\Users\grant\cs-backup-20261031\live-before-recovery\live-rev14.json` | `4d885d35…fd1a2ad0` |

The reconciled file contains ICON toilets ×4, Origin ×0, SPYDA fans ×2 (Alfresco, Balcony), no STANZA/AeroFlow, the Riviere bath ×1, accessories ×3 per bathroom, 43 selections, the confirmed 25-room list and the 2026-10-25 corrections ledger.
Its selections are dated 2026-10-31 00:44 UTC; the live job's are 2026-10-30 20:38 UTC.

## Procedure

1. **Run the corrected code.** The app you use (port 3000) must be running main with patch v2. A dev server started before the patch, or an open tab, does not update by itself: restart that server yourself, then hard-reload the tab (Ctrl+Shift+R). Do not open any job file before this.
2. **Back up the job as it is now.** Open the job, then File → **Download Backup Copy** (and optionally **Save Job to Computer**). Keep that file alongside the backups above.
3. **Open the reconciled file.** File → **Open Job File from Computer** → choose `live-rev14-reconciled.gr8job`.
   - Expected: it opens directly (it is newer than the live job's selections).
   - **If the "This file is older than the job saved here" dialog appears, choose "Keep saved job" and stop.** It means the live job was edited after 2026-10-31 00:44 UTC; those edits must be reviewed before anything is replaced.
   - Never open `C:\Users\grant\Downloads\New Job 03 09.gr8job` again (the 30 Oct cause). If it is opened by mistake, the app now asks first; choose "Keep saved job".
4. **Save** (Save Job) and **reopen** the job (Close Job → Open Saved Job).
5. **Check** on Client Selections:
   - toilets ICON ×4, no Origin;
   - fans SPYDA ×2 (Alfresco, Balcony), no STANZA/AeroFlow;
   - 43 selections;
   - rooms are the confirmed project rooms (no Upstairs/Downstairs allocations);
   - the contract schedule PDF generates.
6. **Do not approve "Reconcile Selections".** The quotation stays at the approved $836,551.76. The proposed $887,949.03 (or $876,441.51 without tiling labour) waits for the pending commercial decisions below.

## Rollback

If anything looks wrong after step 3: File → **Restore Previous Successful Save**, or open the backup downloaded in step 2 and choose "Open file as it is" (the app backs up the current job first).

## Pending commercial decisions (do not price until confirmed)

- Bosch oven price (currently $0; allowance $1,200).
- Carpet supplier quotation (currently a $30/m² estimating allowance).
- Lighting and fan installation rates.
- Fan and downlight quantities (8 fans / 55 downlights quoted vs 2 / 53 selected).
- Standard Inclusions baseline.
- O.Novo mixer: is Shower Rail/Rose ×5 a duplicate of Bath & Shower Mixer ×4? (about $2,308 contract if yes).
- Tiling labour correction (+$11,507.52 contract: $50/m², $45 per waste, $40/lm skirting).
