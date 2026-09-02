import assert from "node:assert/strict";
import { buildWindowWorkflowModels } from "../takeoff/windowWorkflow.js";

const page = {
  id: "page-1",
  documentId: "doc-1",
  areas: [{ name: "Bedroom 1", level: "Ground Level" }],
};

const openings = [
  {
    id: "op-1",
    openingType: "window",
    windowType: "awning",
    code: "W01",
    widthMm: 1200,
    heightMm: 900,
    quantity: 1,
    room: "Bedroom 1",
    level: "Ground Level",
    frameMaterial: "Aluminium",
    frameColour: "Monument",
    glazingType: "Low-E",
    glassThickness: "6 mm",
    flyscreen: "Standard",
    securityScreen: "None",
    supplier: "AWS",
    productModel: "Series 525",
    source: "detected",
    confirmed: true,
  },
  {
    id: "op-2",
    openingType: "window",
    windowType: "awning",
    code: "W01",
    widthMm: 1200,
    heightMm: 900,
    quantity: 2,
    room: "Bedroom 2",
    level: "Ground Level",
    frameMaterial: "Aluminium",
    frameColour: "Monument",
    glazingType: "Low-E",
    glassThickness: "6 mm",
    flyscreen: "Standard",
    securityScreen: "None",
    supplier: "AWS",
    productModel: "Series 525",
    source: "manual",
    confirmed: true,
  },
  {
    id: "op-3",
    openingType: "window",
    windowType: "fixed",
    code: "W02",
    widthMm: 600,
    heightMm: 1500,
    quantity: 1,
    room: "Stair",
    level: "Second Level",
    frameMaterial: "Aluminium",
    frameColour: "White",
    glazingType: "Obscure",
    source: "detected",
    confirmed: false,
  },
  { id: "door-1", openingType: "door", widthMm: 820, heightMm: 2040, quantity: 1 },
];

const workflow = buildWindowWorkflowModels(openings, page);

assert.equal(workflow.windowRecords.length, 3, "doors and other openings must not become window records");
assert.equal(workflow.windowOrderLines.length, 2, "matching window specs must reconcile into one order line");
assert.equal(workflow.windowOrderLines.find((line) => line.code === "W01").quantity, 3, "same-spec windows must add quantities");
assert.equal(workflow.windowOrderLines.find((line) => line.code === "W02").quantity, 1, "different specs must remain separate");
assert.equal(workflow.quotationBuilderModel.windowLineItems.length, 2, "quotation model must receive window order lines");
assert.deepEqual(workflow.windowReconciliation.possibleDuplicates, ["window-order-1"], "same-spec repeats must be shown as possible duplicate/reconciled groups");
assert.equal(workflow.windowReconciliation.planDetected, 2, "detected windows must be counted separately");
assert.equal(workflow.windowReconciliation.manuallyAdded, 1, "manual windows must be counted separately");
assert.equal(workflow.windowReconciliation.finalOrderQty, 4, "final order quantity must sum grouped quantities");
assert.ok(workflow.windowsDoorsModel.rows[0].pageId, "records must carry page identity for save/reload");
assert.ok(workflow.purchaseOrderWindowLines.length, "approved-ready lines must feed purchase order model");

console.log("windowWorkflow.test.mjs passed");
