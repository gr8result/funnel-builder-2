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

- No API routes.
- No database migrations.
- No Estimate Builder integration.
- No Product Library schema cleanup.
- No migration or deletion of historical selection data.
- No client approval, final document, locked snapshot, procurement export or Estimate Builder export workflow from the workspace.

## Stage-One Route

`/inclusions-selections/areas` is the first visible replacement workflow. It creates the project area register from standard area groups, standard area types, project levels and optional custom areas.

The route writes through `ProjectAreaRegisterRepository`. Until a database migration is approved, the active repository is the in-memory implementation and drafts persist only for the current application lifecycle. The route must not import retired selections modules, Product Library modules, Supplier Library modules or Estimate Builder modules.

## Stage-Two Route

`/inclusions-selections/templates` is the second visible replacement workflow. It assigns AreaTemplates and InclusionTiers to the Stage 1 ProjectAreas, previews generated ProjectRequirements, reconciles them safely and saves the template stage configuration.

## Stage-Three Route

`/inclusions-selections/workspace` is the third visible replacement workflow. It loads Stage 1 ProjectAreas and Stage 2 ProjectRequirements, then lets builders complete draft selections by Room View or Category View while preserving room/location-based records.

`/inclusions-selections/review` exists only as the next-stage placeholder. Final pricing review, approvals, documents, snapshots and Estimate Builder export remain deferred.

## Services

- `validateProjectAreas`: validates explicit project area structure.
- `generateRequirementsForArea`: turns an area template into project requirements.
- `loadTemplateStage`: loads ProjectAreas, template configuration, saved builder templates and ProjectRequirements.
- `resolveEffectiveTemplateAssignment`: resolves project, group, type and area overrides.
- `previewRequirementGeneration`: previews added, kept, updated, removable and protected requirements.
- `reconcileProjectRequirements`: generates and reconciles ProjectRequirements without silently deleting protected records.
- `loadSelectionWorkspace`: loads ProjectAreas, ProjectRequirements, draft selections, locations, notes, attachments and workspace draft state.
- `loadRoomView` and `loadCategoryView`: present the same requirements by room or by category without duplicating records.
- `createProjectSelection`, `selectProductVariant`, `createCustomSelection`, `updateRequirementStatus`, `clearProjectSelection` and `resetSelectionToInherited`: mutate draft selection state through the application service boundary.
- `previewApplyTo` and `applySelectionToTargets`: preview and apply draft selections only to compatible requirements while retaining SelectionLocations.
- `validateSelectionWorkspace` and `saveWorkspaceDraft`: validate and persist the draft workspace through the repository interface.
- `resolveEffectiveSelection`: applies default inheritance precedence.
- `previewApplySelection`: previews bulk application without mutating records.
- `calculateSelectionPricing`: computes commercial values.
- `canLockSelectionSet`: requires builder and client approvals for required selections.
- `createSelectionSnapshot`: freezes approved selection lines.
- `createEstimateSelectionExport`: aggregates locked snapshot lines for estimating.
