import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";
import { auditWindowScheduleQuotation } from "../lib/builders/selectionReconciliationReport.js";
import { isQuotationRateUnresolved, quotationBoqStatus, quotationRateReviewRows } from "../lib/builders/quotationRateReview.js";
import { getMasterProducts } from "../lib/product-library/catalogueService.js";
import { connectTilingSelectionsToQuotation } from "../lib/builders/tilingRooms.js";
import { normalizeQuotationStructure } from "../lib/construction-estimation/quotationStructure.js";
import { planSelectionReconciliation } from "../lib/builders/selectionReconciliation.js";
import { PRODUCT_SELECTION_OUTCOME } from "../lib/builders/productSelectionIntegrity.js";
import { applyCabinetryRequirementsToQuotation, classifyLegacyCabinetLine, collectCabinetryRequirements, updateCabinetrySelectionRequirement } from "../lib/construction-estimation/cabinetryRequirements.js";

const sourcePath = "test-artifacts\\isolated-jobs\\gr8-reconcile-test-47c50983a480\\GR8 RESULT - QUOTATION PROGRESS ALLOCATION TEST.gr8job";
const zip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
const workbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
const calculated = calculateEstimateBuilderWorkbook(structuredClone(workbook));
const windowAudit = auditWindowScheduleQuotation(workbook, calculated);

assert.equal(isQuotationRateUnresolved({ sourceOfRate: "rate missing" }), true, "missing-rate rows remain quote-required instead of silently becoming zero-price active rows");
assert.equal(isQuotationRateUnresolved({ priceStatus: "Rate required in Quotation Builder", unitRate: 0 }), true);
assert.equal(isQuotationRateUnresolved({ rateStatus: "Price pending", unitRate: 0 }), true);
assert.equal(isQuotationRateUnresolved({ sourceOfRate: "catalogue", unitRate: 0 }), false, "a zero rate is not treated as missing when it has a valid source");
assert.equal(isQuotationRateUnresolved({ quoteRequired: true }), true);
assert.equal(quotationBoqStatus({ sourceOfRate: "rate missing", unitRate: 0 }), "quote_required");
assert.equal(quotationBoqStatus({ sourceOfRate: "catalogue", unitRate: 0 }), "active");
assert.equal(quotationBoqStatus({ active: false, sourceOfRate: "rate missing" }), "excluded");

assert.equal(windowAudit.scheduleAvailable, true);
assert.equal(windowAudit.selectedItems, 30);
assert.equal(windowAudit.matchedItems, 30, "all 30 physical openings have deterministic quotation targets");
assert.equal(windowAudit.missingItems, 0, "custom-size rows are valid targets, not missing mappings");
assert.equal(windowAudit.missingPriceItems, 2, "only the two exact custom fixed-glass openings need supplier pricing");
assert.equal(windowAudit.generatedUnsavedItems, 2);
assert.deepEqual(windowAudit.lines.filter((line) => line.missingPrice).map((line) => ({
  size: `${line.heightMm}x${line.widthMm}`,
  locations: line.locations,
  quantity: line.scheduleQuantity,
})), [
  { size: "650x3000", locations: ["Kitchen"], quantity: 1 },
  { size: "650x1800", locations: ["Pantry"], quantity: 1 },
]);

const jambRows = quotationRateReviewRows(calculated.quotation).filter((row) => /90\s*x\s*19.*jamb/i.test(row.item || ""));
assert.equal(jambRows.length, 1, "the saved 90 x 19 jamb row replaces the duplicate generated row");
assert.equal(Number(jambRows[0].qty ?? jambRows[0].quantity), 19);

const reconcileCabinetry = (next) => applyCabinetryRequirementsToQuotation(next, next.workspaceId);
const cabinetryIssue = (next, id) => next.cabinetryReconciliation.entries.find((entry) => entry.requirementId === id && entry.outcome === "ACTION REQUIRED");
const cabinetryBaseline = reconcileCabinetry(structuredClone(workbook));
assert.equal(cabinetryBaseline.cabinetryReconciliation.entries.filter((entry) => entry.outcome === "ACTION REQUIRED").length, 9);

let cabinetryChanged = reconcileCabinetry(updateCabinetrySelectionRequirement(cabinetryBaseline, "selection:CAB-kitchen-1791182975207", 2.75));
assert.equal(cabinetryIssue(cabinetryChanged, "selection:CAB-kitchen-1791182975207"), undefined);
assert.equal(collectCabinetryRequirements(cabinetryChanged).find((item) => item.id === "selection:CAB-kitchen-1791182975207").quantity, 2.75);

cabinetryChanged = reconcileCabinetry(classifyLegacyCabinetLine(cabinetryBaseline, "CAB-kitchen-1789936190593", "tall_pantry_600"));
assert.equal(cabinetryIssue(cabinetryChanged, "selection-retired:CAB-kitchen-1789936190593"), undefined);
assert.ok(cabinetryChanged.cabinetryReconciliation.entries.some((entry) => entry.requirementId === "selection:CAB-kitchen-1789936190593" && entry.type === "tall_pantry_600"));

cabinetryChanged = reconcileCabinetry(updateCabinetrySelectionRequirement(cabinetryBaseline, "benchtop:kitchen:benchtop-main", { kind: "length", value: 3.2 }));
const kitchenBenchtop = cabinetryIssue(cabinetryChanged, "benchtop:kitchen:benchtop-main");
assert.equal(kitchenBenchtop.reason, "Benchtop range not selected");
assert.match(kitchenBenchtop.selectedFinish, /Stone Ambassador.*Eclipse/);
assert.equal(kitchenBenchtop.action.kind, "choose-benchtop-range");

