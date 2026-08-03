# Inclusions & Selections Project Banner

Every `/inclusions-selections/*` stage renders `InclusionsSelectionsProjectBanner` above `InclusionsSelectionsStageNav`.

The banner shows the open project name, job number, client, site address, current stage, current local filename and save status. It links back to `/modules/estimate-builder` with the active `organisationId`, `projectId`, `projectName`, `client`, `siteAddress` and `jobNumber` query context.

The banner keeps the frequent actions visible: Back to Project Dashboard, New, Open File, Save, Save As, File, current filename and Save Status.

File actions are exposed from a labelled File button and include New, Open File, Save, Save As, Export Backup and Close File.

Save status values are `Saved`, `Unsaved Changes`, `Saving...`, `Save Failed`, `Read Only`, `Locked Version` and `Updated Copy Downloaded`. The Areas page marks room/area edits as unsaved and saves through `saveProjectAreaRegister`; locked approval/export views disable direct Save.

Open File launches the browser's native file picker through the File System Access API where supported, with a real hidden file input fallback. It accepts portable `.gr8selections.json` files and `.json` during development. The old database-style project picker is not exposed to normal selections users.

Current limitation: selections-stage editing still uses the module's repository adapters as browser working state while a local file is open. The durable source of truth for a builder's selections project is the local `.gr8selections.json` file they open or save.
