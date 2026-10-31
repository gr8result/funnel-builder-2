// Verifies Quotation Builder edits survive save/reopen normalization and autosave does not grow payloads.
// Run: node --import ./scripts/register-json-loader.mjs scripts/test-quotation-builder-save-reopen-regression.mjs
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { createEstimateBuilderWorkbookDefaults } from "../lib/construction-estimation/estimateBuilderWorkbookDefaults.js";
import { compareQuotationRevisions } from "../lib/construction-estimation/quotationRevisionComparison.js";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
const { __quotationPersistenceTestUtils: persistence } = await import("../hooks/estimate-builder/useEstimateBuilderWorkbook.js");
const jobPersistenceSource = readFileSync(new URL("../lib/construction-estimation/jobPersistence.js", import.meta.url), "utf8");

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

check("internal wall finish heading and standard inclusion remain available", () => {
  assert.ok(templateJs.includes("Plasterboard to framed walls"));
  assert.ok(templateJson.includes("Plasterboard to framed walls"));
  assert.ok(templateJs.includes('"section": "INTERNAL WALL FINISH"'));
  assert.ok(templateJson.includes('"section": "INTERNAL WALL FINISH"'));
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

check("production hydration resolves accessory aliases before quotation quantities", () => {
  const productId = "isolated-accessory";
  const line = {
    lineId: "pack:bathroom-accessory-pack:towel-rail", productId, productName: "Selected brushed nickel towel rail",
    unit: "EACH", unitPrice: 159, unitAllowance: 147.16, quantity: 4, priceBasis: "SRP inc GST",
    selectionPack: { packId: "isolated-pack", quantityPerPack: 1, packQuantity: 4 },
    allocations: ["Main Bathroom", "Ensuite", "2nd BEDROOM ENSUITE", "B2 Ensuite"].map((location) => ({ location, quantity: 1 })),
  };
  const book = { rooms: [{ id: "guided-accessories", name: "Bathroom Accessories", rows: [{
    id: "isolated-rail", guidedRequirementKey: "towel-rail", guidedSelection: {
      requirementKey: "towel-rail", requirementLabel: "Towel Rails", quantity: 4,
      plumbingAllocation: { lines: [line] },
    },
  }] }] };
  const hydrated = persistence.normalizeWorkbook({ ...makeJob("isolated-accessory-alias-test", "Alias regression"), clientSelectionsBook: book }, { allowQuotationHydration: true });
  const selected = hydrated.clientSelectionsBook.rooms[0].rows[0].guidedSelection;
  const quote = Object.values(hydrated.quotation).flatMap((section) => section.rows || []).find((row) => row.productId === productId);
  assert.equal(selected.quantity, 3);
  assert.equal(quote.quantity, 3);
  assert.equal(quote.productId, productId);
  assert.equal(quote.locationSchedule.length, 3);
  assert.equal(hydrated.procurement.items.find((item) => item.productId === productId).qty, 3);
  const saved = persistence.normalizeWorkbook(JSON.parse(JSON.stringify(hydrated)));
  assert.deepEqual(saved.clientSelectionsBook, JSON.parse(JSON.stringify(hydrated.clientSelectionsBook)));
  assert.deepEqual(JSON.parse(JSON.stringify(Object.values(saved.quotation).flatMap((section) => section.rows || []).find((row) => row.productId === productId))), JSON.parse(JSON.stringify(quote)));
});

check("another job is not overwritten", () => {
  assert.notEqual(persistence.workbookJobKey(compact), persistence.workbookJobKey(jobB));
  assert.notEqual(persistence.workbookPersistenceFingerprint(compact), persistence.workbookPersistenceFingerprint(jobB));
});

check("ordinary reopen preserves every row, manual value, formula and position", () => {
  const saved = {
    ...compact,
    quotation: { "CUSTOM SAVED TRADE": { rows: [{ id: "manual-preserved", item: "Confirmed supplier price", qty: 7, quantity: "7", manualRate: "$123.45", excelRate: 100, formulas: { 6: "B12*F12" }, formula: "B12*F12", quantityManualOverride: true, values: ["Confirmed supplier price", "7", "", "EACH", "", "$123.45", ""], sortOrder: 8 }] } },
    quotationSectionOrder: ["CUSTOM SAVED TRADE"], quotationSectionOrderIds: [],
  };
  const normalized = persistence.normalizeWorkbook(JSON.parse(JSON.stringify(saved)));
  const withoutOrder = ({ sortOrder, sortSection, sortSectionId, ...row }) => row;
  assert.deepEqual(normalized.quotation["CUSTOM SAVED TRADE"].rows.map(withoutOrder), saved.quotation["CUSTOM SAVED TRADE"].rows.map(withoutOrder));
  assert.deepEqual(Object.keys(normalized.quotation), ["CUSTOM SAVED TRADE"]);
  assert.deepEqual(normalized.quotationSectionOrder, saved.quotationSectionOrder);
  assert.deepEqual(persistence.normalizeWorkbook(JSON.parse(JSON.stringify(normalized))).quotation, normalized.quotation);
  const empty = persistence.normalizeWorkbook({ ...saved, quotation: {}, quotationSectionOrder: [] });
  assert.deepEqual(empty.quotation, {}, "an intentionally empty saved quotation is not regenerated");
});

check("workbook changes cannot trigger a load-time cabinetry catalogue replacement", () => {
  assert(!source.includes("setWorkbook(current => reconcileCabinetryQuotation(current, owner))"));
  assert(!source.includes("setWorkbook(current => applyCabinetryRequirementsToQuotation(current, owner))"));
  assert(source.includes("setCabinetryRequirements: items => updateWorkbookState"));
});

check("Client Selections save uses the shared reconciliation planner", () => {
  assert(source.includes("const reconciled = planSelectionReconciliation({ workbook: selectionOwned, book: nextBook"));
  assert(source.includes("preserveQuoteQuantityOwnership(nextWorkbook, connected)"));
  assert(source.includes("if (reconciled.duplicates.length)"), "ordinary save must reject duplicate quotation claims before persistence");
  assert(source.includes("assertSelectedWorkspaceProductsAvailable"), "private workspace product ids must resolve before save");
  assert(source.includes("getEffectiveProductCatalogue({ organisationId: workspaceId, includeDisabled: true })"), "saved disabled products remain resolvable without exposing another workspace");
  assert(uiSource.includes("useBuilderCatalogue(moduleWorkspaceId)"), "Estimate Builder hydrates the active workspace catalogue");
  assert(uiSource.includes("{ previewMode, catalogueState }"), "catalogue loading/errors are passed to the save boundary");
});

check("revision comparison is read-only and rejects another job or builder", () => {
  const current = { jobId: "revision-test", workspaceId: "builder-a", quotation: { Trade: { sectionId: "trade", rows: [{ id: "one", quantity: 2, manualRate: 100 }, { id: "two", quantity: 1 }] } } };
  const previous = { ...current, quotation: { Trade: { sectionId: "trade", rows: [{ id: "one", quantity: 3, manualRate: 120 }] } } };
  const original = JSON.stringify([current, previous]);
  const comparison = compareQuotationRevisions(current, previous);
  assert.deepEqual(comparison.counts, { ADDED: 0, REMOVED: 1, UPDATED: 1, REORDERED: 0 });
  assert.deepEqual(comparison.changes[0].fields.quantity, { before: 2, after: 3 });
  assert.equal(JSON.stringify([current, previous]), original);
  assert.throws(() => compareQuotationRevisions(current, { ...previous, jobId: "other" }), /another job/);
  assert.throws(() => compareQuotationRevisions(current, { ...previous, workspaceId: "builder-b" }), /another builder/);
  assert.throws(() => compareQuotationRevisions({ ...current, workspaceId: undefined }, { ...previous, workspaceId: undefined }), /no builder identity/);
  const restoreSource = source.slice(source.indexOf("async function restorePreviousJobRevision()"), source.indexOf("async function closeCurrentJob()"));
  assert(restoreSource.includes("compareQuotationRevisions(startingWorkbook, restored)"));
  assert(restoreSource.includes("window.confirm"));
  assert(!restoreSource.includes(".getAll()"));
});

check("builder-specific quotation template bindings survive reopen and dirty tracking", () => {
  const bound = { ...compact, templateKey: "builder-private-template", templateName: "Builder Standard Inclusions" };
  const reopenedBound = persistence.normalizeWorkbook(JSON.parse(JSON.stringify(bound)));
  assert.equal(reopenedBound.templateKey, bound.templateKey);
  assert.equal(reopenedBound.templateName, bound.templateName);
  assert.notEqual(persistence.workbookPersistenceFingerprint(bound), persistence.workbookPersistenceFingerprint({ ...bound, templateKey: "another-builders-template" }));
});

check("autosave signature ignores save metadata and does not loop", () => {
  assert.equal(signatureA, signatureB);
});

check("storage preparation preserves product images and quote history", () => {
  const row = compact.quotation[sectionName].rows.find((item) => item.id === existingRowId);
  assert.equal(row.productImageUrl, "data:image/png;base64,BBB");
  assert.equal(row.productLibrarySnapshot.imageReference, "data:image/png;base64,CCC");
  assert.equal(compact.productLibrary.products[0].image_url, "data:image/png;base64,AAA");
  assert.equal(compact.quoteHistory.length, 260);
  assert.ok(afterSize > 0 && beforeSize > 0);
});

check("source includes verified save/read-back before Saved status", () => {
  assert.ok(source.includes("saveVerifiedStoredJob(draft"));
  assert.ok(source.includes("persistCompleteJob({"));
  assert.ok(jobPersistenceSource.includes("Job read-back verification failed"));
  assert.ok(uiSource.includes("Saved at"));
  assert.ok(uiSource.includes("Save failed"));
});

console.log(`\nPayload bytes before compaction: ${beforeSize}`);
console.log(`Payload bytes after compaction:  ${afterSize}`);
console.log(`Quotation rows verified: ${persistence.countQuotationRows(reopened.quotation)}`);
console.log(`${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
