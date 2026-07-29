# Inclusions and Selections

This module is the clean top-down replacement boundary for Inclusions and Selections.

The domain order is:

Project -> Areas and rooms -> Area groups -> Area types -> Templates -> Requirements -> Inclusion tiers -> Product selections -> Pricing -> Approvals -> Locked snapshots -> Estimate export.

Current scope:

- Domain entities, value objects, fixtures, repository interfaces, and pure services.
- No visible UI.
- No route wiring.
- No Supabase migrations.
- No imports from the retired Client Selections, Guided Selections, Selections Book, or Inclusions Schedule implementation.
- No Product Library table ownership changes.
- No Estimate Builder behaviour changes.

Key files:

- `areas/`, `area-groups/`, `area-types/`: project area structure and validation.
- `templates/`, `requirements/`, `tiers/`: generated room requirements and inclusion tiers.
- `products/`, `selections/`: product references, inheritance, and apply-to previews.
- `pricing/`, `approvals/`, `snapshots/`, `estimate-export/`: commercial lifecycle through locked estimate export.
- `repositories/`: persistence contracts and an in-memory test implementation.
- `tests/domainFoundation.test.ts`: focused unit coverage for validation, generation, compatibility, pricing, locking, snapshots, and export.

Development rules live in `docs/INCLUSIONS_SELECTIONS_DEVELOPMENT_RULES.md`.
