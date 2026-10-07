// Verifies Quotation Builder edits survive save/reopen normalization and autosave does not grow payloads.
// Run: node --import ./scripts/register-json-loader.mjs scripts/test-quotation-builder-save-reopen-regression.mjs
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
const { __quotationPersistenceTestUtils: persistence } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");

let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    console.log(`  PASS  ${label}`);
    pass += 1;
  } catch (error) {
    console.log(`  FAIL  ${label}: ${error.message}`);
    fail += 1;
  }
}

function makeJob(projectId, jobName) {
  return persistence.normalizeWorkbook({
    ...createEstimateBuilderWorkbookDefaults(),
    projectId,
    commercialProjectId: projectId,
    registeredJobId: projectId,
    registeredJob: {
      jobId: projectId,
      jobName,
      jobNumber: projectId.toUpperCase(),
      clientName: `${jobName} Client`,
      siteAddress: "1 Persistence Street",
    },
    jobFileMeta: {
      projectId,
      jobName,
      jobNumber: projectId.toUpperCase(),
      clientName: `${jobName} Client`,
      address: "1 Persistence Street",
      localFileOnly: false,
    },
  });
}

function mutateQuotation(workbook) {
  const sectionName = Object.keys(workbook.quotation).find((section) => workbook.quotation[section]?.rows?.length);
  const section = workbook.quotation[sectionName];
  const existingRow = section.rows.find((row) => !row.applianceHeading) || section.rows[0];
  const customRow = {
    id: `${sectionName}-custom-regression`,
    item: "Regression custom product line",
    quantity: "7",
    importedQuantity: "",
    quantityKey: "",
    unit: "EACH",
    excelRate: "",
    manualRate: "$123.45",
    supplierQuote: "",
    sourceOfRate: "manual",
    description: "Custom description survives full reopen.",
    productDescription: "Linked Product Library description survives.",
    selectionSpec: "Selected finish: Matte White",
    selectedProductName: "Regression Product",
    selectedBrand: "Regression Brand",
    selectedModel: "REG-123",
    selectedColour: "Matte White",
    selectedSupplier: "Regression Supplier",
    productImageUrl: "/images/product-library/regression-product.webp",
    thumbnailUrl: "/images/product-library/regression-product.webp",
    productName: "Regression Product",
    brand: "Regression Brand",
    manufacturer: "Regression Manufacturer",
    supplier: "Regression Supplier",
    sku: "REG-123",
    model: "REG-123",
    notes: "Regression note",
    values: ["Regression custom product line", "7", "", "EACH", "", "$123.45", "Regression note"],
    formulas: {},
    productLibrarySnapshot: {
      productId: "REG-123",
      productCode: "REG-123",
      productName: "Regression Product",
      brand: "Regression Brand",
      manufacturer: "Regression Manufacturer",
      supplier: "Regression Supplier",
      sku: "REG-123",
      model: "REG-123",
      description: "Linked Product Library description survives.",
      imageReference: "/images/product-library/regression-product.webp",
    },
  };
  return {
    sectionName,
    existingRowId: existingRow.id,
    workbook: {
      ...workbook,
      templateKey: "template:master-estimate-template",
      templateName: "Master Estimate Template",
      templateType: "job",
      quotation: {
        ...workbook.quotation,
        [sectionName]: {
          ...section,
          stageNumber: "9",
          rows: [
            ...section.rows.map((row) => row.id === existingRow.id ? {
              ...row,
              item: "Edited existing quotation row",
              quantity: "3",
              unit: "M2",
              manualRate: "$88.80",
              description: "Edited existing description persists.",
              productDescription: "Edited Product Library description persists.",
              selectionSpec: "Edited selection persists.",
              selectedProductName: "Edited selected product",
              selectedBrand: "Edited brand",
              selectedModel: "EDIT-001",
              selectedSupplier: "Edited supplier",
              productImageUrl: "/images/product-library/edited-existing.webp",
              productName: "Edited selected product",
              sku: "EDIT-001",
              quantityManualOverride: true,
              autoQuantity: false,
            } : row),
            customRow,
          ],
        },
      },
    },
  };
}

