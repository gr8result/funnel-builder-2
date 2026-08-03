# Inclusions & Selections Project Banner

Every `/inclusions-selections/*` stage renders `InclusionsSelectionsProjectBanner` above `InclusionsSelectionsStageNav`.

The banner shows the open project name, job number, client, site address, current stage and save status. It links back to `/modules/estimate-builder` with the active `organisationId`, `projectId`, `projectName`, `client`, `siteAddress` and `jobNumber` query context.

The banner keeps the frequent actions visible: Back to Project Dashboard, Open Existing Job, Import Project File, File, Save, Save As and Save Status.

File actions are exposed from a labelled File button and include New Selections Project, Open Existing Job, Import Project File, Export Project File, Save, Save As, Save as Builder Template and Close Project.

Save status values are `Saved`, `Unsaved Changes`, `Saving...`, `Save Failed`, `Read Only` and `Locked Version`. The Areas page marks room/area edits as unsaved and saves through `saveProjectAreaRegister`; locked approval/export views disable direct Save.

Open Existing Job opens projects already saved in Gr8 Result. Import Project File uses a browser file input and is only for portable `.gr8selections.json` or `.json` project files.

Current limitation: selections-stage persistence uses the module's repository adapters. The project picker also reads the existing Estimate Builder registered-job and Projects Hub recent-job browser sources so sample/application-created jobs appear in the same organisation.
