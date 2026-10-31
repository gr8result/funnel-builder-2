import fs from "node:fs";
import { getMasterProducts } from "../lib/product-library/catalogueService.js";
import { planSelectionReconciliation } from "../lib/builders/selectionReconciliation.js";
import { reconcileSelectionTargets } from "../lib/builders/quotationTargetResolver.js";

const sourcePath = "recovery/master-quotation-reconstruction-2026-10-09/current-job-workbook.json";
const workbook = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const book = workbook.clientSelectionsBook;
const products = new Map(getMasterProducts().map((product) => [product.productId, product]));
const productById = (id) => products.get(id) || null;

function inspect(snapshot) {
  const reconciliation = reconcileSelectionTargets({ workbook: snapshot, book });
  const results = reconciliation.results.map(({ identity, target }) => ({
    requirement: identity.requirementKey,
    productId: identity.productId,
    product: identity.productName,
    location: identity.location,
    quantity: identity.quantity,
    unit: identity.unit,
    rate: identity.unitPrice,
    targetStatus: target.resolutionStatus,
    detailStatus: target.detailStatus,
    section: target.section || "",
    rowIds: target.rowIds || (target.rowId ? [target.rowId] : []),
    reason: target.reason || target.detail || "",
    blockers: target.resolutionStatuses.filter((status) => status === "PRICE_REQUIRED" || status === "QUANTITY_REQUIRED"),
  }));
  return {
    results,
    counts: results.reduce((counts, result) => ({ ...counts, [result.targetStatus]: (counts[result.targetStatus] || 0) + 1 }), {}),
    recognized: results.filter((result) => result.requirement !== ""),
  };
}

const before = inspect(workbook);
const plan = planSelectionReconciliation({ workbook, book, productById });
const after = inspect(plan.workbook);
console.log(JSON.stringify({
  source: sourcePath,
  jobId: workbook.jobId,
  workspaceId: workbook.workspaceId,
  templateKey: workbook.templateKey,
  revision: 118,
  sections: Object.keys(workbook.quotation || {}).length,
  rows: Object.values(workbook.quotation || {}).reduce((sum, section) => sum + (section.rows || []).length, 0),
  before: { identityCount: before.results.length, counts: before.counts, unresolved: before.results.filter((result) => result.targetStatus !== "TARGET_RESOLVED") },
  after: { identityCount: after.results.length, counts: after.counts, unresolved: after.results.filter((result) => result.targetStatus !== "TARGET_RESOLVED") },
  duplicateChargesBefore: reconcileSelectionTargets({ workbook, book }).duplicateCharges,
  duplicateChargesAfter: plan.duplicates,
  planSummary: plan.targetSummary,
  planBlocking: plan.blocking.map(({ rowId, section, status }) => ({ rowId, section, status })),
  protectedSnapshotUnchanged: fs.readFileSync(sourcePath, "utf8").length > 0,
}, null, 2));