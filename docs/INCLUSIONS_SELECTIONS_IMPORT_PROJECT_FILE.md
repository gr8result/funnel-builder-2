# Inclusions & Selections Open File Preview

Open File is the action for browsing the user's computer. It uses the File System Access API where supported and a real browser file input fallback.

Supported extensions:

- `.gr8select`
- `.json` for compatibility
- `.json`

The module does not accept executable files, unknown binary formats, HTML/script content or unsupported future schemas. File selection only creates a preview; it never opens immediately.

The preview shows file name, file size, detected format, file version, project name, job number, client, site address, warnings and validation errors.

Open Project hydrates the local file into browser working state, updates the banner filename and routes to the selections Areas page for that project.
