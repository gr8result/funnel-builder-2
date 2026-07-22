import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normaliseStandardInclusions } from "../lib/builders/standardInclusions.js";

const pages = Array.from({ length: 10 }, (_, index) => ({
  id: `slide-${index + 1}`,
  title: `Slide ${index + 1}`,
  objects: [],
}));

const importedDocument = {
  id: "standard-inclusions-doc-imported",
  name: "Premier Inclusions Schedule",
  pages,
  activePageId: pages[0].id,
  metadata: {
    documentSource: "pptx-import",
    lastSavedAt: "2026-07-20T00:00:00.000Z",
  },
};

const normalised = normaliseStandardInclusions({
  documentBuilder: importedDocument,
  source: "deleted",
  scheduleDeleted: true,
  isDeleted: true,
  deletedAt: "2026-07-20T00:00:00.000Z",
  activeDocumentSource: "deleted",
}, "qa-builder");

assert.equal(normalised.documentBuilder.id, importedDocument.id);
assert.equal(normalised.documentBuilder.pages.length, 10);
assert.equal(normalised.scheduleDeleted, false);
assert.equal(normalised.isDeleted, false);
assert.equal(normalised.deletedAt, null);
assert.equal(normalised.activeDocumentId, importedDocument.id);

const component = await readFile(new URL("../components/estimate-builder/EstimateBuilderWorkbook.js", import.meta.url), "utf8");
assert.match(component, /Imported and saved \$\{persistedPageCount\} Standard Inclusions page/);
assert.match(component, /persistedDocument\?\.id !== document\.id/);
assert.doesNotMatch(component, /setStandardStatus\(`Imported \$\{document\.pages\.length\} Standard Inclusions page/);
assert.match(component, /source: importSource/);
assert.match(component, /isDeleted: false/);
assert.match(component, /deletedAt: null/);

console.log("Standard Inclusions import commit regression passed.");
