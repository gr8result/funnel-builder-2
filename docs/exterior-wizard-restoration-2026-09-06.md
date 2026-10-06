# Exterior door wizard restoration

The manufacturer, range and design card UI was recovered from commit `9fe8fbc5b2afe646f307806e88f138eb92d338e5`, `pages/modules/builders/selections-book.js`. This is the last committed door wizard located in history; it does not contain the entire requested hardware workflow. Existing configuration and glass adapters are retained, and the canonical hardware catalogue is connected through a dedicated wizard step.

The regression came from mounting the Product Library page for the door-furniture query, placing a large location editor above the wizard, and an alternate category click handler that did not synchronise the entry-door route. The customer route now remains `page=clientSelections`. Locations default when no schedule exists; the location editor is collapsed, with an Add Another Exterior Door action.

## Preserved data

Read-only inspection found the previous Hume Savoy 1200 XS26 selection (`ENTRY-HUME-SAVOY-1200-XS26-1200`) in `builder_selection_books`, record `2d9de446-88ec-49f3-a296-357dcc74aa48`, project `64fd5367-275f-4264-bc3c-c13b6f3447a0`, row `row-1787899929120-5b5c64082e49e8`. No saved jobs or selections were cleared or migrated.

The imported hardware catalogue is byte-for-byte unchanged: Lockwood 25, Gainsborough 121, Lemaar 58, Zanda 88 (292 imported records, plus existing legacy options). Product records and images remain in their canonical architecture.

## Changes

- `pages/modules/builders/selections-book.js`: restored historical door cards, optional compact locations, separate glass stage, connected hardware and complete-door confirmation, shared entry-door navigation handler.
- `components/estimate-builder/ExteriorHardwareWizard.jsx`: brand, available hardware type, paginated products (12 per page, at most four columns), options and review.
- `lib/builders/exteriorHardwareWizard.js`: catalogue filtering, hardware grouping and glass filtering.
- `pages/modules/builders/product-library.js`: repaired malformed JSX in the category image conditional shown in the build-error screenshot.
- `scripts/test-restored-exterior-wizard.mjs`: catalogue preservation, pagination, glass and saved-door regression checks.
- `scripts/verify-restored-exterior-wizard-live.mjs`: isolated browser verification using a copy of the recovered door and blocking remote data mutations.
- `scripts/verify-restored-exterior-reopen-live.mjs`: fresh-session reopening verification of the saved test job.

Clear, translucent, frosted, obscure/privacy and grey tinted glass filters are exposed. Where the selected model does not publish that glass option, it is recorded as a customer request requiring supplier confirmation, not an invented manufacturer specification.

## Verification

Both screenshot syntax errors are repaired and all affected JSX parses. The supplied localhost:3000 Client Selections URL returned HTTP 200 without a build-error response. Normal Takeoff was not opened.

Passing regression scripts: restored exterior wizard, entry-door furniture, manual entry-door recovery and selection navigation. ESLint completed with zero errors and 80 warnings across the touched application files. The unrelated Internal Areas regression currently expects a null rate but encounters 40.23 in the current catalogue; those catalogue changes were preserved.

The live browser completed application, manufacturer, range, design, size, configuration, finish, glazing, Grey Tint glass, four hardware brands, available hardware types, pagination, Select, options, complete confirmation, Review Schedule and Save Progress. It selected Gainsborough Choice Lianna `1140LIASCV`, Satin Chrome, quantity 2, linked to the Hume XS26 door. Every card on the tested product page had Select, and advancing the page changed the displayed products (12 maximum).

The saved test job is 6,725,691 bytes and independently parses with the door, glass, finish, hardware quantity and locking options intact. The initial refresh failed while loading a development JavaScript chunk (`Invalid or unexpected token` / ChunkLoadError); the main run therefore remains marked failed in `test-artifacts/exterior-wizard-restore/live/report.json`. This is not a claim that uninterrupted refresh is verified.

A separate fresh browser session successfully reopened that saved file and displayed both the Hume door and Gainsborough hardware in Review Schedule, with Satin Chrome finish and no page errors. Evidence: `test-artifacts/exterior-wizard-restore/reopen/report.json` and `reopen/reopened-review.png`. Remote data mutations were blocked and only synthetic local test jobs were written. Screenshots of the earlier flow are under `test-artifacts/exterior-wizard-restore/live/`.
