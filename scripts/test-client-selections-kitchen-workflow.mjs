import assert from "node:assert/strict";
import {
  EXTERIOR_REQUIREMENTS,
  INTERIOR_REQUIREMENTS,
  KITCHEN_REQUIREMENTS,
  APPLIANCE_REQUIREMENTS,
  PRICE_STATES,
  areaTotals,
  createSelectionPayloadFromProduct,
  filtersForRequirement,
  priceStateForProduct,
  productsForRequirement,
  projectTotals,
  selectedByRequirement,
  statusForRequirement,
  statusTone,
  variationFor,
  guidedRequirementByKey,
} from "../lib/builders/clientSelectionWorkflow.js";
import { createProductEntity, productLibrarySelectionsFromJobFile, writeProductLibrarySelectionToJobFile } from "../lib/product-library/catalogueModel.js";

const workspaceId = "org-test";
const projectId = "project-test";
const snapshotId = "snapshot-test";
const sessionId = "session-test";

const ovenRequirement = guidedRequirementByKey("oven");
const cooktopRequirement = guidedRequirementByKey("cooktop");
const sinkRequirement = guidedRequirementByKey("sink");
const bricksRequirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "bricks");
const roofingRequirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "roofing");

const oven = createProductEntity({
  product_code: "OVEN-WEST-900",
  product_family: "ovens",
  product_name: "Westinghouse 900mm Oven",
  supplier_name: "Winning Appliances",
  brand: "Westinghouse",
  model: "WVE916SC",
  width: "900mm",
  finish: "Stainless steel",
  client_price: 1450,
  gst_included: true,
  allowance: 1200,
  primary_image: "https://example.com/oven.jpg",
  official_product_url: "https://example.com/oven",
  active: "true",
}, workspaceId);

const cooktop = createProductEntity({
  product_code: "COOKTOP-FISHER-900",
  product_family: "cooktops",
  product_name: "Fisher & Paykel 900mm Gas Cooktop",
  supplier_name: "Winning Appliances",
  brand: "Fisher & Paykel",
  model: "CG905DW",
  width: "900mm",
  fuelType: "Gas",
  client_price: 850,
  gst_included: true,
  allowance: 950,
  primary_image: "https://example.com/cooktop.jpg",
  active: "true",
}, workspaceId);

const sinkPending = createProductEntity({
  product_code: "SINK-PENDING",
  product_family: "kitchen-sinks",
  product_name: "Undermount Kitchen Sink",
  supplier_name: "Oliveri",
  brand: "Oliveri",
  model: "SN1064U",
  allowance: 650,
  primary_image: "https://example.com/sink.jpg",
  price_status: "Price Pending",
  active: "true",
}, workspaceId);

const brick = createProductEntity({
  product_code: "BRICK-RED",
  product_family: "bricks",
  product_name: "Red Face Brick",
  supplier_name: "Brickworks",
  brand: "Austral",
  client_price: 1100,
  primary_image: "https://example.com/brick.jpg",
  active: "true",
}, workspaceId);

const ovenPayload = createSelectionPayloadFromProduct({
  workspaceId,
  projectId,
  snapshotId,
  sessionId,
  requirement: ovenRequirement,
  product: oven,
});

assert.equal(KITCHEN_REQUIREMENTS.length, 1, "Kitchen contains cabinetry; appliances use their own guided area");
assert.equal(EXTERIOR_REQUIREMENTS.length, 14, "Exterior shows the current 14-category selection set");
assert.equal(INTERIOR_REQUIREMENTS.some((item) => item.requirementKey === "kitchen"), false, "legacy room selections are excluded from the active product categories");
assert.equal(bricksRequirement.imageKey, "bricks", "Bricks category card uses the bricks image key");
assert.equal(roofingRequirement.imageKey, "roofing", "Roofing category card uses the roofing image key");
assert.ok(!EXTERIOR_REQUIREMENTS.some((item) => /roof colour/i.test(item.label)), "Roof colour is consolidated inside Roofing");
assert.equal(statusForRequirement(ovenRequirement, null), "not_started", "Oven starts grey / not selected");
assert.equal(statusTone(statusForRequirement(ovenRequirement, null)), "grey", "Incomplete untouched item is grey");
assert.equal(productsForRequirement([oven, cooktop, brick], ovenRequirement).length, 1, "Oven catalogue shows oven products only");
assert.equal(productsForRequirement([oven, cooktop, brick], cooktopRequirement)[0].productName, "Fisher & Paykel 900mm Gas Cooktop", "Cooktop navigation shows cooktops only");
assert.equal(productsForRequirement([oven, brick], sinkRequirement).length, 0, "No unrelated category fallback is used");
assert.ok(filtersForRequirement(ovenRequirement, [oven]).every((filter) => ["brand", "width", "fuelType", "finish"].includes(filter.key)), "Oven filters are family-specific");
assert.equal(ovenPayload.selected_details.requirementKey, "oven", "Saved product is attached to exact requirement");
assert.equal(ovenPayload.selected_details.quantity, 1, "Saved product retains quantity");
assert.equal(ovenPayload.selected_details.allowance, 1200, "Saved product retains allowance");
assert.equal(ovenPayload.selected_details.selectedPrice, 1450, "Saved product retains selected price");
assert.equal(ovenPayload.variation_amount, 118.18, "GST-inclusive Product Library price compares to the allowance ex GST");
assert.equal(statusForRequirement(ovenRequirement, ovenPayload), "complete", "Select updates completion status");
assert.equal(statusTone(statusForRequirement(ovenRequirement, ovenPayload)), "green", "Complete status is green");
assert.equal(variationFor({ selectedPrice: 850, allowance: 950, quantity: 1 }), -100, "Credits calculate correctly");

