# Quote Proposal Field Map

This map is based only on inspected Project Setup/Data Input rows. No inferred/demo values are valid fallbacks.

| Proposal Field | Workbook Row | Workbook Key | Workbook Storage Path | Fallback | Notes |
|---|---|---|---|---|---|
| PROJECT_NAME | Project Setup row 2: Project name | projectName | workbook.data.inputDataSheet.rows.projectName.value | Not entered | Project title/name on proposal cover and dynamic fields. |
| OWNER_NAME | Project Setup row 3.1: Client | clientName | workbook.data.inputDataSheet.rows.clientName.value | Not entered | There is no separate Owner row in Project Setup; Client is the source row. |
| CLIENT_NAME | Project Setup row 3.1: Client | clientName | workbook.data.inputDataSheet.rows.clientName.value | Not entered | Alias of OWNER_NAME for proposal wording. |
| SITE_ADDRESS | Project Setup row 3: Project address | projectAddress | workbook.data.inputDataSheet.rows.projectAddress.value | Not entered | Full site/project address. |
| BUILDER_NAME | Project Setup row 3.3: Builder | builderName | workbook.data.inputDataSheet.rows.builderName.value | Not entered | Builder row in Project Setup. |
| ESTIMATOR_NAME | Project Setup row 3.4: Estimator | estimatorName | workbook.data.inputDataSheet.rows.estimatorName.value | Not entered | Estimator row in Project Setup. |
| QUOTE_NUMBER | Project Setup row 3.2: Job number | jobNumber | workbook.data.inputDataSheet.rows.jobNumber.value | Not entered | No Quote number row exists in Project Setup; current source row is Job number. |
| JOB_NUMBER | Project Setup row 3.2: Job number | jobNumber | workbook.data.inputDataSheet.rows.jobNumber.value | Not entered | Direct Job number field. |
| QUOTE_DATE | Project Setup row 3.5: Quote date | quoteDate | workbook.data.inputDataSheet.rows.quoteDate.value | Not entered | Quote date row in Project Setup. |
| EXPIRY_DATE | No Project Setup row exists | None | None | Not entered | No Expiry Date row exists in Project Setup. |
| QUOTE_TOTAL | No Project Setup row exists | preview.summary.finalQuoteTotal | sheet.preview.summary.finalQuoteTotal / calculated summary | Not entered | Calculated quote summary value, not a Project Setup/Data Input row. |
| COMPANY_NAME | Project Setup row 3.3: Builder | builderName | workbook.data.inputDataSheet.rows.builderName.value | Not entered | No Company Name row exists; Builder is the only Project Setup source. |
| COMPANY_LOGO | No Project Setup row exists | None | None | Not entered | No Company Logo row exists in Project Setup. |
| COMPANY_ADDRESS | No Project Setup row exists | None | None | Not entered | No Company Address row exists in Project Setup. |

## Required Resolver Rule

The Quote Proposal Builder must resolve proposal fields from this map only. A mapped Project Setup row is read from `workbook.data.inputDataSheet.rows.<key>.value`. If the row value is blank or the row does not exist, display `Not entered`.

## Background Image Save Trace

Current standalone page trace from `pages/modules/builders/quote-proposal-builder.js`:

1. Upload starts from `PageProperties` -> `onUploadBackground()` -> `startUpload({ kind: "pageBackground" })`.
2. File picker result enters `handleUpload(event)`.
3. `fileToDataUrl(file)` converts the image to a data URL.
4. Proposal React state is updated at `page.background.imageUrl` via `updatePage(...)`.
5. `ProposalPage` renders the page with CSS `backgroundImage: url(page.background.imageUrl)`, `backgroundSize: cover`, `backgroundPosition`, and `backgroundRepeat: no-repeat`.
6. `saveProposal()` sends `pages` to Supabase table `builder_quote_proposals.pages`.
7. `loadProposal()` reads `builder_quote_proposals.pages` and `normalisePages(...)` preserves `page.background`.
8. Preview/PDF uses the same `ProposalPage` renderer, so saved background must come from `page.background.imageUrl`.

Workbook trace expected by Estimate Builder:

1. Upload should update proposal state.
2. Proposal state should be written into the Estimate Builder workbook, likely under `workbook.clientPage.proposalBuilder` or a future mapped workbook-owned proposal path.
3. Job save should persist that workbook object.
4. Reload should restore the workbook object.
5. Preview should render from the restored workbook object.

Actual root issue found: the standalone builder currently saves proposal pages to `public.builder_quote_proposals.pages`, not to the Estimate Builder workbook. The embedded Estimate Builder route dynamically loads this commercial page, but the page does not use the passed workbook context as the source of truth. Therefore, in the workbook flow, a background image can appear to save in local proposal state / Supabase proposal storage but not become part of the `.gr8job` workbook state.

## Root Causes

- Workbook field values were being resolved through a mixture of project metadata, snapshot metadata, fallback keys, and demo values instead of a fixed Project Setup schema map.
- There is no distinct Owner row in Project Setup. The real source row for owner/client wording is `Client` with key `clientName`.
- There is no distinct Quote Number row in Project Setup. The available source row is `Job number` with key `jobNumber`.
- There is no Expiry Date, Company Logo, or Company Address row in Project Setup. These fields need explicit non-Project-Setup storage or must display `Not entered`.
- Background images in the standalone builder are stored in proposal page JSON at `page.background.imageUrl`, but the current commercial proposal page is not workbook-owned. This conflicts with the Estimate Builder workbook persistence expectation.
- Raw placeholders are safe only if final preview/PDF resolves them at render time from the field map. Any future implementation must not store duplicated workbook values for mapped fields.
