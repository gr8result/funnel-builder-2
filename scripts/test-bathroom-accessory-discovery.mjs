// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-bathroom-accessory-discovery.mjs
import assert from "node:assert/strict";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { normalizeMasterProductRecord } from "../lib/product-library/catalogueModel.js";
import { classifyBathroomAccessory, discoverBathroomAccessoryTypes, LEGACY_BATHROOM_ACCESSORY_KEYS } from "../lib/product-library/bathroomAccessoryDiscovery.js";
import { discoverBathroomAccessoryRequirements, guidedRequirementByKey } from "../lib/builders/clientSelectionWorkflow.js";
import { clientSelectionCategoryProducts, clientSelectionCategorySummaries, isClientSelectionProductFor } from "../lib/product-library/plumbingFixtureCatalogue.js";
import { clientSelectionCategoryForRequirement, estimateSectionForRequirement } from "../lib/builders/clientSelectionCategories.js";
import { plumbingSelectionPatch } from "../lib/builders/plumbingSelectionPatch.js";
import { allocatedSelectionQuotationLines } from "../lib/builders/allocatedSelectionQuotation.js";

const accessory = (productType, extra = {}) => ({ productType, categoryKey: "Bathroom Accessories", ...extra });
const cases = [
  ["Double Towel Bars", "towel-rail"], ["Heated Towel Ladders", "towel-ladder"],
  ["Heated Single Towel Rails", "heated-towel-rail"], ["Heated Double Towel Rails", "heated-towel-rail"],
  ["Towel Rings", "hand-towel"], ["Hand Towel Holders", "hand-towel"],
  ["Towel Hooks", "towel-hook"], ["Robe Hooks", "robe-hook"], ["Robe Racks", "towel-rack"],
  ["Bath Robe Hooks", "robe-hook"], ["Bathroom Hooks", "robe-hook"], ["Double Robe Hooks", "robe-hook"],
  ["Toilet Paper Holders", "toilet-roll-holder"], ["Spare Toilet Roll Holders", "spare-toilet-roll-holder"],
  ["WC Brushes", "toilet-brush"], ["Soap Dishes", "soap-dish"], ["Liquid Soap Dispensers", "soap-dispenser"],
  ["Shower Shelves", "shower-shelf"], ["Shower Caddies", "shower-caddy"], ["Bathroom Shelves", "bathroom-shelf"],
  ["Glass Shelves", "glass-shelf"], ["Toothbrush Holders", "toothbrush-holder"], ["Tumblers", "tumbler"],
  ["Bathroom Accessory Sets", "accessory-set"], ["Grab Bars", "grab-rail"], ["Handrails", "hand-rail"],
  ["Shower Rails", "shower-rail-accessory"], ["Floor Wastes", "bathroom-floor-waste"],
  ["Waste Grates", "bathroom-floor-waste"], ["Shaving Mirrors", "accessory-mirror"],
  ["Paper Towel Holders", "paper-towel-holder"], ["Bidet Seats", "toilet-seat-accessory"],
];
for (const [name, key] of cases) {
  for (const field of ["productType", "subcategory", "categoryKey"]) {
    assert.equal(classifyBathroomAccessory({ categoryKey: "Bathroom Accessories", [field]: name, topLevelArea: "bathroom", tags: ["bathroom-accessories"] })?.key, key, `${field}: ${name}`);
  }
  assert.equal(classifyBathroomAccessory(accessory("", { productName: name }))?.key, key, `name: ${name}`);
}
assert.equal(classifyBathroomAccessory({ metadata: { category: { name: "Bathroom Accessories" }, tags: ["soap_dispensers"] } })?.key, "soap-dispenser");
assert.equal(classifyBathroomAccessory({ attributes: { subcategory: "TowelLadders" } })?.key, "towel-ladder");
assert.equal(classifyBathroomAccessory({ categoryPath: ["Bathroom", "Accessories"], subcategory: "Bath Cushions" })?.key, "bathroom-accessory-bath-cushion");
assert.equal(classifyBathroomAccessory({ familyKey: "toilets", productType: "Toilet Paper Holders" })?.key, "toilet-roll-holder", "specific accessory subtype in a broad fixture family");
assert.equal(classifyBathroomAccessory({ familyKey: "basins", productName: "Basin Mounted Soap Dispenser" })?.key, "soap-dispenser");
for (const product of [
  { familyKey: "toilets", productName: "Toilet Suite" },
  { familyKey: "baths", productName: "Freestanding Bath" },
  { familyKey: "basins", productName: "Countertop Basin" },
  { familyKey: "tapware", productName: "Basin Mixer", description: "Matches towel rails and soap dishes" },
  { familyKey: "showers", productName: "Twin Shower System with Rail" },
  { productName: "Shower Rail", categoryKey: "Showers" },
  { productName: "Mirror", categoryKey: "Mirrors" },
  { productName: "Hand Rail", categoryKey: "Stair Components" },
  { productName: "Paper Towel Holder", categoryKey: "Kitchen" },
  { categoryKey: "Tapware", productName: "Mixer with Soap Dispenser" },
  { categoryKey: "Bathroom Accessories", productName: "Wall Hung Pan with Bidet Seat" },
]) assert.equal(classifyBathroomAccessory(product), null, JSON.stringify(product));

