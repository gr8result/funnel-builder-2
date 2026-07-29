# Inclusions Selections Stage 4 Review Variations

Date: 2026-07-30

## Route

`/inclusions-selections/review`

Stage 4 replaces the review placeholder with the builder review, pricing and draft variation workspace.

`/inclusions-selections/approvals` is present only as the next-stage placeholder and states: "Client and builder approvals will be completed in the next stage."

## Purpose

Stage 4 is a review and validation projection over Stage 3 records. It loads ProjectAreas, ProjectRequirements, ProjectSelections and SelectionLocations, then derives summary totals, issue state, room/category review groups, client preview values, internal builder values and Ready for Approval status.

It does not duplicate selections or create a separate pricing system.

## Summary Calculations

`calculateProjectReviewSummary` derives totals from actual Stage 3 records:

- area and requirement counts
- complete, incomplete, optional pending, Not Applicable and needs-attention counts
- missing and provisional pricing counts
- custom and unavailable product counts
- total allowance, selected value, credits, upgrades, net draft variation and GST
- Ready for Approval state

## By Room Review

`calculateRoomReview` groups review lines by AreaGroup and ProjectArea. It displays ProjectLevel, AreaType, effective tier, requirement counts, room totals and issue counts. Edit actions return to `/inclusions-selections/workspace` with area and requirement context.

## By Category Review

`calculateCategoryReview` groups the same ReviewLine records by RequirementCategory. Every line retains ProjectArea and ProjectRequirement identity. No category-only selection records are created.

## Variation Calculations

`calculateVariationSummary` separates included/no-change selections, upgrades, credits, missing prices, provisional prices and excluded or Not Applicable items. Totals are shown in AUD by default and remain draft values only.

## Pricing States

Supported review pricing states are:

- Confirmed
- Provisional
- Allowance Only
- Price Missing
- Supplier Quote Required
- Manual Price
- Expired Price
- Unavailable Product

Pricing metadata lives on selection/product reference types and remains behind adapter/repository boundaries.

## Client Projection

`buildClientVariationProjection` exposes only client-facing values: allowance, selected value, credits, upgrades, net variation, GST and client-visible notes. It includes the warning: "Draft only - not approved or contractual."

Builder cost, markup, margin, supplier rebate and internal notes are not included in the client projection.

## Builder Internal Projection

`buildBuilderInternalProjection` is clearly labelled "Internal Builder View" and includes builder cost, supplier, supplier SKU, markup, client price, allowance, margin impact, quantity, price source, internal notes and missing information.

Permission enforcement for this internal view is deferred until application permission infrastructure is connected.

## Issue Register

`generateReviewIssues` creates stable ReviewIssue IDs with severity, scope, title, description, resolution action and blocking status. Blocking issues cannot be dismissed. Warnings can be acknowledged with a reason.

Issue types include missing required selections, missing variants, invalid quantity/unit, missing price, expired/provisional prices, missing suppliers, unavailable products, inactive products, compatibility conflicts, cross-scope records, duplicate SelectionLocations, Not Applicable reason problems and incomplete custom selections.

## Custom Selection Review

Manual custom selections are shown separately with structured product details, supplier fields, quantities, pricing and issue state. A visible "Save to Product Library" placeholder is present, but Product Library mutation is not implemented.

## Allowance Overrides

`overrideAllowance` recalculates draft variation, records previous and new allowance values, requires a reason and creates a review audit event. Overrides do not silently change approved contract values because approvals and snapshots do not exist in this stage.

## Ready For Approval

`markReadyForApproval` validates that no blocking review issues remain, saves review state, records an audit event and marks the project Ready for Approval. This is not final approval and does not lock or snapshot records.

If Stage 3 selections or locations change after readiness is saved, the review fingerprint becomes stale and readiness is revoked on reload.

## Persistence

Stage 4 uses `SelectionReviewRepository` with an in-memory implementation for review state, issues, allowance overrides and audit events. Production database persistence and migrations are deferred.

## Validation

`validateReviewReadiness` blocks readiness when unresolved blocking ReviewIssues remain. Stable error codes are returned for user-readable validation summaries.

## Responsive Behaviour

The review route uses focused responsive panels. Desktop can show dense review grids and rows; tablet stacks panels; mobile collapses review rows into single-column cards.

## Tests

`src/modules/inclusions-selections/tests/selectionReview.test.ts` covers review loading, summaries, room/category projections, pricing, issues, custom selections, allowance overrides, Ready for Approval, persistence and route isolation.

The Stage 4 test runs through `src/modules/inclusions-selections/tests/runDomainFoundation.mjs` with Stages 1-3.

## Deferred Work

The following remain future stages:

- client approval
- builder approval
- immutable snapshots
- final selection schedule documents
- Estimate Builder export
- procurement export
- production database migrations
