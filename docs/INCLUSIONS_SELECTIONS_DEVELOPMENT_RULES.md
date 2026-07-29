# Inclusions Selections Development Rules

Date: 2026-07-29

## Hard Rules

- Build top-down from project areas and templates.
- Keep products as selectable references, not project structure.
- Do not restore product-first workflow logic.
- Do not import retired selections UI, API, or budget helpers.
- Do not let draft selections write into approved estimates.
- Do not alter Estimate Builder UI from this module.
- Do not add migrations until the database plan is explicitly approved.

## Code Shape

- Keep domain concepts in focused folders.
- Prefer pure services for validation, generation, inheritance, compatibility, pricing, approval, snapshot, and export logic.
- Keep repositories as interfaces at the boundary.
- Use fixtures only for tests and local domain checks.
- Add UI only after the domain contracts are stable.

## Testing

Minimum coverage for domain work:

- area validation,
- template-to-requirement generation,
- inheritance and reset behaviour,
- product compatibility and apply-to preview,
- pricing and variation calculation,
- approval locking,
- snapshot creation,
- estimate export aggregation.

## Isolation Checks

Before committing, search the replacement module for legacy imports and route names. The replacement must remain independent from the retired implementation.