const custom = normalizeMasterProductRecord({ product_code: "TEST-DISCOVERY", category: "Bathroom Accessories", sub_category: "Bath Pillows", product_type: "Bath Pillows", tags: "bathroom-accessories", metadata: { applicableRooms: ["bathroom"] } });
const customType = classifyBathroomAccessory(custom);
assert.equal(customType.key, "bathroom-accessory-bath-pillow", "new type requires no hardcoded entry");
assert.deepEqual(custom.tags, ["bathroom-accessories"]);
assert.equal(custom.subcategory, "Bath Pillows");
const duplicate = { ...custom, productId: "duplicate-id" };
assert.equal(discoverBathroomAccessoryTypes([custom, duplicate])[0].products.length, 1);
for (const flag of ["active", "enabled", "archived", "discontinued"]) {
  assert.equal(discoverBathroomAccessoryTypes([{ ...custom, [flag]: ["active", "enabled"].includes(flag) ? false : true }]).length, 0, flag);
}
const customRequirement = guidedRequirementByKey(customType.key);
assert.equal(clientSelectionCategoryForRequirement(customRequirement.requirementKey).key, "bathroom-accessories");
assert.equal(estimateSectionForRequirement(customRequirement.requirementKey), "FIX OUT - BATHROOM ACCESSORIES");
assert(discoverBathroomAccessoryRequirements([], [customType.key]).some((r) => r.requirementKey === customType.key), "saved unavailable subtype remains navigable");
// Metadata-based matching is shared by other allocated catalogue sections too.
assert(isClientSelectionProductFor({ productType: "Ceiling Fans" }, "ceiling-fan"));
assert(isClientSelectionProductFor({ attributes: { clientSelectionRequirement: "hot-water-system" } }, "hot-water-system"));
assert(!isClientSelectionProductFor({ productName: "Outdoor Kitchen with Ceiling Fan" }, "ceiling-fan"));

const products = getEffectiveProductCatalogue().products;
const groups = discoverBathroomAccessoryTypes(products);
const previouslyVisible = products.filter((p) => LEGACY_BATHROOM_ACCESSORY_KEYS.includes(p.attributes?.clientSelectionRequirement));
const discovered = new Set(groups.flatMap((g) => g.products.map((p) => p.productCode)));
assert(groups.length > LEGACY_BATHROOM_ACCESSORY_KEYS.length);
assert(discovered.size > previouslyVisible.length);
for (const product of previouslyVisible) assert(discovered.has(product.productCode), `Lost product ${product.productCode}`);
assert.equal(groups.reduce((total, g) => total + g.products.length, 0), discovered.size, "no products counted in multiple cards");
const requirements = discoverBathroomAccessoryRequirements(products);
const summaries = clientSelectionCategorySummaries(requirements);
for (const group of groups) {
  const requirement = guidedRequirementByKey(group.key);
  assert(requirement && requirement.allocationModel === "location-quantity");
  assert.equal(summaries[group.key].count, group.products.length);
  assert.deepEqual(new Set(clientSelectionCategoryProducts(requirement).map((p) => p.productCode)), new Set(group.products.map((p) => p.productCode)));
}
// Saving an unlisted type retains its category for quotation and procurement.
const patch = plumbingSelectionPatch(customRequirement, [{ lineId: "test-line", productId: custom.productId, productCode: custom.productCode, productName: "Bath Pillow", quantity: 1, unitPrice: 20, unitAllowance: 0, allocations: [{ location: "Bathroom", quantity: 1 }] }]);
const persisted = JSON.parse(JSON.stringify(patch.patch));
const lines = allocatedSelectionQuotationLines({ rooms: [{ rows: [{ ...persisted, guidedRequirementKey: customType.key }] }] });
assert.equal(lines[0].categoryKey, "bathroom-accessories");
assert.equal(lines[0].sectionName, "FIX OUT - BATHROOM ACCESSORIES - CLIENT SELECTIONS");
console.log(JSON.stringify({ passed: true, previousCards: 6, previousProducts: previouslyVisible.length, cards: groups.length, products: discovered.size, groups: groups.map((g) => ({ key: g.key, count: g.products.length })) }, null, 2));
