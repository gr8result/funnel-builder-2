# Inclusions & Selections File Management

File-management operations live in `projectFileManagementService`, not in the banner UI.

Supported operations:

- `loadProjectFileMenu` lists recently opened project contexts from the organisation-scoped project index.
- `openSelectionsProject` loads areas, templates, selections, review and approvals before routing.
- `saveSelectionsProject` saves the active stage through the existing application service/repository.
- `saveSelectionsProjectAs` creates a separate project-scoped copy with new project identity and excludes approvals, locked snapshots and export history.
- `saveSelectionsBuilderTemplate` stores reusable configuration without client details or site address.
- `exportSelectionsProjectFile` creates a portable `.gr8selections.json` payload.
- `previewSelectionsProjectImport` validates schema, organisation, checksum and duplicate warnings.
- `importSelectionsProjectFile` imports a valid package as a new project.
- `closeSelectionsProject` clears the active context and returns to the project dashboard route.

Unsaved navigation from banner actions warns before leaving. `Ctrl+S` is captured inside the module and uses the same Save path.

Production note: the current repositories persist to browser storage. The service boundary is intentionally shaped so database repositories can replace the development adapters without changing the banner component.
