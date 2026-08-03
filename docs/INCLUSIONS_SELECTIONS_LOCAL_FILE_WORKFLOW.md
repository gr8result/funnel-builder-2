# Inclusions & Selections Local File Workflow

Selections files belong to the builder and stay on the builder's computer. The application uses browser storage only as temporary working state while a `.gr8select` file is created, opened, edited or saved.

Open File uses the native File System Access API where supported:

`application/json: [".gr8select", ".json"]`

The fallback is a real hidden file input accepting:

`.gr8select,.json,application/json`

Save writes directly to the active file only when a writable browser file handle exists. Without that handle, Save downloads an updated copy and reports `Updated Copy Downloaded` so the user is not told the original file was overwritten.

Save As creates a new portable file identity and records `copiedFromFileId`. Export Backup downloads a dated copy and does not replace the active file handle.

The old `.gr8selections.json` extension is avoided in native picker options because Chrome rejects extension strings longer than 16 characters.
