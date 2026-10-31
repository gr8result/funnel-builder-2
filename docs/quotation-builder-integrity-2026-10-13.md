# Quotation Builder Integrity Report

Date: 2026-10-13. Live job: `gr8-reconcile-test-47c50983a480` only.

**Release status: BLOCKED.** Quotation-owned load/save safeguards are implemented and verified. Independent-sheet calibration fails in the AI Takeoff export contract; a real builder inclusion baseline still requires approval. This report is not an unconditional guarantee of all upstream data or a final issued quotation.

## Exact Row-Count Reconciliation

The reported increase is accounted for by two distinct operations:

| Operation | Added | Removed | Resulting rows |
| --- | ---: | ---: | ---: |
| Historical saved quotation | 0 | 0 | 2,686 |
| Replace seven legacy cabinetry sections with the approved full catalogue | 870 | 132 | 3,424 |
| Add electrical Client Selections rows | 45 | 0 | 3,469 |

The 132 replaced cabinetry rows belong to:

| Saved section | Removed rows |
| --- | ---: |
| STANDARD WARDROBES COMPLETE (2.4M WIDE) (90) | 8 |
| STANDARD 3 DOOR ROBE UP TO 3.6M WIDE | 8 |
| CABINET MAKER | 44 |
| BUTLERS PANTRY | 30 |
| LAUNDRY | 15 |
| BATHROOMS | 14 |
| WARDROBES | 13 |

Catalogue alternatives and headings are not the same as additional priced charges. The row-by-row comparison records every added/removed row and its stored fields. The cabinetry replacement code is `reconcileCabinetryQuotation` in `lib/construction-estimation/finalCabinetryQuotation.js`; it previously ran from a React effect whenever the workbook changed.

Later legacy hydration of the 3,469-row package does the following:

| Stage | Row count | Observed operation |
| --- | ---: | --- |
| Schema and cabinet-schedule migrations | 3,469 | No quotation row-count change |
| Trade structure normalisation | 3,531 | Net +62; moves, ID repairs and subheadings; reports include 104 added IDs and 42 removed IDs |
| Painter/electrical updates | 3,531 | Existing row fields changed |
| Tiling connector | 3,518 | Removes 13 rows and moves 39 |
| Flooring connector | 3,530 | Adds 12 and moves 39 |
| Appliance connector | 3,534 | Adds 4 |
| Allocated product connector | 3,535 | Adds 1 and moves 26 |
| External-lighting connector | 3,538 | Adds 3 |
| Exterior paint/trade structure/final cabinetry | 3,538 | Field/section changes, no further net additions |

ID removals are not automatically physical-row loss: the legacy normaliser also repairs colliding identities. Full old/new fields and explicit identity-repair records are retained in the JSON reports.

## Row-By-Row Evidence

Reports contain source hashes, full saved rows, per-stage field changes, additions/removals/moves, duplicate identities, ordering and repeated-reopen results:

- [Historical 2,686-row package](../artifacts/test-artifacts/quotation-hydration-integrity/e233d67b8c31-report.json)
- [Recovered 3,469-row package](../artifacts/test-artifacts/quotation-hydration-integrity/72bdbb4bbee9-report.json)
- [Consolidated isolated 3,531-row package](../artifacts/test-artifacts/quotation-hydration-integrity/821adadd65ec-report.json)
- [Historical-to-recovered comparison proving 3,424](../artifacts/test-artifacts/quotation-hydration-integrity/e233d67b8c31-to-72bdbb4bbee9.json)
- [Historical-to-consolidated comparison](../artifacts/test-artifacts/quotation-hydration-integrity/e233d67b8c31-to-821adadd65ec.json)
- [Failing independent-calibration owner probe](../artifacts/test-artifacts/quotation-hydration-integrity/calibration-owner-contract.json)

Audit command: `node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/audit-quotation-hydration.mjs <package paths>`.

Only isolated in-memory identities are passed to production normalisation. Package files are read-only, and their hashes are checked before/after. Output files are separate from every job package.

## Implemented Safeguards

