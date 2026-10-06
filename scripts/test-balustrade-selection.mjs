// Balustrade systems: Product Library range, filters, LM allocation, rate x LM, allowance and
// the downstream Quotation Builder / Procurement lines.
import assert from "node:assert/strict";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import {
  balustradeAllowanceForSystem,
  balustradeFilterOptions,
  balustradeLine,
  balustradeSystems,
  filterBalustradeSystems,
  projectBalustradeEstimate,
  validateBalustradeConfiguration,
} from "../lib/builders/balustradeSelection.js";
import { plumbingAllocationRecord, plumbingAllocationSummary, plumbingLinesFromSelection, upsertPlumbingLine } from "../lib/builders/plumbingFixtureAllocation.js";
import { connectAllocatedSelectionsToQuotation } from "../lib/builders/allocatedSelectionQuotation.js";
import { EXTERIOR_REQUIREMENTS } from "../lib/builders/clientSelectionWorkflow.js";

const systems = balustradeSystems(getEffectiveProductCatalogue({}).products);
assert.ok(systems.length >= 16, `expected >= 16 balustrade systems, got ${systems.length}`);
const byType = (pattern) => systems.filter((system) => pattern.test(system.attributes.systemType));
for (const [label, pattern] of [["framed", /^Framed Glass/], ["semi-frameless", /^Semi-Frameless/], ["frameless", /^Frameless Glass/], ["side-mounted frameless", /Frameless Glass — (Side|Stair|Channel Face)/], ["top-mounted frameless", /Frameless Glass — (Spigot|Channel) Top/], ["aluminium", /^Aluminium/], ["timber", /^Timber/], ["steel", /^(Steel|Stainless)/]]) {
  assert.ok(byType(pattern).length > 0, `missing ${label} systems`);
}
systems.forEach((system) => {
  assert.ok(system.primaryImageUrl.startsWith("/images/catalogues/exterior/balustrades/"), `${system.productCode} image must be a local balustrade image`);
  assert.equal(system.priceUnit, "LM");
  assert.equal(system.priceStatus, "allowance_only", `${system.productCode} rate must not be a supplier price`);
  assert.equal(system.attributes.estimatingRate.basis, "indicative_estimating_rate");
  assert.ok(system.attributes.estimatingRate.evidence.length >= 1, `${system.productCode} rate needs evidence`);
});
assert.equal(new Set(systems.map((system) => system.productCode)).size, systems.length, "no duplicate system records");

const options = balustradeFilterOptions(systems);
["Glass", "Timber", "Aluminium", "Steel"].forEach((value) => assert.ok(options.material.includes(value), `material filter ${value}`));
["Framed", "Semi-Frameless", "Frameless"].forEach((value) => assert.ok(options.glassSystem.includes(value), `glass filter ${value}`));
["Top Mounted", "Side Mounted", "Face Mounted", "Spigot", "Channel", "Pin Fixed"].forEach((value) => assert.ok(options.mounting.includes(value), `mounting filter ${value}`));
["Stairs", "Balcony", "Deck", "Void", "Patio / Verandah"].forEach((value) => assert.ok(options.application.includes(value), `application filter ${value}`));
assert.ok(filterBalustradeSystems(systems, { material: "Glass", mounting: "Side Mounted" }).length >= 1);
assert.equal(filterBalustradeSystems(systems, { material: "Timber", glassSystem: "Frameless" }).length, 0);

// Project Estimate supplies the LM and the allowance per LM.
const workbook = { quotation: {
  "TIMBER DECKS": { rows: [{ item: "GLASS BALUSTRADE", unit: "LM", qty: 12.4, excelRate: "$375.00" }, { item: "TIMBER HANDRAIL AND BALUSTRADE", unit: "LM", qty: 0, excelRate: "$92.50" }] },
  STAIRS: { rows: [{ item: "STAIR/VOID BALUSTRADE", unit: "QUOTE", qty: 1, excelRate: "$9,000.00" }] },
} };
const estimate = projectBalustradeEstimate(workbook);
assert.equal(estimate.totalLm, 12.4);
const spigot = systems.find((system) => system.productCode === "BALUSTRADE-PROTECTORAL-GLASS");
assert.deepEqual(balustradeAllowanceForSystem(spigot, estimate), { allowancePerLm: 375, source: "TIMBER DECKS: GLASS BALUSTRADE" });

// Decimal LM per location; value = rate x LM.
const line = balustradeLine(spigot, { allocations: [{ location: "Balcony", quantity: 8.2 }, { location: "Void", quantity: 4.2 }], allowancePerLm: 375 });
assert.equal(line.unit, "LM");
assert.equal(line.quantity, 12.4);
assert.equal(line.unitPrice, 650);
assert.equal(line.selectedTotal, 8060);
assert.equal(line.allowanceTotal, 4650);
assert.equal(line.variation, 3410);
assert.equal(line.rateBasis, "indicative_estimating_rate");

// Unsupported combinations are rejected.
assert.ok(validateBalustradeConfiguration(spigot, { ...line.configuration, mounting: "Face mounted (fascia channel)" }).length > 0);
assert.equal(validateBalustradeConfiguration(spigot, line.configuration).length, 0);

// Persisted record keeps decimals and survives a reload.
const requirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "balustrades");
assert.equal(requirement.unit, "LM");
const timber = systems.find((system) => system.productCode === "BALUSTRADE-TIMBER-VERTICAL-PAINTED");
const lines = upsertPlumbingLine([line], balustradeLine(timber, { allocations: [{ location: "Deck", quantity: 6.35 }] }));
const record = plumbingAllocationRecord(requirement, lines);
const reloaded = plumbingLinesFromSelection(JSON.parse(JSON.stringify({ plumbingAllocation: record })));
assert.equal(plumbingAllocationSummary(reloaded).quantity, 18.75);
assert.equal(reloaded.find((item) => item.productCode === timber.productCode).selectedTotal, 2063.75);

// Quotation Builder + Procurement: one line per system, LM, indicative label.
const book = { rooms: [{ name: "Exterior", rows: [{ guidedRequirementKey: "balustrades", guidedSelection: { requirementKey: "balustrades", requirementLabel: "Balustrades", plumbingAllocation: record } }] }] };
const connected = connectAllocatedSelectionsToQuotation({ quotation: {}, procurement: { items: [] } }, book);
const section = connected.quotation["STAIRS & BALUSTRADES - CLIENT SELECTIONS"];
assert.ok(section, "estimate section created");
assert.equal(section.rows.length, 2);
section.rows.forEach((row) => {
  assert.equal(row.unit, "LM");
  assert.equal(row.priceStatus, "Indicative estimating rate");
});
assert.match(section.rows[0].description, /Balcony 8\.2 LM, Void 4\.2 LM/);
assert.equal(connected.procurement.items.length, 2);
assert.match(connected.procurement.items[0].rateStatus, /replace with supplier quotation/i);

console.log(`balustrade selection: ok (${systems.length} systems)`);
