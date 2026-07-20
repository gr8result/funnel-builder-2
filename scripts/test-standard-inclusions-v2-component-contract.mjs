import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workbookSource = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const componentSource = readFileSync("components/standard-inclusions-v2/StandardInclusionsV2.jsx", "utf8");

assert.match(workbookSource, /const STANDARD_INCLUSIONS_LEGACY = false;/, "legacy Standard Inclusions must be disabled");
assert.match(
  workbookSource,
  /export function StandardInclusionsSheet\(\{ sheet \}\) \{\s*if \(!STANDARD_INCLUSIONS_LEGACY\) return <StandardInclusionsV2 sheet=\{sheet\} \/>;/,
  "StandardInclusionsSheet must render V2 when legacy is disabled",
);

assert.match(componentSource, /No Standard Inclusions Schedule is currently loaded\./, "V2 empty state must use the required copy");
assert.equal((componentSource.match(/Upload PowerPoint/g) || []).length, 1, "Upload PowerPoint must appear once in V2");
assert.equal((componentSource.match(/Upload PDF/g) || []).length, 1, "Upload PDF must appear once in V2");
assert.equal((componentSource.match(/Create Blank Schedule/g) || []).length, 1, "Create Blank Schedule must appear once in V2");
assert.equal((componentSource.match(/Replace Schedule/g) || []).length, 1, "Replace Schedule must appear once in V2");
assert.equal((componentSource.match(/Delete Schedule/g) || []).length, 1, "Delete Schedule must appear once in V2 and only when loaded");

for (const forbidden of [
  "Import each page as a fixed page background",
  "PDF upload mode",
  "importPptxAsStandardDocumentPreview",
  "importPdfAsStandardDocumentPreview",
  "documentBuilder",
  "pdfPages",
  "scheduleDeleted",
]) {
  assert.equal(componentSource.includes(forbidden), false, `V2 component must not include legacy/import concept: ${forbidden}`);
}

console.log("standard-inclusions-v2 component contract passed");
