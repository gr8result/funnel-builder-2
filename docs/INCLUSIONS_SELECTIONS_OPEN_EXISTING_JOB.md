# Inclusions & Selections Open Existing Job

Open Existing Job is for projects already saved inside Gr8 Result. It does not browse the user's computer.

The picker reads the current organisation/workspace and merges:

- the selections project index
- Estimate Builder registered jobs
- Projects Hub recent jobs

The dialog lists projects immediately, before the user types. It shows project name, job number, client, site address, current selections stage, last modified, status and an Open action. Search covers project name, job number, client and site address.

Empty states are separate:

- no projects in the organisation: `No saved projects were found for this organisation.`
- search with no match: `No projects match your search.`

Opening a project loads the project context and all available selections stages, updates the URL, updates the banner and prevents records from another organisation being mixed into the active view.
