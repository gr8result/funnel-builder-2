# Inclusions & Selections File Management

File-management operations are local-file-first. The banner owns native browser file picker interactions; `projectFileManagementService` serialises, validates and hydrates the portable selections file payload.

Supported operations:

- New creates an unsaved in-browser working project after Project Name, Job Number, Client, Site Address, Builder and Estimator are entered.
- Open File launches `window.showOpenFilePicker()` where supported, or a real `<input type="file">` fallback. It previews schema, project, client and site details before replacing the current working project.
- `saveSelectionsProject` saves the active stage through the existing application service/repository.
- Save writes back through a retained File System Access API file handle where possible. If direct overwrite is unsupported, it downloads an updated copy and labels that state accurately.
- Save As uses `window.showSaveFilePicker()` where supported. The fallback downloads a separate local `.gr8selections.json` copy.
- Export Backup downloads a dated safety copy without changing the current active file handle.
- `exportSelectionsProjectFile` creates a complete portable `.gr8selections.json` payload.
- `previewSelectionsProjectImport` validates schema, checksum, required project details, script-like content and duplicate warnings.
- `importSelectionsProjectFile` hydrates a valid local file into the browser working repositories.
- `closeSelectionsProject` clears the active context and returns to the project dashboard route.

Unsaved navigation from banner actions warns before leaving. `Ctrl+S` is captured inside the module and uses the same Save path.

Production note: the current repositories persist to browser storage as working state. They are not the durable selections project store; the builder's local `.gr8selections.json` file is.
