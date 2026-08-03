# Inclusions & Selections Save And Save As

Save persists the current selections stage through the existing stage repository/service. The banner displays:

- Saved
- Unsaved Changes
- Saving...
- Save Failed
- Read Only
- Locked Version
- Updated Copy Downloaded

Ctrl+S is captured while the module is active and routes through the same Save handler, preventing the browser's Save Page action.

Where the browser provides a writable File System Access API handle, Save writes the serialised `.gr8selections.json` payload back to the selected local file and the banner can show `Saved`.

Where direct overwrite is unsupported, Save downloads an updated copy using the current filename and shows `Updated Copy Downloaded`. The app must not claim the original local file was overwritten in this fallback path.

Save As creates a separate local file. It uses `window.showSaveFilePicker()` where supported, otherwise it downloads the selected filename as a `.gr8selections.json` copy. The original file handle remains unchanged until the new file is successfully created.
