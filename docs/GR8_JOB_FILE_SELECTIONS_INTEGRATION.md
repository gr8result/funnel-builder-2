# GR8 Job File and Inclusions & Selections Integration

## Current `.gr8job` Implementation

The current Quotation / Estimate Builder local job file implementation is in:

- `lib/jobFile.ts`
- `hooks/useJobFile.ts`
- `components/estimate-builder/EstimateBuilderWorkbook.js`
- `hooks/estimate-builder/useEstimateBuilderWorkbook.js`

`.gr8job` files are created by `createNewJob()` in `lib/jobFile.ts`, normally through `useJobFile().newJob()` in `EstimateBuilderWorkbook.js`.

The picker type is `application/json`, and the extension is `.gr8job`.

## Current Schema

The current `.gr8job` payload is a plain JSON object normalised by `normalizeJobData()`:

```json
{
  "jobName": "",
  "clientName": "",
  "jobNumber": "",
  "address": "",
  "notes": "",
  "rooms": [],
  "products": [],
  "pricing": {},
  "created": "",
  "lastModified": "",
  "workbook": {}
}
```

There is no explicit top-level `.gr8job` `schemaVersion` in the current shared job-file helper. The Estimate Builder workbook itself may contain its own internal versioned state, but the file wrapper does not.

## Project Fields

The current job-file wrapper stores:

- project name: `jobName`
- client: `clientName`
- job number: `jobNumber`
- site address: `address`
- notes: `notes`
- created timestamp: `created`
- modified timestamp: `lastModified`
- Estimate Builder data: `workbook`

The Estimate Builder save adapter, `workbookToJobFileData()`, also derives these fields from workbook rows such as:

- `projectName`
- `clientName`
- `customerName`
- `jobNumber`
- `quoteNumber`
- `siteAddress`
- `address`

Builder and estimator are not first-class fields in the current `.gr8job` wrapper. They can be derived from workbook input rows:

- `builderName`
- `companyName`
- `estimatorName`

## Quotation and Estimate Data

Quotation and Estimate Builder state is stored under:

```json
{
  "workbook": {}
}
```

The Estimate Builder open path accepts either a wrapper with `workbook`, or a raw workbook object. When a `.gr8job` is opened, `useJobFile` reads it and `EstimateBuilderWorkbook` passes the workbook through `loadJobFileText()`.

## Save and Save As

`writeJob()` writes normalised JSON to a retained File System Access API handle where available. If no writable handle is available, it downloads a `.gr8job` file.

`saveJobAs()` creates a new `.gr8job` through `showSaveFilePicker()` where available, or downloads a copy.

## Unknown Fields

The current shared `readJob()` / `writeJob()` path normalises the payload and does not preserve unknown top-level fields. This is acceptable for the existing Estimate Builder workflow but is not safe for a unified multi-module project-file model.

For Inclusions & Selections, `.gr8job` integration therefore parses the raw JSON directly and merges only a module-owned `inclusionsSelections` section back into that raw object. Existing quotation/workbook fields and unknown top-level fields are preserved by the selections save path.

## Inclusions & Selections Extension

The selections module now treats `.gr8job` as the preferred unified project file when that is what the user opens. The extension section is:

```json
{
  "inclusionsSelections": {
    "schema": "gr8.selections.project",
    "schemaVersion": 1,
    "projectSummary": {},
    "projectDetails": {},
    "areasAndLevels": {},
    "templatesAndTiers": {},
    "workspace": {},
    "review": {},
    "approvals": {},
    "pricing": {},
    "snapshots": []
  }
}
```

Opening a `.gr8job` without this section starts Inclusions & Selections for the same job in memory. Saving then adds `inclusionsSelections` without renaming or converting the job file.