- Existing quotation rows are authoritative on ordinary load. Selection connectors, catalogue repricing, trade regrouping and painter-formula replacement no longer run implicitly on open.
- `allowQuotationHydration: true` retains the legacy path for explicit diagnostics/migration testing, not automatic reopening. Such a migration still requires review; this flag is not an approval mechanism.
- Removed the React effect that replaced the cabinetry catalogue or reapplied quantities on arbitrary workbook changes. Explicit baseline, selection and cabinetry actions remain.
- Existing row IDs, economic fields and formulas are preserved. Missing stable IDs and saved order metadata are initialized; persisted array/section order is restored without catalogue regeneration.
- Existing builder-specific template keys/names survive save/load instead of being replaced by the master template binding.
- Exact section-name mapping coordinates are translated to existing persisted section IDs at the quotation boundary; shared mapping records are not mutated and unknown targets are not guessed.
- Added read-only revision comparison with mandatory matching builder/job identities and rejection of ambiguous within-section row IDs.
- Restoring a prior revision now previews differences, requires confirmation, reads only the current job and selected revision, and does not replace editor state before a verified save succeeds.

## Tests And Live Evidence

Passing focused suites:

- `test-quotation-builder-save-reopen-regression.mjs`: 13 checks.
- `test-quotation-order-persistence.mjs`: 11 checks, including recovered-file rows and export/reopen.
- `test-selection-quote-engine.mjs`: 15 checks; ten categories include real ZIP export/import, replayed confirmations/baselines, quantity/formula preservation and upgrades/downgrades.
- `test-quotation-target-resolver.mjs`: idempotent explicit reconciliation, no guessed mapping and no duplicate mapped product charge.
- `test-job-schema-evolution.mjs`: all A-H pass, including order, progress allocations, claims and audit.
- `test-estimate-builder-calculations.mjs`, `test-job-backup-load-compatibility.mjs`, `test-job-context.mjs`, `test-job-dirty-signature.mjs`, `test-job-streaming-checksum.mjs`.
- `test-takeoff-sheet-level-import.mjs`, `test-takeoff-opening-schedule.mjs`, `test-takeoff-architrave-and-plasterboard.mjs`, `test-takeoff-review-and-evidence.mjs`, `test-job-setup-takeoff-import-sheetlevels-safety.mjs`, `test-window-schedule-canonical-projection.mjs`.
- `test-final-quotation-boq-filter.mjs` and `test-trade-payment-schedule.mjs`.
- Scoped ESLint and VS Code diagnostics: no errors. One existing hydration-effect dependency warning remains.

Ordinary reopen preserves economic data in all three real packages: 2,686 stays 2,686; 3,469 stays 3,469; 3,531 stays 3,531. Subsequent opens produce zero row-field changes. Historical first-open additions to `sortOrder`, `sortSection` and `sortSectionId` are recorded separately from economic data.

Live Save Job and hard reload/reopen retained 3,538 rows and quotation SHA-256 `46bdf33df2ef9ae1f7a5cf01f1952dec29a252c381306120879ecd834dc2d5f1`. Subtotal remained **$586,874.81**; final total **$889,329.29**. The $58,270 plumbing contract retained exactly one $14,567.50 payment event. An unchanged save did not create a new content revision.

The live restore preview for revision 8 showed 3,538 -> 3,538 rows, with zero added/removed/changed/reordered rows. It was cancelled; quotation hash and revision 9 remained unchanged. A destructive revision write was deliberately not exercised in the browser. Serialization, checksum and comparison restoration contracts were tested offline.

## Remaining Defects And Owner Handoff

