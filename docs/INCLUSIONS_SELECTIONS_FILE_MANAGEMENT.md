# Inclusions & Selections File Management

File-management operations are local-file-first. The banner owns native browser file picker interactions; `projectFileManagementService` serialises, validates and hydrates the portable selections file payload.

Supported operations:

- New creates an unsaved in-browser working project after Project Name, Job Number, Client, Site Address, Builder and Estimator are entered.
- Open File launches `window.showOpenFilePicker()` where supported, or a real `<input type="file">` fallback. It previews schema, filename, size, project, client, site, area count, selection count and warnings before replacing the current working project.
- Save writes back through a retained File System Access API file handle where possible. If direct overwrite is unsupported, it downloads an updated `.gr8select` copy and labels that state accurately.
- Save As uses `window.showSaveFilePicker()` where supported. The fallback downloads a separate local `.gr8select` copy. Save As creates a new `fileId`, records `copiedFromFileId`, and leaves the original file unchanged.
- Export Backup downloads a dated `.gr8select` safety copy without changing the active file handle.
- Recent Files stores only the last three filenames and lightweight metadata. Persistent File System Access handles may be stored in IndexedDB when the browser supports them; complete project files are not stored in a shared Gr8 Result database.
- Close File protects unsaved changes, clears the active in-memory project and handle, and preserves recent-file history.

Unsaved navigation from banner actions warns before leaving. `Ctrl+S` is captured inside the module and uses the same Save path.

Production note: the current repositories persist to browser storage as working state. They are not the durable selections project store; the builder's local `.gr8select` file is.
