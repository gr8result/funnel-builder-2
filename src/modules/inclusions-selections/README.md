# Inclusions and Selections

This module is the clean top-down replacement boundary for Inclusions and Selections.

The domain order is:

Project -> Areas and rooms -> Area groups -> Area types -> Templates -> Requirements -> Inclusion tiers -> Product selections -> Pricing -> Approvals -> Locked snapshots -> Estimate export.

Current scope:

- Domain entities, value objects, fixtures, repository interfaces, and pure services.
- Stage-one Create Selection Areas UI and route wiring.
- Stage-two Room Templates and Inclusion Tiers UI and route wiring.
- Stage-three Selection Workspace UI and route wiring for Room View, Category View, client-selectable Product Library picker workflow, product detail view, supplier links, variants, draft product/custom selections, Apply To preview, SelectionLocations, notes, attachments, pricing display, validation and in-memory draft save/reload.
- Stage-four Review, Pricing and Variations UI and route wiring for review summary, room/category review, variation calculations, client preview, internal builder projection, issue register, custom selection review, allowance overrides and Ready for Approval metadata.
- Stage-five Approvals and Locked Selection Version UI and route wiring for client review state, client approval, builder approval, changes requested, approval fingerprints, stale approval detection, immutable locked snapshots, version history, comparisons and new draft revisions.
- Stage-six Approved Documents and Estimate Export UI and route wiring for locked snapshot document projections, generated document records, estimate mapping validation, mapping overrides, export preview, aggregation, adapter-based export, retry, reconciliation and export history.
- Shared local-file-first project banner across every stage, backed by `projectFileManagementService` for portable `.gr8selections.json` serialisation, Open File validation, Save, Save As, Export Backup and close-file routing.
- No Supabase migrations.
- No imports from the retired Client Selections, Guided Selections, Selections Book, or Inclusions Schedule implementation.
- Product Library remains the shared catalogue owner; selections consume only `client_selectable` and allowed `builder_selectable` products through the adapter.
- No Estimate Builder behaviour changes.
- No procurement workflow, supplier ordering or purchase schedules.

Key files:

- `areas/`, `area-groups/`, `area-types/`: project area structure and validation.
- `levels/`: project level identities for generated areas.
- `components/`: focused stage-one Create Selection Areas UI components.
- `templates/`, `requirements/`, `tiers/`: generated room requirements and inclusion tiers.
- `products/`, `selections/`: product references, inheritance, and apply-to previews.
- `products/productSelectionCatalogueAdapter.ts`: adapter boundary for shared product and supplier references.
- `products/productTagTaxonomy.ts`: Product Library classification tags used to match requirements to compatible selections products.
- `products/requirementProductMatching.ts`: compatibility scoring and filter logic for the Stage 3 product picker.
- `repositories/selectionWorkspaceRepository.ts`: draft workspace repository interface and in-memory implementation.
- `repositories/selectionReviewRepository.ts`: review metadata, issue, allowance override and audit repository interface with in-memory implementation.
- `repositories/approvalStageRepository.ts`: approval, approval history, locked snapshot and draft revision repository interface with in-memory implementation.
- `repositories/documentsExportRepository.ts`: generated document, mapping override, export batch, export line, reconciliation and audit repository interface with in-memory implementation.
- `services/selectionWorkspaceService.ts`: Stage 3 application service for Room View, Category View, selection creation, variants, custom selections, Apply To, validation and save/reload.
- `services/selectionReviewService.ts`: Stage 4 application service for review summaries, room/category projections, variation summaries, client/internal projections, issue generation, allowance overrides and Ready for Approval.
- `services/approvalStageService.ts`: Stage 5 application service for approval fingerprints, client/builder approval, stale approval handling, snapshot readiness, immutable snapshot creation and snapshot comparison.
- `services/documentsExportService.ts`: Stage 6 application service for document projections, generated documents, estimate mapping, mapping overrides, export preview, aggregation, adapter execution, retry and reconciliation.
- `services/projectFileManagementService.ts`: shared application service for the project banner, local file serialisation, stage save, `.gr8selections.json` open/export validation and close-file routing.
- `pricing/`, `approvals/`, `snapshots/`, `estimate-export/`: commercial lifecycle through locked estimate export.
- `repositories/`: persistence contracts and an in-memory test implementation.
- `tests/domainFoundation.test.ts`: focused unit coverage for validation, generation, compatibility, pricing, locking, snapshots, and export.
- `tests/createAreasStage.test.ts`: focused coverage for stage-one project levels, area quantities, validation, persistence scope and route isolation.
- `tests/templateStage.test.ts`: focused coverage for stage-two template/tier inheritance, requirement reconciliation, custom templates, saved builder templates, validation and persistence.
- `tests/selectionWorkspace.test.ts`: focused coverage for Stage 3 loading, views, product/variant/custom choices, Apply To, pricing, completion, persistence and route isolation.
- `tests/productPickerWorkflow.test.ts`: focused coverage for Product Library classification, product picker matching, variant enforcement, Apply To, persistence and client-safe projections.
- `tests/selectionReview.test.ts`: focused coverage for Stage 4 review loading, summary totals, projections, pricing, issues, allowance overrides, Ready for Approval and route isolation.
- `tests/selectionApprovalStage.test.ts`: focused coverage for Stage 5 approval readiness, fingerprints, stale approvals, locking, immutability, versioning, comparison and route isolation.
- `tests/selectionDocumentsExport.test.ts`: focused coverage for Stage 6 documents, mappings, export preview, aggregation, adapter export, retry, reconciliation, history and route isolation.
- `tests/projectBannerFileManagement.test.ts`: focused coverage for shared banner placement, dashboard/stage routes, local Open File actions, Save, Save As, mobile controls and portable file validation.

Active routes:

- `/inclusions-selections/areas`
- `/inclusions-selections/templates`
- `/inclusions-selections/workspace`
- `/inclusions-selections/review`
- `/inclusions-selections/approvals`
- `/inclusions-selections/documents-export`
- `/inclusions-selections/procurement` placeholder only

The stage-one through stage-six routes require an existing `organisationId` and `projectId`. If none is present, the shared banner shows New, Open File and Back to Project Dashboard actions without rendering an empty workflow beneath it. The module uses browser-scoped repositories as temporary working state while the builder's durable source of truth remains their local `.gr8selections.json` file.

Development rules live in `docs/INCLUSIONS_SELECTIONS_DEVELOPMENT_RULES.md`.
