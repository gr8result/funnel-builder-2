import assert from "node:assert/strict";
import fs from "node:fs";
import {
  APPLIANCE_REQUIREMENTS,
  createSelectionPayloadFromProduct,
  nextIncompleteRequirement,
  selectedByRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";

// Exercise the actual page save handler: testing the ordering helper alone did
// not catch the out-of-scope state variable used after a demo selection saved.
const page = fs.readFileSync(new URL("../pages/modules/builders/client-selections.js", import.meta.url), "utf8");
const start = page.indexOf("  async function selectProduct(");
const end = page.indexOf("\n  async function persistBudget(", start);
assert(start > 0 && end > start, "The page save handler must be present");
const handler = page.slice(start, end);
const oven = APPLIANCE_REQUIREMENTS.find(row => row.requirementKey === "oven");
const cooktop = APPLIANCE_REQUIREMENTS.find(row => row.requirementKey === "cooktop");
const product = { id: "demo-oven", productName: "Test Oven", productCode: "OVEN-1", allowance: 1200, clientPrice: 1450 };

async function save(existing = []) {
  let rows = existing;
  let nextKey;
  let message;
  const warnings = [];
  const bindings = {
    workspaceId: null, selectedProjectId: "", selectedSnapshotId: "", selectedSessionId: "",
    selectedRequirement: oven, demoSelections: existing,
    APPLIANCE_REQUIREMENTS, createSelectionPayloadFromProduct, nextIncompleteRequirement, selectedByRequirement,
    setDemoSelections: value => { rows = typeof value === "function" ? value(rows) : value; },
    openRequirement: key => { nextKey = key; },
    setSuccess: value => { message = value; },
    console: { warn: (...args) => warnings.push(args) },
  };
  const selectProduct = new Function(...Object.keys(bindings), `return (${handler});`)(...Object.values(bindings));
  assert.equal(await selectProduct(product), true);
  assert.deepEqual(warnings, [], "Saving must not emit an auto-advance exception");
  assert.match(message, /Oven selected/);
  assert.equal(selectedByRequirement(rows, APPLIANCE_REQUIREMENTS).get("oven").selected_product_name, "Test Oven");
  return { rows, nextKey };
}

const first = await save();
assert.equal(first.rows.length, 1);
assert.equal(first.nextKey, "cooktop", "A new oven selection opens the next appliance");

const completedCooktop = createSelectionPayloadFromProduct({ requirement: cooktop, product: { ...product, id: "cooktop-1", productName: "Test Cooktop" } });
const previous = { ...first.rows[0], id: "previous-oven" };
const replaced = await save([previous, completedCooktop]);
assert.equal(replaced.nextKey, "rangehood", "Already completed appliances are skipped");
assert.equal(replaced.rows.find(row => row.id === "previous-oven").is_active, false);
assert.equal(replaced.rows.filter(row => row.selected_details.requirementKey === "oven" && row.is_active !== false).length, 1);
assert.equal(previous.is_active, true, "Replacing a selection must not mutate prior state");
const complete = await save(APPLIANCE_REQUIREMENTS.map(requirement => createSelectionPayloadFromProduct({ requirement, product })));
assert.equal(complete.nextKey, undefined, "Completing every appliance must not restart the sequence");
console.log("PASS: demo appliance saves, replacements and auto-advance complete without console errors.");