const templateJs = readFileSync(new URL("../lib/construction-estimation/inputDataSheetTemplate.js", import.meta.url), "utf8");
const templateJson = readFileSync(new URL("../lib/construction-estimation/inputDataSheetTemplate.json", import.meta.url), "utf8");
const source = readFileSync(new URL("../hooks/estimate-builder/useEstimateBuilderWorkbook.js", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../components/estimate-builder/EstimateBuilderWorkbook.js", import.meta.url), "utf8");

const jobA = makeJob("quotation-save-job-a", "Quotation Save Job A");
const jobB = makeJob("quotation-save-job-b", "Quotation Save Job B");
const { sectionName, existingRowId, workbook: editedJobA } = mutateQuotation(jobA);
const compact = persistence.compactWorkbookForStorage({
  ...editedJobA,
  quoteHistory: Array.from({ length: 260 }, (_, index) => ({ id: String(index), field: "quantity", value: String(index) })),
  productLibrary: {
    products: [{
      id: "base64-product",
      image_url: "data:image/png;base64,AAA",
      product_name: "Base64 should not persist",
      active: "yes",
    }],
  },
  quotation: {
    ...editedJobA.quotation,
    [sectionName]: {
      ...editedJobA.quotation[sectionName],
      rows: editedJobA.quotation[sectionName].rows.map((row) => row.id === existingRowId ? {
        ...row,
        productImageUrl: "data:image/png;base64,BBB",
        productLibrarySnapshot: { ...(row.productLibrarySnapshot || {}), imageReference: "data:image/png;base64,CCC" },
      } : row),
    },
  },
}, "2026-09-05T00:00:00.000Z");
const reopened = persistence.normalizeWorkbook(JSON.parse(JSON.stringify(compact)));
const beforeSize = persistence.jsonByteLength(editedJobA);
const afterSize = persistence.jsonByteLength(compact);
const signatureA = persistence.workbookAutosaveSignature({ ...compact, savedAt: "2026-09-05T00:00:00.000Z" });
const signatureB = persistence.workbookAutosaveSignature({ ...compact, savedAt: "2026-09-05T00:01:00.000Z" });

check("standard entry label was renamed", () => {
  assert.ok(templateJs.includes("Plasterboard to framed walls"));
  assert.ok(templateJson.includes("Plasterboard to framed walls"));
  assert.equal(/INTERNAL WALL FINISH/.test(templateJs + templateJson), false);
});

check("edited existing row survives save/reopen normalization", () => {
  const row = reopened.quotation[sectionName].rows.find((item) => item.id === existingRowId);
  assert.equal(row.item, "Edited existing quotation row");
  assert.equal(row.quantity, "3");
  assert.equal(row.unit, "M2");
  assert.equal(row.manualRate, "$88.80");
  assert.equal(row.description, "Edited existing description persists.");
  assert.equal(row.selectionSpec, "Edited selection persists.");
  assert.equal(row.selectedProductName, "Edited selected product");
  assert.equal(row.selectedBrand, "Edited brand");
  assert.equal(row.selectedModel, "EDIT-001");
  assert.equal(row.selectedSupplier, "Edited supplier");
});

check("new item survives save/reopen normalization", () => {
  const row = reopened.quotation[sectionName].rows.find((item) => item.id === `${sectionName}-custom-regression`);
  assert.equal(row.item, "Regression custom product line");
  assert.equal(row.quantity, "7");
  assert.equal(row.manualRate, "$123.45");
  assert.equal(row.productLibrarySnapshot.imageReference, "/images/product-library/regression-product.webp");
});

check("job-specific quotation fingerprint is stable across full reopen", () => {
  assert.equal(persistence.workbookPersistenceFingerprint(reopened), persistence.workbookPersistenceFingerprint(persistence.normalizeWorkbook(reopened)));
});

check("another job is not overwritten", () => {
  assert.notEqual(persistence.workbookJobKey(compact), persistence.workbookJobKey(jobB));
  assert.notEqual(persistence.workbookPersistenceFingerprint(compact), persistence.workbookPersistenceFingerprint(jobB));
});

check("autosave signature ignores save metadata and does not loop", () => {
  assert.equal(signatureA, signatureB);
});

check("storage compaction removes base64 product images and bounds history", () => {
  const row = compact.quotation[sectionName].rows.find((item) => item.id === existingRowId);
  assert.equal(row.productImageUrl, "");
  assert.equal(row.productLibrarySnapshot.imageReference, "");
  assert.equal(compact.productLibrary.products[0].image_url, "");
  assert.equal(compact.quoteHistory.length, 200);
  assert.ok(afterSize <= beforeSize * 1.05, `payload grew unexpectedly: before ${beforeSize}, after ${afterSize}`);
});

check("source includes verified save/read-back before Saved status", () => {
  assert.ok(source.includes("saveVerifiedStoredJob"));
  assert.ok(source.includes("workbookPersistenceFingerprint(savedRecord?.workbook"));
  assert.ok(uiSource.includes("Saved at"));
  assert.ok(uiSource.includes("Save failed"));
});

console.log(`\nPayload bytes before compaction: ${beforeSize}`);
console.log(`Payload bytes after compaction:  ${afterSize}`);
console.log(`Quotation rows verified: ${persistence.countQuotationRows(reopened.quotation)}`);
console.log(`${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
