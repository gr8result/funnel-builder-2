# Inclusions and Selections

This module is the clean top-down replacement boundary for Inclusions and Selections.

The domain order is:

Project -> Areas and rooms -> Area groups -> Area types -> Templates -> Requirements -> Inclusion tiers -> Product selections -> Pricing -> Approvals -> Locked snapshots -> Estimate export.

Current scope:

- Domain entities, value objects, fixtures, repository interfaces, and pure services.
- Stage-one Create Selection Areas UI and route wiring.
- Stage-two Room Templates and Inclusion Tiers UI and route wiring.
- No Supabase migrations.
- No imports from the retired Client Selections, Guided Selections, Selections Book, or Inclusions Schedule implementation.
- No Product Library table ownership changes.
- No Estimate Builder behaviour changes.

Key files:

- `areas/`, `area-groups/`, `area-types/`: project area structure and validation.
- `levels/`: project level identities for generated areas.
- `components/`: focused stage-one Create Selection Areas UI components.
- `templates/`, `requirements/`, `tiers/`: generated room requirements and inclusion tiers.
- `products/`, `selections/`: product references, inheritance, and apply-to previews.
- `pricing/`, `approvals/`, `snapshots/`, `estimate-export/`: commercial lifecycle through locked estimate export.
- `repositories/`: persistence contracts and an in-memory test implementation.
- `tests/domainFoundation.test.ts`: focused unit coverage for validation, generation, compatibility, pricing, locking, snapshots, and export.
- `tests/createAreasStage.test.ts`: focused coverage for stage-one project levels, area quantities, validation, persistence scope and route isolation.
- `tests/templateStage.test.ts`: focused coverage for stage-two template/tier inheritance, requirement reconciliation, custom templates, saved builder templates, validation and persistence.

Active routes:

- `/inclusions-selections/areas`
- `/inclusions-selections/templates`
- `/inclusions-selections/workspace` placeholder only

The stage-one and stage-two routes require an existing `organisationId` and `projectId`. They use in-memory persistence until approved database repositories are added.

Development rules live in `docs/INCLUSIONS_SELECTIONS_DEVELOPMENT_RULES.md`.
