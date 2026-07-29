# Inclusions Selections Stage 3 Selection Workspace

Date: 2026-07-30

## Route

`/inclusions-selections/workspace`

Stage 3 adds the working builder workspace for draft room and category selections.

`/inclusions-selections/review` is present only as the next-stage placeholder and states: "Pricing, variations and final selection review will be completed in the next stage."

## Purpose

The workspace lets a builder complete selections by room or by category while preserving the same underlying hierarchy:

ProjectArea -> ProjectRequirement -> ProjectSelection -> SelectionLocation -> Product or Custom Selection -> Quantity -> Pricing -> Variation.

Category View is only a presentation of existing ProjectRequirements. It does not create category-only records.

## Room View

Room View groups ProjectAreas by AreaGroup and shows level, completion percentage, outstanding count and room variation. Selecting a room loads its ProjectRequirements without allowing edits to area name, area type, area group or project level.

## Category View

Category View groups actual ProjectRequirements by RequirementCategory and shows total, complete, incomplete, needs-attention and category variation. Each row keeps the ProjectArea name and requirement title visible.

## Shared Records

Both views read and update the same ProjectSelection and SelectionLocation records through `selectionWorkspaceService`. Switching views does not duplicate requirements, selections or locations.

## Product Library Boundary

The workspace uses `ProductSelectionCatalogueAdapter` for product search, exact product lookup, variant lookup, supplier lookup, price reference lookup and availability checks.

The current implementation includes `InMemoryProductSelectionCatalogueAdapter` with limited development fixtures for proving the workflow. The selections module references product and supplier IDs only; it does not own or modify Product Library or Supplier Library behaviour.

## Product And Variant Selection

Product selection is requirement-first. A product must match category, subtype, active state and organisation availability. Product families with required variants remain incomplete until a specific variant is selected. Variant changes update selected description, price, colour, supplier SKU and draft variation.

## Manual Custom Selections

Manual custom selections are typed and category-bound. They require a name, description, category, quantity, unit, client price and allowance. Optional brand, model, colour, supplier and SKU fields are retained as structured data. Custom selections do not automatically create Product Library records.

## Apply To

Apply To supports this requirement, this room, selected rooms, all rooms of this area type, all rooms in this area group and every compatible requirement in the project.

Every apply action produces a preview with compatible, incompatible and skipped targets before mutation. Protected selections, identical selections and incompatible category/subtype targets are not silently overwritten.

## Selection Locations And Quantity

Every selection has a stable ProjectSelection ID and at least one SelectionLocation for the physical usage point. Locations preserve organisation, project, area, requirement, quantity, pricing quantity and unit. Apply To creates traceable locations for each changed requirement.

## Pricing And Draft Variations

Draft pricing uses the existing `calculateSelectionPricing` domain service. The workspace stores allowance, selected price, quantity, GST and net variation on ProjectSelection and displays included, no-change, upgrade, credit and price-missing states. Values are draft only and do not create formal contract variations.

## Inheritance And Reset

Rows display the effective template/tier source from Stage 2. Manual custom selections show as manual overrides. Reset and clear remove the draft ProjectSelection so the next valid inherited value can resolve again.

## Completion Rules

Required requirements are complete only with a compatible product or structured custom selection, valid quantity and unit, selected pricing, required variant where applicable and no unresolved validation issues. Required items cannot be marked Not Applicable without a reason. Optional and conditional items may remain pending or Not Applicable.

## Persistence

Persistence is currently in-memory through `SelectionWorkspaceRepository`. Save and reload are stable within the repository lifecycle. Database persistence is deferred until migrations are explicitly approved.

## Validation

`validateSelectionWorkspace` uses stable issue codes for missing project context, missing requirements, cross-organisation/project selections, invalid quantity/unit, missing price, missing required variant, invalid Not Applicable status, duplicate SelectionLocations, missing custom descriptions, invalid custom categories and unresolved required selections.

## Responsive Behaviour

The workspace uses focused components and responsive CSS so the navigation, requirement cards and Apply To dialog stack on small viewports without a fixed-width dependency.

## Tests

`src/modules/inclusions-selections/tests/selectionWorkspace.test.ts` covers workspace loading, Room View, Category View, product and variant selection, custom selections, Apply To previews, locations, pricing, completion rules, save/reload and route isolation.

The Stage 3 test runs through `src/modules/inclusions-selections/tests/runDomainFoundation.mjs` with the Stage 1 and Stage 2 tests.

## Deferred Work

The following remain future stages:

- final pricing and variation review
- client approval
- builder approval
- locked snapshots from the workspace
- generated schedules and reports
- Estimate Builder export
- procurement export
- database migrations
