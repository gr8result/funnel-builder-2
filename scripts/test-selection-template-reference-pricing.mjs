import assert from "node:assert/strict";
import { selectionAttention } from "../lib/builders/selectionAttention.js";
import { getMasterProducts } from "../lib/product-library/catalogueService.js";
import { resolveProductPrice } from "../lib/product-library/catalogueModel.js";
import { plumbingLineFromProduct } from "../lib/builders/plumbingFixtureAllocation.js";
import { plumbingSelectionPatch } from "../lib/builders/plumbingSelectionPatch.js";

const products = getMasterProducts();
const byCode = (code) => products.find((product) => product.productCode === code);
const codes = [
  "ENTRY-CORINTHIAN-SUNBURST-SUN-GL",
  "CLADDING-JAMES-HARDIE-LINEA-180",
  "GARAGE-SDG-COLORBOND-SECTIONAL",
  "DRIVEWAY-GENERIC-EXPOSED-AGGREGATE",
  "INT-GAINSBOROUGH-105BAISC",
  "INT-SYS-FLEXI-STORAGE-WARDROBE-400MM-3-SHELF-4-DRAWER-UNIT-WHITE-MATTE",
  "INT-STAIR-COMPLETE-CLOSED-POLISHED",
  "PLB-HNC-V780-00-1",
];

codes.forEach((code) => {
  const product = byCode(code);
  assert.ok(product, `${code} exists`);
  assert.ok(product.retailReferencePrice > 0, `${code} has a positive template reference`);
  assert.ok(["estimate", "verified_supplier"].includes(product.retailReferenceType), `${code} states whether its reference is verified or estimated`);
  assert.ok(product.retailReferenceSourceUrl, `${code} has source evidence`);
  assert.equal(resolveProductPrice(product).price, null, `${code} reference does not become an approved quotation price`);
  assert.equal(resolveProductPrice({ ...product, builderPrice: 123.45 }).price, 123.45, `${code} builder override has precedence`);
});

const mixer = byCode("PLB-HNC-V780-00-1");
const line = plumbingLineFromProduct(mixer, { allocations: [{ location: "Main Bathroom", quantity: 1 }] });
assert.equal(line.retailReferencePrice, 167, "plumbing selection snapshot keeps the non-binding reference");
assert.equal(line.unitPrice, null, "plumbing quotation price remains unapproved");

const pricedLine = plumbingLineFromProduct({ ...mixer, gstIncluded: true }, {
  unitPrice: 167,
  unitAllowance: 0,
  allocations: [{ location: "Main Bathroom", quantity: 1 }],
});
const editedPendingSelection = plumbingSelectionPatch(
  { requirementKey: "bath-mixer", label: "Bath & Shower Mixer", areaKey: "interior", areaLabel: "Plumbing Fixtures" },
  [pricedLine],
  { priceState: "Price Pending", variationPending: true },
);
assert.equal(editedPendingSelection.patch.guidedSelection.variationPending, true, "editing allocations does not silently approve a pending supplier price");
assert.equal(editedPendingSelection.patch.guidedSelection.priceState, "Price Pending");

const book = {
  rooms: [{
    rows: [
      {
        id: "mixer",
        status: "selected",
        guidedRequirementKey: "bath-mixer",
        guidedSelection: {
          requirementKey: "bath-mixer",
          requirementLabel: "Bath & Shower Mixer",
          selectedProduct: mixer.productName,
          productId: mixer.productId,
          productCode: mixer.productCode,
          priceState: "Quote Required",
          variationPending: true,
        },
      },
      {
        id: "cabinetry-progress",
        status: "in_progress",
        guidedRequirementKey: "cabinetry",
        guidedSelection: {
          requirementKey: "cabinetry",
          requirementLabel: "Cabinetry",
          selectedProduct: "1 of 7 rooms complete",
          productName: "1 of 7 rooms complete",
          priceState: "Quote Required",
          variationPending: true,
        },
      },
      {
        id: "legacy-template-placeholder",
        status: "selected",
        selectedProduct: "Legacy template product",
        imageUrl: "placeholder.jpg",
      },
      {
        id: "incomplete-fan-allocation",
        status: "selected",
        guidedRequirementKey: "ceiling-fan",
        guidedSelection: {
          requirementKey: "ceiling-fan",
          requirementLabel: "Ceiling Fans",
          selectedProduct: "Test Fan",
          productName: "Test Fan",
          plumbingAllocation: {
            requiredQuantity: 2,
            lines: [{ productName: "Test Fan", quantity: 1, allocations: [{ location: "Alfresco", quantity: 1 }] }],
          },
        },
      },
      {
        id: "incomplete-tiling-room",
        status: "selected",
        guidedRequirementKey: "tiling-rooms",
        guidedSelection: {
          requirementKey: "tiling-rooms",
          requirementLabel: "Tiles & Stone",
          selectedProduct: "1 of 2 rooms complete",
          productName: "1 of 2 rooms complete",
          tilingRoomStatuses: [
            { roomName: "Bathroom", status: "complete", missing: [] },
            { roomName: "Alfresco", status: "incomplete", missing: ["Tiling specification not chosen"] },
          ],
        },
      },
    ],
  }],
};
const attention = selectionAttention({
  book,
  productLookup: (productId, productCode) => products.find((product) => product.productId === productId || product.productCode === productCode),
});
const pricing = attention.groups.find((group) => group.key === "pricing")?.items || [];
assert.equal(pricing.length, 1);
assert.match(pricing[0].detail, /Indicative supplier reference \$167\.00 per each supply-only \(inc GST\).*Status: Template estimate/);
assert.equal(pricing[0].blocking, false);
assert.equal(pricing[0].status, "Template estimate");
assert.equal(pricing[0].action.label, "REPLACE WITH BUILDER PRICE");
assert.deepEqual(attention.pricing, { template: 1, builder: 0, missing: 0 });
const decisions = attention.groups.find((group) => group.key === "decisions")?.items || [];
assert.equal(decisions.length, 3, "nested cabinetry, allocation and room workflows remain client decisions");
assert.match(decisions[0].detail, /1 of 7 rooms complete/);
assert.match(decisions.find((item) => item.title === "Ceiling Fans").detail, /1 of 2 allocated; 1 still require/);
assert.match(decisions.find((item) => item.title === "Tiles & Stone").detail, /Alfresco: Tiling specification not chosen/);
assert.equal(pricing.some((item) => item.title.includes("Cabinetry")), false, "cabinetry progress text is not treated as a price-bearing product");
assert.equal(attention.groups.flatMap((group) => group.items).some((item) => item.title.includes("Legacy template product")), false, "legacy non-guided template rows do not become readiness items");
const contract = attention.groups.find((group) => group.key === "contract")?.items || [];
assert.equal(contract.length, 1);
assert.equal(contract[0].blocking, true, "template pricing remains a final contract approval requirement");
assert.match(contract[0].detail, /may be used in draft schedules/);
assert.match(contract[0].detail, /No price is automatically approved/);

console.log("PASS template references are visible, sourced, editable by builder override, and excluded from quotation pricing until approved.");