cabinetryChanged = reconcileCabinetry(updateCabinetrySelectionRequirement(cabinetryBaseline, "benchtop:main-bathroom:wallMountedVanity", { kind: "range", value: "base_range_stone" }));
assert.equal(cabinetryIssue(cabinetryChanged, "benchtop:main-bathroom:wallMountedVanity"), undefined);
const bathroomBenchtop = cabinetryChanged.cabinetryReconciliation.entries.find((entry) => entry.requirementId === "benchtop:main-bathroom:wallMountedVanity");
assert.equal(bathroomBenchtop.quantity, 1.95);
assert.equal(bathroomBenchtop.selectedFinish, "Base Range Stone");

const wardrobeId = "master-INT-SYS-FLEXI-STORAGE-WARDROBE-400MM-3-SHELF-4-DRAWER-UNIT-WHITE-MATTE";
const wardrobe = getMasterProducts(workbook.workspaceId).find((product) => product.productId === wardrobeId);
assert.equal(wardrobe?.productName, "Wardrobe 400mm 3 Shelf 4 Drawer Unit White Matte");
assert.equal(wardrobe?.priceStatus, "quote_required");
assert.equal(wardrobe?.retailReferencePrice, 189);

const products = new Map(getMasterProducts(workbook.workspaceId).map((product) => [product.productId, product]));
const productById = (productId) => products.get(productId) || null;
productById.byCode = (code) => getMasterProducts(workbook.workspaceId).find((product) => [product.productCode, product.supplierCode, product.model].filter(Boolean).map(String).includes(String(code))) || null;
const reconciliation = planSelectionReconciliation({
  workbook,
  productById,
  productByCode: productById.byCode,
  quotationEvidence: calculated.quotation,
});
assert.equal(reconciliation.mutationSummary.selectionRecords, 43);
assert.equal(reconciliation.mutationSummary.concreteProductDecisions, 52);
assert.equal(reconciliation.mutationSummary.addedRows, 9);
assert.equal(reconciliation.mutationSummary.addedSelectionDecisions, 7);
assert.equal(reconciliation.mutationSummary.replacementRows, 4);
assert.equal(reconciliation.mutationSummary.replacementSelectionDecisions, 4);
assert.equal(reconciliation.mutationSummary.unownedMutations.length, 0);
const boschRequirements = new Set(["oven", "cooktop", "rangehood", "dishwasher"]);
const boschDecisions = Object.fromEntries(reconciliation.canonicalAudit.entries
  .filter((entry) => boschRequirements.has(entry.requirementKey))
  .map((entry) => [entry.requirementKey, entry.outcome]));
assert.deepEqual(boschDecisions, {
  oven: PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE,
  cooktop: PRODUCT_SELECTION_OUTCOME.BLOCKED_BUILDER_APPROVAL,
  rangehood: PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE,
  dishwasher: PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE,
}, "only products with a verified price may proceed to builder approval; missing appliance prices stay blocked");
assert.equal(reconciliation.canonicalAudit.entries.filter((entry) => entry.outcome === PRODUCT_SELECTION_OUTCOME.BLOCKED_UNVERIFIED_BASELINE
  && ["towel-rail", "hand-towel", "toilet-roll-holder", "robe-hook"].includes(entry.requirementKey)).length, 4);
const windowsDecision = reconciliation.canonicalAudit.entries.find((entry) => entry.requirementKey === "windows");
assert.equal(windowsDecision.outcome, PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE);
assert.equal(windowsDecision.unpricedOpenings.length, 2);
assert.equal(reconciliation.selectionDecisions.length, 43);
const calculatedReconciliation = calculateEstimateBuilderWorkbook(structuredClone(reconciliation.workbook));
const repeated = planSelectionReconciliation({
  workbook: reconciliation.workbook,
  productById,
  productByCode: productById.byCode,
  quotationEvidence: calculatedReconciliation.quotation,
});
assert.equal(repeated.mutationSummary.addedRows, 0, "repeated reconciliation must not add quotation rows");
assert.equal(repeated.mutationSummary.replacementRows, 0, "repeated reconciliation must not repeat product replacements");
assert.equal(
  repeated.canonicalAudit.entries.find((entry) => entry.requirementKey === "oven")?.outcome,
  PRODUCT_SELECTION_OUTCOME.BLOCKED_MISSING_PRICE,
  "the pending Bosch oven price keeps the same selection-level decision after reconciliation",
);
const tilingOnce = normalizeQuotationStructure(connectTilingSelectionsToQuotation(
  structuredClone(workbook),
  workbook.clientSelectionsBook,
  { productById },
).quotation);
const tilingTwice = normalizeQuotationStructure(connectTilingSelectionsToQuotation(
  { ...structuredClone(workbook), quotation: tilingOnce },
  workbook.clientSelectionsBook,
  { productById },
).quotation);
assert.deepEqual(
  tilingTwice.TILING.rows.map((row) => row.id),
  tilingOnce.TILING.rows.map((row) => row.id),
  "generated tiling room groups preserve their exact ordering through save and reopen",
);

assert.equal(calculated.summary.finalQuoteTotal, 830793.38, "the current row-cost calculation, not the saved imported subtotal, controls the quotation total");
console.log("Quotation commercial issue repair: canonical selection decisions, cabinetry transfer controls, idempotence, windows, replacements, catalogue evidence, tiling reopen order and the unchanged baseline are verified.");