1. **FAIL, AI Takeoff owner:** `createTakeoffSchedule` exports one global scale for all sheets. Probe inputs 1 px/mm and 2 px/mm become 1 and 1. Two 1,000 x 1,000 pixel Living polygons therefore export 2 m2 instead of 1.25 m2. Accept and propagate the per-sheet calibration map through measurement records, floor/roof polygons, wall lengths, opening associations and the Job Setup export. Quotation must not certify imports until this probe passes. No AI Takeoff payload code was changed in this task.
2. **BLOCKED, Client Selections owner/builder:** The isolated job lacks a verified production Standard Inclusions baseline. Confirm the builder's schedule, version, products, mapping coordinates and price/GST basis. Engine fixture tests are not approval of the job's reference allowances or its $99 accessory difference. Preserve the baseline snapshot and require confirmed selection events before committing replacement/pricing changes.
3. **BLOCKED, historical identity review:** Both historical packages contain 41 globally repeated ID groups, including stage-labour, appliance and tiling identities. The consolidated isolated package has zero. Ordinary open deliberately does not delete or rename historical rows. An explicit reviewed migration must account for all references and decide whether any repeated priced rows are true duplicate charges.
4. **Unsafe legacy migration remains diagnostic-only:** Direct legacy cabinetry replacement keeps a restricted list of inputs; it does not preserve every legacy/custom row or all manually edited rates/formulas. Automatic invocation is removed. Do not use it as an unattended production migration.
5. **Not executed live:** Destructive revision restoration and a simultaneous two-user browser conflict. Comparison/cancellation, isolated save/reopen and fail-closed conflict primitives pass; live concurrency acceptance remains a separate gate.

The handoff specifies verified contracts and failing fixtures; no separate owner agent or external owner approval was obtained.

## Final Integration Checklist

| Priority | Result |
| --- | --- |
| 1. Reconcile 2,686 -> 3,424 | PASS: 870 cabinetry additions minus 132 replacements |
| 2. Identify hydration mutations | PASS: per-stage, row-by-row reports |
| 3. Prevent ordinary open/refresh/save changes | PASS: real-copy assertions and live hash equality |
| 4. Preserve manual data and order | PASS: economic fields, formulas, IDs and order gates |
| 5. Verify all takeoff imports | PARTIAL: wall/opening/window/door/level tests pass; independent scales fail |
| 6. Independent plan-sheet calibration | FAIL: recorded owner probe |
| 7. Builder-specific inclusion baseline | Engine/binding PASS; production baseline BLOCKED |
| 8. Exactly-once confirmed selection replacement | Engine/replay/mapping PASS; real confirmation workflow needs owner acceptance |
| 9. Upgrade/variation differences | Fixture calculations PASS; unverified production allowances not approved |
| 10. No duplicates, missing rows or unapproved repricing | Isolated quotation PASS; historical identity/charge migration BLOCKED |
| 11. Restore and compare revisions | Comparison/preview/cancellation PASS; destructive live restore not executed |
| 12. Save/reopen, conflicts and isolation | Unit/serialization/isolation and live reopen PASS; two-user live conflict pending |
| 13. Reliable later BOQ output | Projection/filter PASS; final issuance BLOCKED by upstream gates above |

## Changed Files

- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`: authoritative hydration, tracing, removal of render-driven catalogue changes, template preservation, mapping binding and revision confirmation.
- `lib/construction-estimation/quotationRevisionComparison.js`: new read-only revision comparator.
- `scripts/audit-quotation-hydration.mjs`: new read-only real-job reconciliation and calibration owner probe.
- `scripts/test-quotation-builder-save-reopen-regression.mjs`: preservation, stable identity, binding and comparison coverage.
- `scripts/test-quotation-order-persistence.mjs`: preserve saved sections by default; explicit migration tested separately.
- `scripts/test-selection-quote-engine.mjs`: persisted-order comparison, exact-name mapping binding and replay checks.
- This report and generated evidence under `artifacts/test-artifacts/quotation-hydration-integrity/`.

Existing changes in all files were preserved. The original New Job 03/09, fresh recovery export and working package retain SHA-256 `72bdbb4bbee9ffe20dd9c9d2d4d55018c2e49e66efcc3215a07059f73f6c1088`. The historical package retains `e233d67b8c31e51c028b36052f8b2bf5aba2f35c94c8f4be60f9fca754f80456`; the isolated package retains `821adadd65ec2bcf45f18549b62cfd30544f6e1349dbe12279e75e54ed476f46`. No commit, push, merge, deployment, original-job write or recovery deletion occurred.