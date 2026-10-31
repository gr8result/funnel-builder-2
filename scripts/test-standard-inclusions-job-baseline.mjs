import assert from "node:assert/strict";
import {
  applyStandardInclusionsToWorkbook,
  buildJobInclusionSnapshot,
  JOB_APPLICATION_STATUS,
  planJobInclusionApplication,
  suggestSelectionSlot,
} from "../lib/standard-inclusions/jobBaseline.mjs";
import { normalizeCatalogueProduct, validateProductProposals } from "../lib/standard-inclusions/productProposal.mjs";
import { connectTenantSelectionMetadata } from "../lib/builders/tenantSelectionQuotation.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

// Catalogue rows normalise to the same shape the review screen and baseline read.
const tapRow = { id: "prod-tap", product_name: "Kitchen Sink Mixer", base_allowance: 330, upgrade_cost: 520, sku: "KM-1", metadata: { productEntity: { brand: "Example", category: "Kitchen Mixer", gstIncluded: true } } };
const tap = normalizeCatalogueProduct(tapRow);
assert.equal(tap.name, "Kitchen Sink Mixer");
assert.equal(tap.allowance, 330, "base_allowance is the allowance, not the price");
assert.equal(tap.price, 520);
const proposed = validateProductProposals({
  proposals: [{ category: "Kitchen", productId: "prod-tap" }, { category: "Kitchen", productId: "invented" }],
  categories: ["Kitchen"],
  products: [tap],
  eligibleProductIdsByCategory: { Kitchen: ["prod-tap"] },
});
assert.equal(proposed.proposals.length, 1, "an AI productId absent from the catalogue is dropped");
assert.equal(proposed.proposals[0].product.name, "Kitchen Sink Mixer", "proposals carry the review-screen product name");
assert.ok(Array.isArray(proposed.proposals[0].missingInformation));
assert.equal(suggestSelectionSlot(tap), "kitchen_mixer");
assert.equal(suggestSelectionSlot({ name: "Builder's clean", category: "Services" }), "");

const versionId = "ver-2";
const schedule = {
  id: "sched-1", name: "Classic", tierKey: "Classic",
  currentVersion: { id: versionId, versionNumber: 2 },
  versions: [{ id: "ver-1", versionNumber: 1 }, { id: versionId, versionNumber: 2 }],
  metadata: {
    publishedSnapshots: [
      { versionId: "ver-1", items: [] },
      {
        versionId, publishedAt: "2026-10-18T00:00:00.000Z",
        items: [
          { id: "i1", category: "Kitchen", reviewStatus: "approved", product: tap, selectionSlotId: "kitchen_mixer", origin: "workspace-product-library" },
          { id: "i2", category: "Services", reviewStatus: "approved", product: null, description: "Builder's clean", origin: "custom" },
          { id: "i3", category: "Kitchen", reviewStatus: "rejected", product: tap, selectionSlotId: "kitchen_mixer" },
        ],
      },
    ],
  },
};

const snapshot = buildJobInclusionSnapshot({ workspaceId: A, schedule });
assert.equal(snapshot.schedule.scheduleVersionId, versionId);
assert.equal(snapshot.items.length, 1, "only approved, slotted catalogue products price quote rows");
assert.equal(snapshot.descriptiveItems.length, 1, "descriptive inclusions stay in the baseline record");
assert.equal(snapshot.items[0].baselineUnitPrice, 300, "GST-inclusive allowance is converted to ex GST once");
assert.equal(snapshot.items[0].metadata.productSnapshot.productId, "prod-tap");
assert.throws(() => buildJobInclusionSnapshot({ workspaceId: A, schedule: { ...schedule, metadata: { publishedSnapshots: [{ versionId: "ver-1", items: [] }] } } }), /no approved inclusion snapshot/, "a snapshot from another version never stands in");

