# Inclusions & Selections Stage 2: Room Templates and Inclusion Tiers

## Route

- `/inclusions-selections/templates`
- Next placeholder: `/inclusions-selections/workspace`

## Purpose

Stage 2 takes the ProjectAreas created in Stage 1 and assigns the required inclusions structure to each room or area.

AreaTemplates answer: what must be selected for this room?

InclusionTiers answer: what standard of inclusions applies?

Products do not define rooms, templates, requirements or tiers in this stage.

## Workflow

1. Load the Stage 1 ProjectArea register.
2. Review areas grouped by AreaGroup and ProjectLevel.
3. Choose a whole-project InclusionTier.
4. Override tiers at AreaGroup, AreaType or ProjectArea level.
5. Override AreaTemplates at AreaType or ProjectArea level.
6. Select Custom for an individual ProjectArea.
7. Preview generated ProjectRequirements.
8. Generate or reconcile ProjectRequirements.
9. Save template assignments and generated requirements.
10. Continue to the Selection Workspace placeholder.

## Inheritance Levels

The Stage 2 resolver uses this precedence:

1. Project default
2. AreaGroup override
3. AreaType override
4. ProjectArea override

Resetting an override removes only that override and returns the area to the next inherited value.

## Standard AreaTemplates

Standard AreaTemplates are defined in `src/modules/inclusions-selections/templates/standardAreaTemplates.ts`.

Implemented templates include Bedroom, Master Bedroom, Bathroom, Ensuite, Powder Room, WC, Laundry, Kitchen, Butler's Pantry, pantry, kitchenette, living/circulation areas, Garage, Exterior, Roof, Alfresco/Patio, Pool, landscaping, fencing and outdoor kitchen templates.

Templates contain RequirementDefinitions only. They do not include product brands, product models or production Product Library records.

## Inclusion Tiers

The active stable tiers are:

- Classic: Practical entry-level inclusions.
- Premier: The builder's normal standard inclusions.
- Premium: Higher-specification finishes and products.
- Custom: No preset product defaults. Requirements remain ready for manual configuration.

Tiers can be assigned at project, AreaGroup, AreaType and individual ProjectArea level.

## Custom Templates

Individual ProjectAreas can enter Custom mode. Custom templates remain typed AreaTemplates with RequirementDefinitions. The UI supports adding custom requirement definitions, changing Required/Optional/Conditional/Not Applicable status, reordering, removing unused custom definitions and saving the custom AreaTemplate into the stage state.

Blank Custom templates block progression.

## Saved Builder Templates

Saved builder templates are organisation-scoped structures that can capture the current configuration, be applied, renamed, duplicated or archived.

The current implementation is intentionally local and does not include a marketplace or cross-organisation sharing.

## Requirement Generation

Requirement generation uses the existing template generation service and expands it with applicability status. ProjectRequirement IDs are stable and derived from project, area and requirement definition identity.

Re-running generation reconciles requirements instead of duplicating them.

## Reconciliation

Preview and reconciliation return:

- added
- unchanged
- updated
- obsolete
- removable
- protected
- conflicts

Protected requirements are retained when they contain a selection, approval history, pricing data, downstream reference or manual customisation. Requirements are not silently deleted because a template changed.

## Persistence

Stage 2 uses repository interfaces:

- `TemplateStageRepository`
- `InMemoryTemplateStageRepository`

The current repository stores template configuration, saved builder templates and ProjectRequirements in memory. Production database adapters and migrations are deferred.

## Validation

Progression is blocked when:

- project context is missing
- no ProjectAreas exist
- a ProjectArea has no active AreaTemplate unless intentionally Custom
- a Custom ProjectArea has no requirements
- an AreaTemplate is empty
- duplicate requirements exist in the same template
- a ProjectRequirement is missing a category
- cross-organisation templates are referenced
- inactive templates are assigned
- reconciliation conflicts are unresolved
- requirements have not been generated for configured areas

## Responsive Behaviour

Desktop uses a two-column configuration and preview layout. Tablet stacks panels. Mobile displays ProjectArea configuration as readable cards with no fixed-width table dependency.

## Tests

The domain runner includes Stage 2 coverage:

```bash
node src/modules/inclusions-selections/tests/runDomainFoundation.mjs
```

Coverage includes loading from Stage 1, project/group/type/area overrides, template generation, reconciliation, custom templates, saved builder templates, validation, persistence, navigation source checks and responsive source checks.

## Deferred Work

- Product selection workspace
- Category-by-category product selection
- pricing
- approvals
- documents
- Estimate Builder export
- Supabase/database migrations
