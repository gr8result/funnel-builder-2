# GR8 Result Post-Reset Verification

Financial acceptance: **BLOCKED**. Neither the $28,988.88 nor $49,034.12 proposal was applied. The protected job `recovered-03-09-123` and its recovery backups were not saved or changed.

## Ownership And Preservation

- Five Codex app-server processes and two Claude processes were observed alongside the externally started Next.js process tree. Process presence does not identify which files an agent currently owns.
- This continuation is confined to `scripts/test-window-reconciliation-report-browser.mjs`, the new `scripts/audit-post-reset-selection-reconciliation.mjs`, this report and separate post-reset evidence folders. No shared application, workbook hook, Product Library, BOQ or procurement page was edited.
- No designated ownership register was found in the inspected root, `.github`, `.claude` or `.vscode` coordination surfaces. Shared-module repairs require coordination with their active owners before editing; no competing register was created.
- Dirty and untracked work was preserved. No reset, clean, revert, checkpoint restore, commit, push, merge, deployment, server restart or database write was performed.
- Every data-audit run asserts the original, isolated package, fresh recovery export, recovery job-file copy and working backup hashes. Protected SHA-256 remains `72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088`.

## Browser Verification

**FAIL / BLOCKED before quotation hydration.** The existing server listens on port 3000, but the isolated quotation route returns HTTP 500 with body `Internal Server Error`. Two disposable-profile runs reproduced this. Neither reached procurement refresh or Save Job. External writes were intercepted, and the protected source hash was checked after the failed retry.

The earlier downstream wait was invalid: BOQ and the supplier hub do not receive the quotation component's `sheet` prop. The harness now waits for actual page headings and returns to quotation to verify persisted financial content and all procurement groups. It also visits the actual Procurement Schedule rather than counting the supplier navigation hub as a procurement test. No application test hook or weaker component-only fallback was introduced.

The harness change has not passed an end-to-end run because the server fails earlier. October 14 save, hard-refresh and reopen evidence remains historical, not a renewed acceptance result.

- [First post-reset browser failure](../artifacts/test-artifacts/window-reconciliation-post-reset-20261015/browser-report.json)
- [Retry failure and protected hash check](../artifacts/test-artifacts/window-reconciliation-post-reset-20261015-retry/browser-report.json)

## Window Acceptance

Fresh production-function checks use read-only package inputs and isolated in-memory proposals. They do not claim that the protected commercial data was synced.

| Criterion | Result |
| --- | --- |
| Physical schedule coverage | PASS: 26 windows and 4 glazed doors; 30 unique physical IDs |
| Quotation treatment | PASS for identification: 28 saved-target openings in 12 priced groups; two generated unsaved fixed-window placeholders |
| Duplicate charges | PASS: zero duplicate charged window groups |
| Screens | PASS for preservation: 28 screens, $5,252.85 ex GST; unchanged by first and repeated proposal |
| Repeat reconciliation | PASS for window economic identity and whole-proposal calculated total; no persisted changes |
| Calculated final BOQ projection | PASS: all 30 physical openings map to their dimensional groups |
| Saved commercial BOQ | BLOCKED: zero window-linked rows in the protected package; projection is not commercial persistence |
| Saved procurement | BLOCKED: zero window-linked saved requirements in the protected package |
| Supplier RFQ | FAIL: 28/30 represented; missing Hallway/Passage double hung 1800H x 600W (`1789845033591.3105`) and Laundry glazed sliding door 2100H x 1500W (`1789845050757.7505`) |
| Fixed-window prices | BLOCKED: Kitchen 650H x 3000W and Pantry 650H x 1800W have no verified supplier prices; remain unpriced |
| Save, hard refresh and reopen | NOT REVALIDATED: browser run fails at quotation HTTP 500 |

No supplier screen bundling, insect/barrier-screen equivalence, fixed-window price or financial approval was inferred. All 30 openings, grouped quotation quantities and each downstream gap appear in the [fresh opening ledger](../artifacts/test-artifacts/post-reset-selection-reconciliation-20261015/thirty-opening-downstream.csv).

## All 52 Selected Identities

The current Product Library was read with a tenant-filtered SELECT on `builder_products` for workspace `846885cd-25b9-4eca-b9f9-3fd02f5882d8`. It returned zero private products. Current static master products were matched by exact identity and their established price resolver was used. No live private price override was assumed, created or changed.

| Snapshot | Quote rows | Priced audit outcomes | Blocked | Missing procurement representations |
| --- | ---: | ---: | ---: | ---: |
| Protected saved export | 3,469 | 12/52 | 40 | 29 |
| Isolated saved progress-allocation package | 3,531 | 12/52 | 40 | 29 |
| Historical browser revision 10 | 3,538 | 17/52 | 35 | 15 |

The last row is October 14 narrative evidence, not a browser snapshot revalidated in this continuation. It must not replace the fresh package counts. The 12 current priced audit outcomes also have positive calculated canonical-product rows; this is not a certification of all supply scopes, current supplier prices or downstream commercial records.

Current blocked classifications are **12 missing verified price, 25 missing target and 3 ambiguous mappings**. All 52 identities lack a verified persisted commercial BOQ representation in the inspected packages. No approved package inclusion or verified replacement outcome was established.

