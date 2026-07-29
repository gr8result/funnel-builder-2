# Inclusions Selections Architecture

Date: 2026-07-29

## Boundary

`src/modules/inclusions-selections` is the only active replacement boundary. It contains domain code only: types, pure services, repository interfaces, fixtures, and tests.

The module must not import from:

- retired Client Selections pages,
- Guided Selections pages or components,
- Selections Book pages,
- legacy Inclusions Schedule API/page code,
- `lib/builders/selectionBudget.js`.

## Top-Down Flow

1. A project owns explicit areas and rooms.
2. Each area has an area type and area group.
3. Area templates generate required selection requirements.
4. Inclusion tiers define default allowance/product intent.
5. Product references can satisfy requirements only when compatibility matches.
6. Selections resolve from inherited defaults unless overridden.
7. Pricing calculates cost, sell, allowance variance, and tax.
8. Builder and client approvals allow a selection set to lock.
9. Locked snapshots freeze the selected product identity and pricing.
10. Estimate export adapts a locked snapshot into estimate lines.

## Non-Goals In This Phase

- No visible UI outside the approved stage-one Create Selection Areas route.
- No API routes.
- No database migrations.
- No Estimate Builder integration.
- No Product Library schema cleanup.
- No migration or deletion of historical selection data.

## Stage-One Route

`/inclusions-selections/areas` is the first visible replacement workflow. It creates the project area register from standard area groups, standard area types, project levels and optional custom areas. `/inclusions-selections/templates` exists only as the next-stage placeholder.

The route writes through `ProjectAreaRegisterRepository`. Until a database migration is approved, the active repository is the in-memory implementation and drafts persist only for the current application lifecycle. The route must not import retired selections modules, Product Library modules, Supplier Library modules or Estimate Builder modules.

## Services

- `validateProjectAreas`: validates explicit project area structure.
- `generateRequirementsForArea`: turns an area template into project requirements.
- `resolveEffectiveSelection`: applies default inheritance precedence.
- `previewApplySelection`: previews bulk application without mutating records.
- `calculateSelectionPricing`: computes commercial values.
- `canLockSelectionSet`: requires builder and client approvals for required selections.
- `createSelectionSnapshot`: freezes approved selection lines.
- `createEstimateSelectionExport`: aggregates locked snapshot lines for estimating.
