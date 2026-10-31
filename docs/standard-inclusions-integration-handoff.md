# Standard Inclusions Integration Handoff

This is a module handoff request, not a replacement ownership register. Shared
edits remain subject to the designated integration owner's register.

## Identified Sessions

- Quotation Builder: `8023d671-37e1-4c62-a4f8-789aaff262af`.
- Client Selections: `03bfaf29-6fc2-45cd-957c-4842e195f321`.
- Product Library/test environment: `8be7b5fb-9402-4994-895b-30b224789d3e`.
- Standard Inclusions: `4aabcb20-0e9c-4a1e-be3b-4207807a1aa2`.

Session history identified these assignments; it is not confirmation that the
owners received a message. The available tools cannot message existing sessions.

## Owner Review Required

1. `pages/modules/builders/selections-book.js`: hydrate the job's exact
   `jobInclusionSnapshot` through its existing guided requirement/room helpers
   before showroom defaults. The current general preload is absent; existing
   standard-range materialisation only covers its configured plumbing ranges.
   Preserve explicit client/manual decisions, room IDs and approved allowances.
   An included oven must appear without a client selecting it first.
2. `hooks/estimate-builder/useEstimateBuilderWorkbook.js`: the existing
   `applySelectionBaseline(snapshot, foundation)` saves the same baseline consumed
   by quotation and selection adapters. Review auto-consumption of an assigned
   project's `standardScheduleSnapshot.jobInclusionSnapshot`, via the existing
   `/api/builders/project-inclusions` endpoint, with conflict/no-op checks from
   `lib/standard-inclusions/jobBaseline.mjs`. Do not reset job identity or alter
   quantity ownership.
3. `components/estimate-builder/EstimateBuilderWorkbook.js`: review exposing its
   existing `SelectionBaselineControl` on Quotation Builder as well as Client
   Selections. Keep the current shared rendering changes intact.

## Implemented Contracts

- `SelectionBaselineControl.jsx` lists exact published PDF-version snapshots and
  applies them via the existing save callback. It pins the associated commercial
  project through the existing assignment endpoint and rejects baseline conflicts.
- `upgradeVariation.mjs` matches saved choices to pinned baseline products, flags
  unknown price/tax/quantity/mapping, and prices the difference using the existing
  workbook calculator. It does not mutate the quotation.
- The existing Variations page prepares and saves upgrade drafts in the existing
  tables. Deterministic draft IDs prevent repeated saves of the same replacement
  against the same job and baseline, including across estimate snapshots.
- `upgrade-variation.js` permits owner/admin builder review and portal issue.
  Builder review leaves the variation draft; issue leaves it submitted and unpaid.
- The existing portal approval handler updates accepted/rejected upgrade records.
  Approved deltas remain separate from the baseline quote so they cannot also be
  added to the quotation as a second charge. Acceptance is not payment.

## Acceptance Gate

No live end-to-end pass is claimed. The existing server at localhost:3000 timed
out from a read-only terminal request; the shared browser loads the current UI
but remains on the schedule loading request. The user alone manages that server.
No server processes, ports, migrations or production data were managed or changed.

The isolated test environment belongs to the Product Library session's approved
setup workflow. Use only its approved test database/workspace for write acceptance;
do not create demo schedules or jobs in the user's original workspace.