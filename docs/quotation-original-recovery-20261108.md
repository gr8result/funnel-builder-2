# Quotation recovery – job `recovered-03-09-123` (New Job 03/09), 8 November 2026

Base: deployed release `93f3d5f`. Branch: `recovery/quotation-original-20261108`.
The rejected hotfix `7d510db` is **not** included: no tiling or electrical rates, floor-waste or BOQ changes.
Status: **not deployed. The live job has not been changed.**

## What was missing and why

| Lost from the quotation | When | Cause |
|---|---|---|
| 7 categories, 132 rows: CABINET MAKER (44), BUTLERS PANTRY (30), LAUNDRY (15), BATHROOMS (14), WARDROBES (13), STANDARD WARDROBES COMPLETE (2.4M WIDE) (90) (8), STANDARD 3 DOOR ROBE UP TO 3.6M WIDE (8). Every row had the builder's rate and a `qty x rate` formula. | Between the 3 Oct 21:56 save and the 9 Oct save | `reconcileCabinetryQuotation` (`lib/construction-estimation/finalCabinetryQuotation.js`) runs on every job load. It deleted every section with those names and put one generated CABINETRY section (870 catalogue rows) in their place. Its comment said: "Obsolete rows are discarded, including populated legacy/custom copies." |
| Appliances & White Goods content seemed to disappear | Same load | The ordering rule puts the APPLIANCES & WHITE GOODS heading after CABINET MAKER. With CABINET MAKER deleted, the heading fell to the end of the quote. The six brand categories nest under that heading, so they also vanished from their place after the cabinetry, showing only at the end under an empty $0.00 heading. Restoring CABINET MAKER puts the heading back in its original position (#101). |
| 2 rows in WINDOWS (46): WINDOWS QUOTE ($8,032.00) and FLYSCREEN QUOTE ($1,538.99), with formulas, no quantity | Between 8 Sep and 2 Oct | `withWindowsPriceListQuotation` (`windowsQuotePriceList.js`) deleted them as "placeholder rows" when the windows price list was added. |
| Sub-categories hidden on screen (data not lost) | Since September | A sub-category (e.g. the 13 under CONCRETE SLAB) only shows inside its open parent. Every parent is saved collapsed, so only top-level headings show. There was a Collapse All button but no Expand All. |

Every other row, quantity, formula and rate of the original quotation is still in the live job (see reconciliation).

## Recovery

- **Source of the original:** `2026-10-03_downloads.gr8job`, the user's own download on 3 Oct 2026 at 21:56. It is the last save before the cabinetry merge: 174 categories, 2,686 rows. Kept at `recovery/client-selection-integrity-2026-10-09/job-files/Downloads/New Job 03 09.gr8job`. The 2 window rows come from `C:\Users\grant\Documents\GR8 Jobs\New Job 03-09\New Job 03 09.gr8job` (8 Sep 2026).
- **Restore script:** `scripts/restore-original-quotation-sections.mjs`, run on a copy of the live job (revision 39, read from Chrome storage read-only).
  - It adds the missing categories and rows verbatim and sets the original category order.
  - It removes and changes nothing.
  - Edits made after 3 Oct (e.g. Waterproofing $3,750, Painter and Cleaning rates) are kept.
- **Code (so a load can never delete them again):**
  - `finalCabinetryQuotation.js`: only the CABINETRY section is rebuilt; every other section is left as it is.
  - `windowsQuotePriceList.js`: an uncharged placeholder row is kept. Only a charged placeholder, which would be charged twice, is replaced.
  - `EstimateBuilderWorkbook.js`: an **Expand All** button next to Collapse All opens every category and sub-category.
- **Tests:**
  - New: `scripts/test-quotation-original-recovery.mjs`.
  - Updated to the new rule: `test-live-cabinetry-quotation.mjs` and `test-windows-quote-price-list.mjs`. They used to assert the deletion.

## Evidence

Reconciliation by section and row ID. The files are in `E:\dev\quotation-recovery-20261108\reconciliation\`.

| Compared | Categories | Rows | Missing categories | Missing rows | Changed rows |
|---|---|---|---|---|---|
| Original 3 Oct → live revision 39 | 174 → 169 | 2,686 → 3,471 | 7 | 132 | 8 (blank rates later filled by the builder) |
| Original 3 Oct → restored | 174 → 176 | 2,686 → 3,605 | **0** | **0** | 8 (same builder edits, kept) |
| Original 8 Sep → restored | 160 → 176 | 1,873 → 3,605 | **0** | **0** | 138 (builder quantity/rate entries made 8 Sep–3 Oct, kept) |
| Live revision 39 → restored | 169 → 176 | 3,471 → 3,605 | 0 | 0 | **0** |

**Totals.** The calculated quote is unchanged at a base of $555,766.67, GST of $73,500.14 and a final total of $842,189.13, because the restored rows have no quantities. The 7 restored categories each total $0.00. WINDOWS QUOTE and FLYSCREEN QUOTE show at $0.00, and no generated flyscreen allowance is added.

**Real app.** The check ran on an isolated copy on port 3123, with every outside request and port 3000 blocked.

- **On open:** there are 65 top-level headings (64 plus CABINET MAKER). After Expand All, **176 of 176 saved categories are on screen and none is missing**. There were no page errors.
- **Restored categories:** every row shows. CABINET MAKER 44/44, BUTLERS PANTRY 30/30, LAUNDRY 15/15, BATHROOMS 14/14, WARDROBES 13/13, the two robe sections 8/8 each.
- **Order:** APPLIANCES & WHITE GOODS is #105, after WARDROBES, with its six brands. The quote ends at ELECTRICAL - CLIENT SELECTIONS (#176).
- **Save / reopen:** saving created revision 40 with 176 categories and 3,605 rows. Reopening gave the same result, with 176/176 categories shown.
- **Rows not drawn on screen:** these follow existing display rules, and the data is present.
  - Third-storey rows on a two-storey job.
  - QBSA and Q-Leave fee lines, which show on the Quote Sheet.
  - Rows the builder marked hidden.
  - CABINETRY room groups, which open by room.
  - Appliance pack headings, which are drawn as fold rows.
  - The tiling duplicate floor-waste rows share an ID, so the screen count shows one for each pair.
- **Screenshots:** `E:\dev\quotation-recovery-20261108\app-verification\`. They cover the beginning, Concrete Slab, Cabinet Maker, Butlers Pantry, Wardrobes, Appliances, Windows, Tiling and the end, for both open and reopen.

## Open decision for the owner

CABINET MAKER and its sub-categories (the original rate list, no quantities) now sit beside the newer CABINETRY catalogue (870 rows, 30 with quantities, $45,229 ex GST). Nothing is charged twice, because the original rows have no quantities. Decide whether to keep both or retire one.
