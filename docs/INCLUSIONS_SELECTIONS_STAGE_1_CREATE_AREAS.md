# Inclusions & Selections Stage 1: Create Selection Areas

This stage creates the project-owned area register used by later templates, inclusions, product selections, pricing and estimating. It is intentionally top-down: users choose project areas first, then later stages can attach templates and requirements to those areas.

## Active Routes

- `/inclusions-selections/areas` - Create Selection Areas.
- `/inclusions-selections/templates` - next workflow stage for room templates and inclusion tiers.

Both routes require an existing project context. The current page accepts `organisationId` or `orgId`, plus `projectId`, with optional project summary query values.

## Implemented Scope

- Standard checklist groups for External and Outdoor, Bedrooms, Kitchen Areas, Wet Areas, and Living and Circulation.
- Whole-project selection support.
- Standard project levels: Ground Floor, Upper Floor, Lower Floor, Basement, External.
- Custom project levels.
- Quantity-generated areas for repeatable room types such as bedrooms, bathrooms, ensuites, powder rooms and WCs.
- Editable generated area names.
- Stable level assignment by `levelId`.
- Custom project areas with organisation-scoped custom area types.
- Area duplicate and safe remove actions.
- Validation before continuing to the template stage.
- Mobile card register view and desktop table register view.

## Persistence

No database migration exists for this stage yet. The page uses `ProjectAreaRegisterRepository` with the in-memory implementation in `src/modules/inclusions-selections/repositories/projectAreaRegisterRepository.ts`.

This preserves the repository boundary and organisation/project scoping, but drafts persist only for the current application lifecycle until an approved database repository is added.

## Not Implemented

- Template assignment in Stage 1. This is implemented separately by Stage 2.
- Requirement generation from selected areas in the UI.
- Inclusion tiers.
- Product Library integration.
- Supplier Library integration.
- Estimate Builder export.
- Client approvals.
- Database migrations.
- Legacy selections imports.

## Validation Rules

- Existing project context is required.
- At least one area is required before continuing.
- Area names are required.
- Area names must be unique on the same level.
- The same area name is allowed on different levels.
- Area type and group must remain compatible.
- Custom area types must belong to the same organisation.
- Areas must be assigned to active project levels.
- Areas marked with downstream links cannot be removed by this stage.

## Proof

Run:

```bash
node src/modules/inclusions-selections/tests/runDomainFoundation.mjs
```

The runner includes the original domain foundation tests and the Create Selection Areas stage tests.
