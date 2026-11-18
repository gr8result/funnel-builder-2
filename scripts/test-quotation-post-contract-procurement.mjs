// Post-contract protection, Quotation Builder side (15 Nov 2026). After a contract lock, a Client Selections
// change must not rewrite the contracted quotation OR the procurement drafts on save; it is held as
// POST_CONTRACT_VARIATION_REQUIRED and becomes one variation record (idempotent). Runs the same library
// steps as the Client Selections save pipeline (useEstimateBuilderWorkbook saveClientSelections) on a
// read-only copy of the real job.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-post-contract-procurement.mjs [--job=<file.gr8job>]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { applyCabinetryRequirementsToQuotation } from "../lib/construction-estimation/cabinetryRequirements.js";
import { bookWithContractLock, createContractLock, postContractVariationRecord, POST_CONTRACT_STATUS } from "../lib/builders/contractLock.js";
import { planSelectionReconciliation, deferUnapprovedQuotationChanges } from "../lib/builders/selectionReconciliation.js";
import { refreshSelectionProcurementRequirements } from "../lib/builders/selectionProcurementRequirements.js";
import { selectionReconciliationFinancialImpact } from "../lib/builders/quotationFinancialImpact.js";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { calculateEstimateBuilderWorkbook } from "../lib/construction-estimation/estimateBuilderWorkbookCalculations.js";

const arg = process.argv.find((item) => item.startsWith("--job="))?.slice(6);
const file = arg || process.env.CLIENT_SELECTIONS_JOB_FILE || "E:/dev/quotation-recovery-20261108/restored/New Job 03 09 LATEST VERSION 11-11.gr8job";
assert(fs.existsSync(file), `real job copy not found: ${file}`);
const zip = await JSZip.loadAsync(fs.readFileSync(file));
const original = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
const owner = original.workspaceId;
// Same resolver as useEstimateBuilderWorkbook productByIdForWorkbook (master + this builder's catalogue).
const catalogue = getEffectiveProductCatalogue({ organisationId: owner, includeDisabled: true });
const products = new Map(catalogue.products.map((product) => [String(product.productId), product]));
const productsByCode = new Map();
const indexCode = (code, supplier, product) => {
  const normalizedCode = String(code || "").trim().toLowerCase();
  if (!normalizedCode) return;
  const key = `${String(supplier || "").trim().toLowerCase()}\u0000${normalizedCode}`;
  const existing = productsByCode.get(key);
  productsByCode.set(key, existing && existing.productId !== product.productId ? null : product);
};
for (const product of catalogue.products) {
  for (const code of [product.productCode, product.supplierCode, product.sku]) { indexCode(code, product.supplier, product); indexCode(code, "", product); }
  const codeSuffix = String(product.productCode || "").split("-").pop();
  if (/^\d+$/.test(codeSuffix)) { indexCode(codeSuffix, product.supplier, product); indexCode(codeSuffix, "", product); }
}
const productById = (productId) => products.get(String(productId || "")) || null;
productById.byCode = (code, supplier = "") => productsByCode.get(`${String(supplier).trim().toLowerCase()}\u0000${String(code || "").trim().toLowerCase()}`) || null;

// Same order as the save pipeline: reconcile -> refresh procurement drafts -> impact -> deferral.
function savePipeline(source, book) {
  const reconciled = planSelectionReconciliation({ workbook: { ...source, clientSelectionsBook: book }, book, productById, productByCode: productById.byCode });
  const refreshed = refreshSelectionProcurementRequirements(reconciled.workbook, calculateEstimateBuilderWorkbook(structuredClone(reconciled.workbook)), reconciled.workbook.procurement?.items || [], { productById, productByCode: productById.byCode });
  const impact = selectionReconciliationFinancialImpact(source, refreshed);
  return { impact, refreshed, saved: deferUnapprovedQuotationChanges(source, refreshed, impact) };
}
const procurementSig = (wb) => JSON.stringify((wb.procurement?.items || []).map((item) => [item.id, item.qty, item.productCode, item.supplier]).sort());

// A contract is signed on a reconciled quotation: the builder approves the pre-contract reconcile
// (this job copy's quotation had drifted from its own selections), then the job is locked.
const drift = savePipeline(applyCabinetryRequirementsToQuotation(original, owner), original.clientSelectionsBook);
const settled = applyCabinetryRequirementsToQuotation(drift.refreshed, owner);
const resettle = savePipeline(settled, settled.clientSelectionsBook);
assert.equal(resettle.impact.rowChanges.length, 0, `reconcile is idempotent: a second save after approval proposes no line changes (got ${resettle.impact.rowChanges.length})`);
const lock = createContractLock({ lockedAt: "2026-11-15T00:00:00.000Z", lockedBy: "builder" });
const locked = { ...settled, jobId: settled.jobId || "post-contract-test", clientSelectionsBook: bookWithContractLock(settled.clientSelectionsBook, lock) };

// The client changes a Kitchen cabinet quantity after contract.
const changedBook = structuredClone(locked.clientSelectionsBook);
const line = changedBook.rooms.flatMap((room) => room.rows || []).map((row) => row.guidedSelection?.cabinetrySelection).filter(Boolean)
  .flatMap((selection) => selection.schedule || []).find((entry) => Number(entry.quantity) > 0 && /kitchen/i.test(entry.location));
