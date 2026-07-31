# Inclusions & Selections Project Banner

Every `/inclusions-selections/*` stage renders `InclusionsSelectionsProjectBanner` above `InclusionsSelectionsStageNav`.

The banner shows the open project name, job number, client, site address, current stage and save status. It links back to `/modules/estimate-builder` with the active `organisationId`, `projectId`, `projectName`, `client`, `siteAddress` and `jobNumber` query context.

File actions are exposed from a labelled File button and include New Selections Project, Open Existing Job, Import Selections File, Export Selections File, Save, Save As, Save as Builder Template and Close Project.

Save status values are `Saved`, `Unsaved Changes`, `Saving...`, `Save Failed`, `Read Only` and `Locked Version`. The Areas page marks room/area edits as unsaved and saves through `saveProjectAreaRegister`; locked approval/export views disable direct Save.

Current limitation: persistence uses the module's browser-scoped repository adapters until approved database repositories are added.