const cooktopPayload = createSelectionPayloadFromProduct({
  workspaceId,
  projectId,
  snapshotId,
  sessionId,
  requirement: cooktopRequirement,
  product: cooktop,
});
const sinkPayload = createSelectionPayloadFromProduct({
  workspaceId,
  projectId,
  snapshotId,
  sessionId,
  requirement: sinkRequirement,
  product: sinkPending,
});

assert.equal(priceStateForProduct(sinkPending), PRICE_STATES.pending, "Unknown product price is shown as Price Pending");
assert.equal(statusForRequirement(sinkRequirement, sinkPayload), "complete", "Unresolved price can save as selected with variation pending");
assert.equal(statusTone(statusForRequirement(sinkRequirement, sinkPayload)), "green", "Selected quote-required item turns green for auto-advance");

const selectedMap = selectedByRequirement([ovenPayload, cooktopPayload, sinkPayload], APPLIANCE_REQUIREMENTS);
assert.equal(selectedMap.get("oven").selected_product_name, "Westinghouse 900mm Oven", "Left progress navigator can show selected Oven");
assert.equal(selectedMap.get("cooktop").selected_product_name, "Fisher & Paykel 900mm Gas Cooktop", "Left progress navigator updates selected Cooktop");

const appliancesTotals = areaTotals(APPLIANCE_REQUIREMENTS, selectedMap);
assert.equal(appliancesTotals.completed, 2, "Selected oven and cooktop appear under Appliances; pending sink is a separate area");
assert.equal(appliancesTotals.variation, -59.09, "Appliance variation compares inclusive Product Library prices ex GST to allowance");
assert.equal(projectTotals([appliancesTotals]).variation, -59.09, "Running project variation uses the quote's ex-GST basis");

const savedJob = writeProductLibrarySelectionToJobFile({}, {
  selectionKey: ovenPayload.selected_details.selectionKey,
  area: ovenPayload.selected_details.area,
  requirementKey: ovenPayload.selected_details.requirementKey,
  productName: ovenPayload.selected_product_name,
  price: ovenPayload.selected_details.selectedPrice,
  allowance: ovenPayload.selected_details.allowance,
  variation: ovenPayload.selected_details.variationAmount,
});
assert.equal(productLibrarySelectionsFromJobFile(savedJob)[ovenPayload.selected_details.selectionKey].productName, "Westinghouse 900mm Oven", ".gr8job round trip preserves status/pricing shape");

const pageSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8"));
assert.ok(pageSource.includes("GuidedSelectionsWorkflow"), "the active embedded Client Selections route renders the guided workflow");
assert.ok(pageSource.includes('guidedScreen === "review"'), "the saved schedule remains behind its review step");
assert.ok(pageSource.includes("guided-client-selections-home"), "the active guided home has a stable browser-test marker");
assert.ok(pageSource.includes("guided-kitchen-checklist"), "the Kitchen cabinetry checklist has a stable browser-test marker");
assert.ok(pageSource.includes("guided-left-progress-menu"), "the category progress navigator has a stable browser-test marker");
assert.ok(!pageSource.includes("/modules/builders/client-selections"), "the active workflow does not route back to the legacy standalone showroom");

console.log("Client Selections Kitchen workflow tests passed.");
