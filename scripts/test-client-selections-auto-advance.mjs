import assert from "node:assert/strict";
import {
  ALL_GUIDED_REQUIREMENTS,
  EXTERIOR_REQUIREMENTS,
  KITCHEN_REQUIREMENTS,
  PRICE_STATES,
  areaTotals,
  createSelectionPayloadFromProduct,
  nextIncompleteRequirement,
  projectTotals,
  selectedByRequirement,
  statusForRequirement,
  variationFor,
} from "../lib/builders/clientSelectionWorkflow.js";

function selection(requirement, overrides = {}) {
  return {
    selection_status: "selected",
    status: "selected",
    is_active: true,
    selected_details: {
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
      allowance: 1200,
      selectedPrice: 1450,
      variationAmount: 250,
      priceState: PRICE_STATES.current,
      ...overrides,
    },
    metadata: {
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
    },
  };
}

const roofing = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "roofing");
const windows = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "windows");
const bricks = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "bricks");
const cladding = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "cladding");
const oven = KITCHEN_REQUIREMENTS.find((item) => item.requirementKey === "oven");
const cooktop = KITCHEN_REQUIREMENTS.find((item) => item.requirementKey === "cooktop");

assert.equal(variationFor({ selectedPrice: 1450, allowance: 1200, quantity: 1 }), 250, "variation should calculate upgrades");
assert.equal(variationFor({ selectedPrice: 1050, allowance: 1200, quantity: 1 }), -150, "variation should calculate credits");

const currentProductPayload = createSelectionPayloadFromProduct({
  workspaceId: "org-1",
  projectId: "project-1",
  snapshotId: "snapshot-1",
  sessionId: "session-1",
  requirement: oven,
  product: {
    id: "oven-1",
    productId: "master-oven-1",
    productName: "Westinghouse 600mm Oven",
    productCode: "OVEN-WH-600",
    model: "WVE655",
    brand: "Westinghouse",
    supplier: "Appliance supplier",
    allowance: 1200,
    clientPrice: 1450,
    linkedQuoteItemCode: "APPLIANCES",
    primaryImage: "https://example.test/oven.jpg",
    officialProductURL: "https://example.test/oven",
  },
});

assert.equal(currentProductPayload.selected_details.productId, "master-oven-1", "selection commit preserves product id");
assert.equal(currentProductPayload.selected_details.productCode, "OVEN-WH-600", "selection commit preserves product code");
assert.equal(currentProductPayload.source_quote_row_id, "APPLIANCES", "quote linkage is preserved");
assert.equal(currentProductPayload.client_selection_price, 1450, "selected price is stored for current prices");
assert.equal(currentProductPayload.variation_amount, 250, "variation is stored for current prices");
assert.equal(currentProductPayload.selection_status, "selected", "committed selections are selected");

const quoteRequiredPayload = createSelectionPayloadFromProduct({
  workspaceId: "org-1",
  projectId: "project-1",
  requirement: roofing,
  product: {
    id: "roofing-1",
    productName: "CUSTOM ORB / Surfmist / Matt",
    productCode: "ROOFING-CUSTOM-ORB",
    priceStatus: "quote_required",
    allowance: 0,
    linkedQuoteItemCode: "ROOFING",
  },
});

assert.equal(quoteRequiredPayload.selected_details.selectedPrice, null, "quote-required selected price is not stored as zero");
assert.equal(quoteRequiredPayload.selected_details.variationPending, true, "quote-required selections mark variation pending");
assert.equal(quoteRequiredPayload.status, "selected", "price-pending selections are still workflow-selected");
assert.equal(statusForRequirement(roofing, quoteRequiredPayload), "complete", "price-pending selected requirements are visually complete");

const exteriorSelections = new Map([
  [bricks.requirementKey, selection(bricks)],
  [cladding.requirementKey, selection(cladding)],
  [roofing.requirementKey, quoteRequiredPayload],
]);
assert.equal(nextIncompleteRequirement(EXTERIOR_REQUIREMENTS, exteriorSelections, roofing)?.requirementKey, windows.requirementKey, "auto-advance opens the next incomplete exterior item");

const skipCompletedSelections = new Map(exteriorSelections);
skipCompletedSelections.set(windows.requirementKey, selection(windows));
assert.equal(nextIncompleteRequirement(EXTERIOR_REQUIREMENTS, skipCompletedSelections, roofing)?.requirementKey, "entry-door", "auto-advance skips completed requirements");

const kitchenSelections = new Map([
  [oven.requirementKey, selection(oven)],
]);
assert.equal(nextIncompleteRequirement(KITCHEN_REQUIREMENTS, kitchenSelections, oven)?.requirementKey, cooktop.requirementKey, "kitchen auto-advance stays within kitchen order");

const allComplete = new Map(ALL_GUIDED_REQUIREMENTS.map((requirement) => [requirement.requirementKey, selection(requirement)]));
assert.equal(nextIncompleteRequirement(ALL_GUIDED_REQUIREMENTS, allComplete, ALL_GUIDED_REQUIREMENTS.at(-1)), null, "all-complete state does not loop back to the first item");

const changedSelectionMap = new Map([[oven.requirementKey, selection(oven, { productCode: "OLD" })]]);
changedSelectionMap.set(oven.requirementKey, selection(oven, { productCode: "NEW", selectedPrice: 1300, variationAmount: 100 }));
assert.equal(changedSelectionMap.get(oven.requirementKey).selected_details.productCode, "NEW", "change selection updates the existing requirement record");
assert.equal(changedSelectionMap.size, 1, "change selection does not create a duplicate requirement record");

const rebuiltMap = selectedByRequirement([...changedSelectionMap.values()], KITCHEN_REQUIREMENTS);
assert.equal(rebuiltMap.get(oven.requirementKey).selected_details.productCode, "NEW", "save/reload rebuild preserves committed selection identity");

const totals = areaTotals([oven, cooktop], new Map([
  [oven.requirementKey, selection(oven, { selectedPrice: 1450, allowance: 1200, variationAmount: 250 })],
  [cooktop.requirementKey, selection(cooktop, { selectedPrice: 1050, allowance: 1200, variationAmount: -150 })],
]));
assert.equal(totals.selected, 2500, "running totals include selected prices immediately");
assert.equal(totals.variation, 100, "running totals include upgrade and credit net variation");
assert.equal(projectTotals([totals]).completed, 2, "project totals count completed requirements immediately");

assert.equal(currentProductPayload.selected_details.imageReference, "https://example.test/oven.jpg", "final schedule reads image reference from the same selection record");
assert.equal(currentProductPayload.selected_details.officialProductURL, "https://example.test/oven", "final schedule reads official URL from the same selection record");

console.log("Client Selections auto-advance regression tests passed.");
