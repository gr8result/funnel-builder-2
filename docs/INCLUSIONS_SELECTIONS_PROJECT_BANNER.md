# Inclusions & Selections Project Banner

Every main `/inclusions-selections/*` route renders the shared `InclusionsSelectionsPageBanner` above `InclusionsSelectionsStageNav`.

The banner shows a 48px module icon, the `Inclusions & Selections` heading, the module subtitle, project name, job number, client, site address, current stage, current local filename and truthful save status.

Visible actions are Back to Project Dashboard, New, Open File, Save, Save As and File. The File menu includes New File, Open File, Save, Save As, Export Backup, Recent Files and Close File with disabled states where the action is not available.

Save status values are `No File Open`, `Unsaved File`, `Unsaved Changes`, `Saving...`, `Saved to File`, `Updated Copy Downloaded`, `Save Failed`, `Read Only` and `Locked Version`.

Open File launches the browser's native picker through the File System Access API where supported, with a real hidden file input fallback. The preferred extension is `.gr8select`; `.json` is accepted for compatibility. The retired database-style `Open Existing Job` picker is not exposed in this normal local-file workflow.

Selections-stage editing uses browser working repositories while a file is open. The durable source of truth belongs to the builder on their own computer as a `.gr8select` file.
