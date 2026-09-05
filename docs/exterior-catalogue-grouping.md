# Exterior catalogue grouping

Exterior now presents Roofing and Entry Doors & Door Furniture as parent cards. Gutters, Fascia, Downpipes and External Door Furniture remain addressable for older links but are not Exterior landing cards. Generic Door Furniture is labelled Internal Door Furniture and is excluded from Exterior.

`lib/product-library/exteriorCatalogueSections.js` supplies the exclusive section mapping used by browsing and quotation mapping. Roof package configuration takes precedence over compatible-product names (for example, Stramit Fascia Gutter remains a gutter). Entrance hardware requires an explicit external family/application; cabinet handles are excluded. Security sets and entrance lock kits belong to Entrance Locksets.

Canonical identities, prices and product counts are preserved. The dedicated hardware catalogue and importer only rename category fields to External Door Furniture. Legacy Client Selections hardware URLs keep their selection context and resolve the external hardware category, including product detail navigation. The existing per-door hardware schedule continues to keep hardware prices separate from doors.

Both parent pages offer all products, individual section filters, current-section CSV, all-parent CSV, selected CSV and selected-with-images ZIP. Empty sections remain visible; no products are invented to populate them. Roofing in Browse All uses the same section mapping.

The combined card uses a locally stored photograph of a keyed entrance lever installed on a door:

- File: `public/images/product-library/entrance-door-lockset.jpg`
- Source: https://pxhere.com/en/photo/653551
- Licence: CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/
- Source record: `public/images/product-library/entrance-door-lockset.source.json`
- The supplied preview is unmodified. This represents entrance hardware; it is not labelled as a particular manufacturer's SKU.

Verification scripts:

- `node --import ./scripts/register-json-loader.mjs scripts/test-exterior-catalogue-grouping.mjs`
- `node --import ./scripts/register-json-loader.mjs scripts/test-entry-door-furniture.mjs`
- `node --import ./scripts/register-json-loader.mjs scripts/verify-exterior-catalogue-grouping-live.mjs` (optional `PRODUCT_LIBRARY_TEST_URL`)
- `node --import ./scripts/register-json-loader.mjs scripts/verify-entry-door-furniture-live.mjs` (optional `ENTRY_DOOR_TEST_BASE_URL`)

## Verification results (6 September 2026)

Live Chrome checks on the isolated local server at port 3002 passed for Exterior cards, the local keyed-lock image, all section filters, and every populated section CSV. Evidence: `test-artifacts/exterior-catalogue-grouping/1788638905521/report.json`. Counts: 197 roofing records and 449 entry-door/hardware records in the effective catalogue.

Selected CSV and ZIP verification passed with exactly one matching canonical record and its image: `test-artifacts/exterior-catalogue-grouping/1788639126100/selected-export-report.json`.

Grouping and canonical quotation-contract tests, entry hardware schedule tests, exterior-door regression tests and navigation tests passed. Lint has no errors (the page retains existing image/hook warnings). Broader checks reported unrelated failures: typecheck includes an archived `test-results/job-persistence-repair-before/useJobFile.ts` with a missing import; the metal-roofing script asserts an older JSX expression that predates the garage-door branch; the package exchange test fails its oven import update-mode expectation after its CSV/image-ZIP assertions pass.

The Client Selections hardware link was verified with a synthetic scheduled door: a Gainsborough Trilock entrance set opened, accepted finish and quantity 2, and confirmed successfully. The saved job contains one associated hardware selection and one separate quotation row. Evidence: `test-artifacts/exterior-hardware-selection-live/persisted-quotation-report.json`. Unknown rates remain blank rather than being converted to zero. The broader door-design wizard/reload run encountered local timeouts; its full save/reopen result is not claimed.

The stalled original development server was restarted on port 3000.

The bounded live hardware selection test also passed with no page errors: `test-artifacts/exterior-hardware-selection-live/report.json`. It verifies selection controls, real options, confirmation, persisted finish/quantity/door association and separate procurement storage. The temporary verification server/cache was removed after testing; the main development server remains on port 3000.