const foundation = {
  workspace_id: A,
  configurations: [{ workspace_id: A, selection_slot_id: "kitchen_mixer", enabled: true }],
  mappings: [],
};
const workbook = {
  jobId: "job-1", workspaceId: A, templateKey: "t",
  quotation: {
    KITCHEN: { id: "kitchen", rows: [
      { id: "row-mixer", item: "Sink mixer", qty: 1, selectionSlotId: "kitchen_mixer" },
      { id: "row-manual", item: "Benchtop", qty: 4, manualRate: 900 },
    ] },
  },
};

assert.equal(planJobInclusionApplication(workbook, snapshot).status, JOB_APPLICATION_STATUS.NEW);
const first = applyStandardInclusionsToWorkbook(workbook, snapshot, foundation);
assert.equal(first.applied, true);
const rowsOf = (wb) => Object.values(wb.quotation).flatMap((section) => section.rows);
const mixer = rowsOf(first.workbook).find((row) => row.id === "row-mixer");
assert.equal(mixer.baselineProductId, "prod-tap");
assert.equal(mixer.baselineUnitPrice, 300);
assert.equal(mixer.selectionStatus, "INCLUDED", "a baseline product is never recorded as a client-confirmed selection");
assert.equal(mixer.selectedProductId, undefined);
assert.equal(mixer.qty, 1, "quantity is untouched");
assert.equal(rowsOf(first.workbook).length, 2, "no rows are created");
assert.equal(rowsOf(first.workbook).find((row) => row.id === "row-manual").manualRate, 900, "manual overrides are preserved");
assert.equal(first.workbook.jobInclusionSnapshot.schedule.scheduleVersionId, versionId);

const second = applyStandardInclusionsToWorkbook(first.workbook, JSON.parse(JSON.stringify(snapshot)), foundation);
assert.equal(second.applied, false, "the same version applied twice is a no-op");
assert.equal(second.workbook, first.workbook);

const otherVersion = buildJobInclusionSnapshot({ workspaceId: A, schedule: { ...schedule, currentVersion: { id: "ver-3", versionNumber: 3 }, versions: [...schedule.versions, { id: "ver-3", versionNumber: 3 }], metadata: { publishedSnapshots: [...schedule.metadata.publishedSnapshots, { versionId: "ver-3", items: [{ ...schedule.metadata.publishedSnapshots[1].items[0], product: { ...tap, allowance: 440 } }] }] } } });
const conflict = planJobInclusionApplication(first.workbook, otherVersion);
assert.equal(conflict.status, JOB_APPLICATION_STATUS.CONFLICT);
assert.equal(conflict.changes[0].toPrice, 400);
assert.throws(() => applyStandardInclusionsToWorkbook(first.workbook, otherVersion, foundation), /different inclusion baseline/);

// Client Selections reads the SAME stored baseline: a later client choice replaces the active
// product while the original baseline stays for variation tracking.
const withClientChoice = {
  ...first.workbook,
  clientSelectionsBook: { rooms: [{ id: "kitchen", rows: [{ id: "sel", selectionSlotId: "kitchen_mixer", workspace_id: A, productId: "prod-upgrade", productName: "Upgrade mixer", selectedPrice: 660, priceIncludesGst: true, status: "SELECTED", applyToAll: true }] }] },
};
const connected = connectTenantSelectionMetadata(withClientChoice, withClientChoice.clientSelectionsBook, foundation);
const selectedRow = rowsOf(connected).find((row) => row.id === "row-mixer");
assert.equal(selectedRow.baselineProductId, "prod-tap", "original baseline is preserved for comparison");
assert.equal(selectedRow.baselineUnitPrice, 300);
assert.equal(selectedRow.activeProductId, "prod-upgrade", "approved client change replaces the inclusion through existing reconciliation");
assert.equal(selectedRow.selectionStatus, "UPGRADE");
assert.equal(selectedRow.variationUnitDifference, 300);

// Workspace isolation: a baseline built for A cannot be applied to B's job.
assert.throws(() => applyStandardInclusionsToWorkbook({ ...workbook, workspaceId: B }, snapshot, { ...foundation, workspace_id: B }), /workspace mismatch/i);

console.log("standard inclusions job baseline: ok");
