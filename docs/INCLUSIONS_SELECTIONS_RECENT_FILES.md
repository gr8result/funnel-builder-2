# Inclusions & Selections Recent Files

Recent Files shows the last three selections files opened successfully.

Each entry records only lightweight metadata:

- filename
- project name
- job number
- last opened date/time
- whether a browser file handle was available

Browsers cannot silently reopen arbitrary local files by path. When the File System Access API allows persistent handles, the module stores the handle in IndexedDB and requests permission before reopening. If a handle is unavailable or permission is denied, the module tells the builder to choose the file again and opens the normal file picker.

Recent Files must not store complete selections project files in a shared Gr8 Result database and must not display fake local paths.