assert(line, "the real job has a scheduled Kitchen cabinet");
line.quantity = Number(line.quantity) + 2;

const { impact, saved } = savePipeline(locked, changedBook);
assert.deepEqual(impact.rowChanges.map((c) => c.section).sort(), ["CABINETRY", "CABINETRY"], "only the changed cabinetry lines are proposed (2-door base unit and its Sharkfin handles)");
assert.equal(saved.quotation, locked.quotation, "contracted quotation is kept exactly");
assert.equal(saved.selectionReconciliationPending?.status, POST_CONTRACT_STATUS, "change is held for a variation");
// Procurement is compared with a save of the same job with NO selection change, so only the effect of
// the post-contract change is measured (the test has no product catalogue; both runs share that).
const control = savePipeline(locked, locked.clientSelectionsBook).saved;
assert.equal(procurementSig(saved), procurementSig(control), "a post-contract cabinetry change does not alter procurement drafts");

// The approved change becomes exactly one variation; re-applying it creates no second record.
const first = postContractVariationRecord({ lock, financialImpact: impact, existing: [] });
const again = postContractVariationRecord({ lock, financialImpact: impact, existing: [first] });
assert.equal(again, first, "same change -> same variation (no duplicate charge)");
assert.equal(first.source, "client_selection_post_contract");
const cents = (n) => Math.round(n * 100);
const delta = cents(impact.rowChanges.reduce((n, c) => n + (Number(c.delta) || 0), 0)) / 100;
assert.equal(first.costSubtotalExGst, delta, "variation cost equals the quotation line deltas");
assert.equal(first.totalIncGst, Math.round(impact.delta * 100) / 100, "customer amount equals the change in the quotation's final total");
assert.equal(cents(first.subtotalExGst) + cents(first.gst), cents(first.totalIncGst), "ex-GST + GST reconciles to the variation total");

// A product WITH procurement lines changes after contract: basin mixers 5 -> 6 (Ensuite 2 -> 3).
const mixerBook = structuredClone(locked.clientSelectionsBook);
const mixer = mixerBook.rooms.flatMap((room) => room.rows || []).find((row) => row.guidedSelection?.requirementKey === "basin-mixer")?.guidedSelection;
assert(mixer, "the real job has a basin mixer selection");
// The Client Selections screen stores fixture quantities per location in plumbingAllocation.lines.
const mixerLine = mixer.plumbingAllocation?.lines?.[0];
assert(mixerLine, "basin mixer has a saved per-location allocation");
const ensuite = mixerLine.allocations.find((a) => /ensuite/i.test(a.locationKey || a.location) && !/bed|b2/i.test(a.locationKey || a.location)) || mixerLine.allocations[0];
ensuite.quantity = Number(ensuite.quantity) + 1;
const qty = (wb) => Object.values(wb.quotation).flatMap((s) => s.rows || []).find((r) => r.id?.startsWith("allocated-selection:basin-mixer:"))?.quantity;
const mixerRun = savePipeline(locked, mixerBook);
assert(mixerRun.impact.rowChanges.some((c) => /basin-mixer/.test(c.rowId)), "the basin mixer change is priced as a quotation line change");
const sameValues = (a, b) => Object.keys(a).every((s) => JSON.stringify((a[s].rows || []).map((r) => [r.id, r.quantity, r.rate])) === JSON.stringify((b[s]?.rows || []).map((r) => [r.id, r.quantity, r.rate])));
assert(sameValues(locked.quotation, mixerRun.saved.quotation) && sameValues(mixerRun.saved.quotation, locked.quotation), "contracted quotation kept after a post-contract fixture change");
assert.equal(qty(mixerRun.saved), qty(locked), "contracted basin mixer quantity unchanged");
assert.equal(mixerRun.saved.selectionReconciliationPending?.status, POST_CONTRACT_STATUS);
const mixerControlProcurement = procurementSig(control);
const mixerProcurementOk = procurementSig(mixerRun.saved) === mixerControlProcurement;
assert(mixerProcurementOk, "procurement drafts not changed by an unapproved post-contract fixture change");

// Before contract the same change still flows into the draft quotation (subject to approval).
const unlockedBook = structuredClone(mixerBook); delete unlockedBook.metadata.contractLock;
const preLocked = { ...locked, clientSelectionsBook: unlockedBook };
const pre = savePipeline(preLocked, unlockedBook);
assert.notEqual(pre.saved.selectionReconciliationPending?.status, POST_CONTRACT_STATUS);
assert.equal(qty(pre.refreshed), Number(qty(locked)) + 1, "pre-contract the proposed quotation carries the new quantity");

console.log(`PASS pre-contract drift of ${drift.impact.rowChanges.length} lines approved, re-save proposes 0. PASS post-contract: ${impact.rowChanges.length} line change(s), delta ${delta.toFixed(2)} held as ${POST_CONTRACT_STATUS}; contracted quotation and ${(locked.procurement?.items || []).length} procurement drafts unchanged; one idempotent variation ${first.number}`);
