# Inclusions Selections Database Proposal

Date: 2026-07-29

This is a proposal only. No migrations are added in this phase.

## Proposed Tables

- `inclusion_area_groups`
- `inclusion_area_types`
- `project_inclusion_areas`
- `inclusion_area_templates`
- `inclusion_requirement_definitions`
- `project_inclusion_requirements`
- `inclusion_tiers`
- `inclusion_product_references`
- `project_inclusion_selection_defaults`
- `project_inclusion_selections`
- `project_inclusion_selection_approvals`
- `project_inclusion_snapshots`
- `project_inclusion_snapshot_lines`
- `project_inclusion_generated_documents`
- `project_inclusion_document_projection_metadata`
- `project_inclusion_estimate_mapping_overrides`
- `project_inclusion_estimate_exports`
- `project_inclusion_estimate_export_lines`
- `project_inclusion_estimate_export_batches`
- `project_inclusion_export_reconciliations`
- `project_inclusion_audit_entries`

## Scoping

Every tenant-owned table should include `organisation_id`. Every project-owned table should include `project_id`. Row level security should scope reads and writes by organisation membership and project access.

## Migration Principles

- Do not edit deployed historical migrations.
- Do not drop old selection tables until live data inventory and migration mapping exist.
- Preserve Product Library tables until product catalogue ownership is explicitly decided.
- Add new tables through additive migrations only.

## Legacy Mapping Notes

Historical tables such as `builder_client_selections`, `builder_selection_books`, `builder_selection_sessions`, and `builder_inclusions_schedules` should be treated as migration sources, not live domain dependencies.