Each CSV row includes selected identity, current exact Product Library match and resolved price/GST basis, saved quantity JSON paths, calculated quantity owners, saved and calculated quotation rows, existing allowances/charged trade scope, proposed row-change references and amounts, BOQ projection versus persisted BOQ, procurement IDs, blocker reasons and unresolved net-impact status.

- [Protected export: 52 identities](../artifacts/test-artifacts/post-reset-selection-reconciliation-20261015/protected-52-identities.csv)
- [Isolated package: 52 identities](../artifacts/test-artifacts/post-reset-selection-reconciliation-20261015/isolated-52-identities.csv)
- [Machine-readable evidence, all snapshots and blockers](../artifacts/test-artifacts/post-reset-selection-reconciliation-20261015/report.json)

## Financial Reconciliation

The application-equivalent proposal was reproduced against current static master lookup plus the tenant-filtered live lookup. It still proposes $840,295.17 -> $889,329.29. This is an isolated calculation, not a saved quotation or approval.

| Component | Unapplied difference |
| --- | ---: |
| Base line items | $32,357.97 |
| Overheads | $1,617.90 |
| Margin | $3,235.80 |
| Profit | $5,581.75 |
| GST | $4,279.34 |
| Sales commission | $1,961.36 |
| Final calculated quotation | **$49,034.12** |

The base-cost ledger accounts for every cent:

| Change class | Ex-GST difference |
| --- | ---: |
| Proposed new rows, not approved | $28,921.34 |
| Existing-scope quantity/rate increases | $7,593.90 |
| Existing-charge reductions needing scope review | -$3,800.00 |
| Product replacement/identity changes | -$87.27 |
| Removed/ambiguous identities needing review | -$270.00 |
| Base total | **$32,357.97** |

The [81-row substantive proposal ledger](../artifacts/test-artifacts/post-reset-selection-reconciliation-20261015/proposal-row-changes.csv) preserves separate occurrences, matches by section/item/ID where unambiguous, and totals the delta once. It is not a replacement of October 14's 112-row diagnostic ledger: that included zero-cost rate changes and different duplicate-ID pairing. Unmatched changes are explicitly retained rather than attributed to a selected identity without evidence. Shared row impacts must not be summed once per identity.

**Corrected exposure conclusion: verified net missing cost is UNKNOWN, not $49,034.12 or $10,297.10.** The $10,297.10 is only the gross selected value supported by saved quantity/price/GST fields among blocked package outcomes. It is not net incremental exposure. For example, an internal-door selection says quantity 1 / $99 ex GST while the actual dimensional calculator already charges 16 doors / $1,728; adding $99 would not establish a missing door charge. Towel accessories, skirting, architraves, drainage, floor wastes, appliance installation/cabinetry and other trade scope also require quantity, unit, allowance and duplication review. No allowance credit, upgrade or unknown price was invented.

## Remaining Decisions And Defects

1. Obtain the externally managed Next.js terminal's actual server exception and restore HTTP 200 for the isolated quotation route. Do not clean another session's build or start a duplicate server. The observed `.next-dev/server/pages-manifest.json` was empty; this is diagnostic context, not proof of a particular root cause.
2. Coordinate ownership of `pages/modules/builders/procurement-schedule.js`. It accepts `workbook` but ignores embedded commercial project/snapshot props and defaults to the first available project/snapshot. Unlike BOQ, it does not fail closed to the active isolated job. Repair and isolated regression coverage are required before commercial procurement acceptance; no unrelated project should be selected or modified.
3. Refresh/reconcile the two stale supplier RFQ opening entries through the owning window workflow on an isolated copy, then verify exactly-once physical IDs and dimensional quantities. Do not issue an RFQ or change the protected source.
4. Obtain verified Dowell prices for both fixed windows and confirmation of opening-price screen inclusion. Confirm whether glazed-door barrier screens differ from the current insect-screen allowance.
5. Review every unresolved product's saved quantity owner, exact catalogue identity, price/GST basis, existing allowance and target. A schedule/brand marker is not a priced physical SKU. Verify the inclusion baseline before any replacement/variation approval.
6. Link the correct isolated commercial project/snapshot and verify actual saved BOQ and procurement requirements, supplier RFQ coverage, save/refresh/reopen and idempotence. The earlier local refresh result is not a substitute for persisted commercial acceptance.
7. Revalidate the later browser revision and its payment evidence without replacing it with the older package. Then reconcile the 17/52 narrative count with current saved state.

## Verification Performed

- The new audit ran successfully after each substantive edit. Assertions cover 52 identities per snapshot, exact source/backup hashes, tenant scope, read-only database methods, proposal cent reconciliation, all 30 opening IDs, 26/4 classification, 28 matched targets/two unsaved placeholders, $5,252.85 screen preservation and repeated window financial parity.
- Editor diagnostics reported no errors for either script.
- Two real-route disposable browser attempts failed on the same server HTTP 500. No passing full-browser result is claimed.
- The protected job, isolated source and all checked recovery backups retain their recorded hashes. No financial increase or job write was performed.

Next executable task: obtain/fix the external server exception, then rerun `node scripts/test-window-reconciliation-report-browser.mjs --output=artifacts/test-artifacts/window-reconciliation-post-reset-20261015-next` against the existing server. Shared application repairs remain subject to ownership coordination and the commercial/supplier approval gates above.