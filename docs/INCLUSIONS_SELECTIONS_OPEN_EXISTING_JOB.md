# Inclusions & Selections Open File

Open File is the normal-user action for continuing a selections project. It opens the builder's computer file picker and reads a local `.gr8select` file.

The previous database-search action, `Open Existing Job`, is retired from the normal selections workflow. Do not expose it as the primary action and do not rebuild it as a project database picker.

Preferred browser path:

- `window.showOpenFilePicker()`
- accepted extensions: `.gr8select`, `.json`
- `multiple: false`

Fallback path:

- hidden `<input type="file" accept=".gr8select,.json,application/json">`

After a file is selected, the module parses JSON, validates the schema and checksum, shows an open preview, and only replaces the current working project when the user clicks Open Project.
