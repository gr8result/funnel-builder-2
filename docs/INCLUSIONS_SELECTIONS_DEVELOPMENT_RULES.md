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
- Prefer pure services for validation, generation, inheritance, compatibility, pricing, approval, snapshot comparison, and export logic.
- Keep repositories as interfaces at the boundary.
- Use fixtures only for tests and local domain checks.
- Add UI in focused stage routes after the domain contracts for that stage are stable.
- Keep workspace compatibility, pricing, Apply To and validation behaviour in services, not React components.
- Keep review pricing, issue generation, projections and readiness logic in services, not React components.
- Keep approval fingerprints, stale approval detection, approval validation, snapshot readiness and snapshot locking in services, not React components.
- Access products and suppliers through adapter/reference interfaces only.
- Keep draft workspace and review persistence behind repository interfaces. In-memory repositories are acceptable until migrations are explicitly approved.

## Testing

Minimum coverage for domain work:

- area validation,
- template-to-requirement generation,
- inheritance and reset behaviour,
- product compatibility and apply-to preview,
- pricing and variation calculation,
- room/category workspace loading,
- product and variant selection,
- custom selection category binding,
- Apply To preview and skipped/incompatible targets,
- SelectionLocation traceability,
- draft save and reload,
- review summary, room/category projections and variation calculations,
- client/internal projection separation,
- review issue register and warning acknowledgement,
- allowance override audit records,
- Ready for Approval stale-state detection,
- approval fingerprint determinism,
- client approval and builder approval validation,
- stale approval and changes-requested handling,
- locked snapshot readiness,
- immutable snapshot creation,
- snapshot version comparison,
- estimate export aggregation.

## Isolation Checks

Before committing, search the replacement module for legacy imports and route names. The replacement must remain independent from the retired implementation.
