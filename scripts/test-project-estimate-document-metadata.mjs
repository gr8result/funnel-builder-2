import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Execute the editor's actual helpers without mounting React or opening a job.
const source = fs.readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const tree = ts.createSourceFile("workbook.jsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const names = [
  "normaliseProposalImportedDocuments",
  "normaliseImportedProposalDocument",
  "activeProjectEstimateDocument",
  "projectEstimateDocumentRecoveryLabel",
  "referencedPdfUrl",
];
const definitions = names.map((name) => {
  const node = tree.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(node, `Missing editor helper ${name}`);
  return node.getText(tree);
}).join("\n");
const { normaliseProposalImportedDocuments, activeProjectEstimateDocument, projectEstimateDocumentRecoveryLabel } = new Function(
  `${definitions}; return { normaliseProposalImportedDocuments, activeProjectEstimateDocument, projectEstimateDocumentRecoveryLabel };`
)();

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

for (const estimateKey of ["projectEstimate", "projectEstimatePdf"]) {
  const saved = freezeDeep({
    [estimateKey]: {
      id: "saved-estimate",
      fileName: "Existing estimate.pdf",
      sourceType: "project_estimate_pdf",
      publicUrl: "https://example.test/existing-estimate.pdf",
      pageCount: 21,
      futureDocumentField: { retained: true },
    },
    inclusions: { id: "inclusions", file_name: "Inclusions.pdf", page_count: 4 },
    pricedPlans: { id: "plans", file_name: "Plans.pdf", page_count: 5 },
    futureAttachment: { payload: [0, false, "", { retained: true }] },
    futureFlag: false,
  });
  const before = structuredClone(saved);
  const normalized = normaliseProposalImportedDocuments(saved);
  // Individual imported page references lack the complete document's pageCount.
  const active = activeProjectEstimateDocument({
    importedDocuments: normalized,
    pages: Array.from({ length: 21 }, (_, index) => ({
      importedDocument: {
        id: `page-${index + 1}`,
        sourceType: "project_estimate_pdf",
        publicUrl: "https://example.test/existing-estimate.pdf",
        pageNumber: index + 1,
      },
    })),
  });
  assert.equal(active.pageCount, 21, `${estimateKey}: use complete saved document metadata, not the first page fallback`);
  assert.equal(projectEstimateDocumentRecoveryLabel(active), "Issued Project Estimate PDF - 21 pages");
  assert.strictEqual(normalized[estimateKey], saved[estimateKey], "Keep the saved estimate payload without cloning or filtering fields");
  assert.strictEqual(normalized.futureAttachment, saved.futureAttachment, "Keep unknown saved attachments without copying payloads");
  assert.equal(normalized.futureFlag, false);
  assert.deepEqual(normalized[estimateKey].futureDocumentField, { retained: true });
  assert.equal(normalized.inclusions.fileName, "Inclusions.pdf");
  assert.equal(normalized.inclusions.pageCount, 4);
  assert.equal(normalized.pricedPlans.fileName, "Plans.pdf");
  assert.equal(normalized.pricedPlans.pageCount, 5);
  assert.deepEqual(saved, before, "Editor normalization must not mutate the saved document payload");
}

assert.deepEqual(normaliseProposalImportedDocuments(), { inclusions: null, pricedPlans: null });
console.log("PASS actual editor normalization preserves 21-page estimate metadata, legacy aliases and unknown fields without mutating saved payloads.");
