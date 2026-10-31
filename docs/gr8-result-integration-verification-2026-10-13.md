# GR8 Result Integration Verification

Continuation date: 2026-10-13. Browser job: `gr8-reconcile-test-47c50983a480` only.

## Results

| Integration | Result | Evidence or remaining blocker |
| --- | --- | --- |
| Bathroom accessory quantities | PASS | Four selected products each have quantity 3 and three locations after Save Job and full page reload/reopen. No forced quotation quantity. |
| Client Selections and quotation | PASS | Main Bathroom, Ensuite and B2 Ensuite are three distinct bathrooms; the alternate label `2nd BEDROOM ENSUITE` identifies B2 Ensuite. Brushed Nickel product IDs remain unchanged. |
| Final BOQ quantity projection | PASS | Existing pack tests verify all four projected BOQ and procurement quantities are 3, including repeated synchronization. |
| Commercial BOQ and variations | BLOCKED | No commercial project/snapshot is linked to this isolated job. Fixed both embedded pages so they cannot default to an unrelated project; verified empty disabled selectors live. |
| Variation baseline | BLOCKED | Selected pack total is $1,329 including GST against a $1,230 reference allowance. The $99 difference is not an approved variation: all four quotation rows retain `BASELINE_UNVERIFIED` and null posted variations. A verified inclusion baseline is required. |
| Plumbing contract, milestones and payment | PASS | One $58,270 contract; milestones $14,567.50, $23,308 and $20,394.50; one payment event for $14,567.50 survives reopen. Original five audit actions retained. |
| Internal procurement commitment | PASS | One internal draft, three milestones, $58,270 commitment and $14,567.50 paid; zero supplier POs. |
| Managed supplier draft conversion | BLOCKED | Implementation and 11 payload checks pass. Live conversion correctly disabled: assign a real subcontractor and link a matching commercial project/snapshot. No order was created, issued or sent. Concurrent line-insert protection also requires the existing migration's database application to be verified in an authorised database change. |
| Job Board milestone completion | BLOCKED | Engine tests pass, including intermediate status persistence and completion eligibility without claims/approval/payment. The isolated contract has no linked Job Board job; no unrelated board was edited. |
| Gantt payment forecasting | BLOCKED | Engine tests pass for activity-end dates, schedule moves and paid/approved locks. Fixed Gantt to prefer the stable workbook job ID. Live job has no saved draft or approved schedule; no actual construction dates exist to verify. No artificial schedule generated. |
| Cash Flow accounting | PASS | Live commitment $58,270; forecast $43,702.50; claimed $0; open approved $0; paid $14,567.50; remaining $43,702.50. Plumbing is counted once in outgoing costs. |
| Dated Cash Flow forecasts | BLOCKED | Rough-in and fit-off correctly remain unscheduled until actual Gantt activities are saved. Paid underslab remains dated 2026-10-11. |
| Browser save, hard refresh and reopen | PASS | Saved browser record at 2026-10-12T20:47:12.025Z; subsequent full navigations restored quantities, totals, contract and payment audit. The package file itself was not rewritten. |
| Sustained development-server memory stability | BLOCKED | Server is responsive, but memory remains high and no controlled long-duration comparison or heap profile was captured. Measurements below are observations, not proof of a resolved leak. |

## Quotation Reconciliation

- Previous hydrated subtotal: $587,277.53; corrected subtotal: **$586,874.81**.
- Reduction: **$402.72**, representing one duplicate Brushed Nickel set at current ex-GST component rates.
- Previous final total: $889,939.56; corrected final total: **$889,329.29**; reduction $610.27 after existing markups, GST and commission.
- Accessory IDs: `master-PLB-HNC-NE0381241`, `master-PLB-HNC-NE03541`, `master-PLB-HNC-NE03641`, `master-PLB-HNC-NE02141`.
- Preserved the existing alias-normalisation fix and added serialized reopen and production `normalizeWorkbook` regressions.

## Changes In This Continuation

- Require an authenticated UUID actor and verify the loaded snapshot's actual project before managed draft conversion.
- Retain a partially created unissued draft header for idempotent retry rather than deleting a header another request may have adopted.
- Respect embedded job/project/snapshot context in BOQ and Variations; retain standalone page behaviour.
- Persist Job Board intermediate work-status changes, not just completed/reopened milestones.
- Prefer stable `workbook.jobId` for Gantt persistence.
- Enable the installed Next.js-supported `experimental.webpackMemoryOptimizations` setting.

## Memory Evidence

| Phase | Server PID | Working Set MiB | Private MiB |
| --- | --- | ---: | ---: |
| Initial existing worker | 13936 | 4,029.9 | 6,934.9 |
| Before config change | 13936 | 4,186.3 | 7,904.9 |
| Automatic Next.js config reload, cold worker | 25448 | 423.6 | 755.2 |
| Recompiled quotation | 25448 | 3,302.9 | 3,438.2 |
| Warmed selections and commercial checks | 25448 | 3,627.5 | 5,319.2 |
| Final warmed navigation | 25448 | 4,076.9 | 5,845.2 |

- Browser resource timing and disk measurements agree: Estimate Builder dev chunk 45.32 MiB; shared app chunk 9.61 MiB. Other emitted chunks include Product Library 31.88 MiB and Document Editor 19.56 MiB.
- Large module graphs/bundles and recompilation are supported contributors. File-watcher churn, retained browser sessions and specific heap retention were not conclusively isolated.
- The memory option is documented by Next.js and validated through the installed development config loader. Config editing triggered Next.js's automatic worker restart; no server was started from a terminal.
- Observed final private memory is lower than the pre-change peak, but restart and differing warm-up invalidate a controlled A/B claim. Oversized chunks remain.
- Initial reload timed out during recompilation; later isolated-job HTTP requests returned 200 and browser reload/reopen succeeded.

## Validation

- PASS: `test-selection-packs.mjs`, including products, three locations, BOQ/procurement quantities and serialized reopen.
- PASS: `test-quotation-builder-save-reopen-regression.mjs`, 9 checks including production hydration.
- PASS: `test-managed-subcontract-po.mjs`, 11 checks.
- PASS: `test-trade-payment-schedule.mjs` and `test-trade-payment-integrations.mjs`.
- PASS: `test-job-context.mjs` and scoped ESLint/VS Code diagnostics.
- Existing Gantt hook-dependency lint warning remains; no new lint errors.
- No database migration was applied in this session. The database application of `supabase/migrations/20261013000100_builder_trade_subcontract_purchase_orders.sql` was not verified; its indexes are required for concurrent supplier-line uniqueness.
- Client Selections still logs an inclusion-snapshot UUID query error for the local non-UUID job ID; its embedded selection data loads. Commercial snapshot verification remains blocked, not bypassed.

## Protected Data

- Protected recovered job, fresh recovery export and working backup all retain SHA-256 `72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088`.
- Isolated source package retains SHA-256 `10bc4710c7cf02778b982e61073001eab2ff9fa1832ed8050b3c580fcafdaf68`.
- Active isolated package retains SHA-256 `821adadd65ec2bcf45f18549b62cfd30544f6e1349dbe12279e75e54ed476f46`.
- Existing code changes were preserved. No commit, push, merge, deployment, recovery deletion or worktree reset occurred.