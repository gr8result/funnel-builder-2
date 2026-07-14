# Workbook Field Map

This document is the field contract for the Document Engine. It is based on the inspected Project Setup/Data Input source in `lib/construction-estimation/inputDataSheetTemplate.js`.

Rendered workbook section: `inputDataSheet`

Primary value path pattern:

`workbook.data.inputDataSheet.rows.<internalKey>.value`

The full Project Setup row schema is documented in `PROJECT_SETUP_SCHEMA.md`. Document Engine dynamic fields must use the mapped keys below or an explicitly added row from that schema. No demo values or guessed field names are valid.

## Dynamic Field Registry

| Field ID | Display Name | Project Setup Row | Internal Key | Storage Path | Fallback |
|---|---|---|---|---|---|
| PROJECT_NAME | Project Name | Row 2: Project name | projectName | workbook.data.inputDataSheet.rows.projectName.value | Not entered |
| OWNER_NAME | Owner Name | Row 3.1: Client | clientName | workbook.data.inputDataSheet.rows.clientName.value | Not entered |
| CLIENT_NAME | Client Name | Row 3.1: Client | clientName | workbook.data.inputDataSheet.rows.clientName.value | Not entered |
| SITE_ADDRESS | Site Address | Row 3: Project address | projectAddress | workbook.data.inputDataSheet.rows.projectAddress.value | Not entered |
| JOB_NUMBER | Job Number | Row 3.2: Job number | jobNumber | workbook.data.inputDataSheet.rows.jobNumber.value | Not entered |
| QUOTE_NUMBER | Quote Number | Row 3.2: Job number | jobNumber | workbook.data.inputDataSheet.rows.jobNumber.value | Not entered |
| QUOTE_DATE | Quote Date | Row 3.5: Quote date | quoteDate | workbook.data.inputDataSheet.rows.quoteDate.value | Not entered |
| BUILDER_NAME | Builder | Row 3.3: Builder | builderName | workbook.data.inputDataSheet.rows.builderName.value | Not entered |
| ESTIMATOR_NAME | Estimator | Row 3.4: Estimator | estimatorName | workbook.data.inputDataSheet.rows.estimatorName.value | Not entered |
| PROJECT_STATUS | Status | Row 3.6: Status | projectStatus | workbook.data.inputDataSheet.rows.projectStatus.value | Not entered |
| FLOOR_COUNT | Storeys | Row 4: Number of levels | floorCount | workbook.data.inputDataSheet.rows.floorCount.value | Not entered |
| ENGINEERING_REQUIREMENTS | Engineering Requirements | Row 5.1: Engineering requirements | engineeringRequirements | workbook.data.inputDataSheet.rows.engineeringRequirements.value | Not entered |
| FACADE_TYPE | Facade Type | Row 5.2: Facade type | facadeType | workbook.data.inputDataSheet.rows.facadeType.value | Not entered |
| FRAME_METHOD | Frame Method | Row 5: Frame Method | frameMethod | workbook.data.inputDataSheet.rows.frameMethod.value | Not entered |
| QUOTE_TOTAL | Quote Total | Calculated summary, not Project Setup | preview.summary.finalQuoteTotal | workbook preview/calculated summary | Not entered |
| EXPIRY_DATE | Expiry Date | No Project Setup row exists | None | None | Not entered |
| COMPANY_NAME | Company Name | Row 3.3: Builder | builderName | workbook.data.inputDataSheet.rows.builderName.value | Not entered |
| COMPANY_LOGO | Company Logo | No Project Setup row exists | None | None | Not entered |
| COMPANY_ADDRESS | Company Address | No Project Setup row exists | None | None | Not entered |

## Resolver Rules

1. The Document Engine stores `dynamicFieldId`, not copied workbook values.
2. Edit mode, preview mode, and export mode resolve fields through the same resolver.
3. A mapped Project Setup field reads `workbook.data.inputDataSheet.rows.<key>.value`.
4. Blank, missing, or unsupported values render as `Not entered`.
5. If a new workbook field is needed, add it to the Project Setup schema first, then add it here.
6. `OWNER_NAME` and `CLIENT_NAME` intentionally map to the same `Client` row because no separate Owner row exists.
7. `QUOTE_NUMBER` intentionally maps to `Job number` until a real Quote Number row exists.

## Canonical Source

For every Project Setup/Data Input row, use `PROJECT_SETUP_SCHEMA.md` as the complete schema listing. This map is the safe dynamic-field subset exposed to documents.
