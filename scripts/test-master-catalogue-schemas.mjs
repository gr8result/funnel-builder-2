import assert from "node:assert/strict";
import {
  ESTIMATING_ITEM_RECORD_TYPE,
  EstimatingItemRecord,
  ProductRecord,
  PRODUCT_RECORD_TYPE,
  QuotationSnapshot,
  QuotationSourceReference,
  classifyCatalogueRecord,
  createQuotationSnapshot,
  createQuotationSourceReference,
  getBrandsForFamily,
  getProductsForBrand,
  getProductsForFamily,
  getProductsForRoom,
  normalizeEstimatingItemRecord,
  normalizeProductRecord,
  validateEstimatingItemRecord,
  validateProductRecord,
} from "../lib/construction-estimation/catalogues/masterCatalogueSchemas.js";
import {
  familyByLegacyKey,
  taxonomyNodeById,
} from "../lib/construction-estimation/catalogues/masterCatalogueTaxonomy.js";

const oven = normalizeProductRecord({
  id: "product:appliances:oven:westinghouse-wvep615sc",
  category: "Appliances",
  subcategory: "Ovens",
  familyKey: "ovens",
  supplier: "Winning Appliances",
  brand: "Westinghouse",
  range: "600mm Built-in Ovens",
  productCode: "WVEP615SC",
  productName: "Westinghouse 60cm Multifunction Oven",
  description: "Selectable physical oven model.",
  unit: "each",
  client_selectable: true,
  applicableRooms: ["Kitchen"],
  primaryImageUrl: "/images/product-library/example-oven.jpg",
  costPrice: 650,
  sellPrice: 895,
  specifications: { width: "600mm" },
});

const archivedHandle = normalizeProductRecord({
  id: "product:handles:legacy-handle",
  familyKey: "handles",
  productName: "Legacy Handle",
  archived: true,
  client_selectable: false,
});

const excavator = normalizeEstimatingItemRecord({
  id: "estimating:plant:excavator-day",
  category: "Siteworks",
  subcategory: "Plant Hire",
  resourceType: "plant",
  trade: "earthworks",
  code: "EXC-DAY",
  name: "Excavator hire",
  description: "Excavator and operator day hire.",
  unit: "day",
  costRate: 950,
  sellRate: 1200,
  effectiveFrom: "2026-09-02",
});

assert.equal(oven.recordType, PRODUCT_RECORD_TYPE, "product records must use product recordType");
assert.equal(excavator.recordType, ESTIMATING_ITEM_RECORD_TYPE, "estimating records must use estimating-item recordType");
assert.notEqual(oven.recordType, excavator.recordType, "product and estimating records cannot share the same record type");
assert.equal(ProductRecord.recordType, PRODUCT_RECORD_TYPE, "ProductRecord contract is exported");
assert.equal(EstimatingItemRecord.clientSelectable, false, "EstimatingItemRecord contract is not client selectable");
assert.ok(QuotationSourceReference.requiredFields.includes("sourceId"), "QuotationSourceReference contract includes stable source IDs");
assert.ok(QuotationSnapshot.frozenFields.includes("sellPrice"), "QuotationSnapshot contract freezes pricing fields");

assert.deepEqual(validateProductRecord(oven).errors, [], "valid selectable product should pass product validation");
assert.ok(validateProductRecord({ ...oven, resourceType: "labour" }).errors.includes("product cannot use estimating resourceType"), "client-selectable products cannot be classified as labour");
assert.ok(validateEstimatingItemRecord({ ...excavator, clientSelectable: true }).errors.includes("estimating items cannot be clientSelectable"), "estimating items cannot be client selectable");
assert.ok(validateEstimatingItemRecord({ ...excavator, resourceType: "plant" }).valid, "machine hire remains a valid estimating item");

const products = [
  oven,
  normalizeProductRecord({
    id: "product:appliances:oven:smeg-a1",
    category: "Appliances",
    subcategory: "Ovens",
    familyKey: "ovens",
    supplier: "Winning Appliances",
    brand: "Smeg",
    range: "900mm Built-in Ovens",
    productCode: "SMEG-A1",
    productName: "Smeg 90cm Oven",
    description: "Selectable Smeg oven model.",
    applicableRooms: ["Kitchen"],
    primaryImageUrl: "/images/product-library/example-smeg-oven.jpg",
    sellPrice: 2400,
  }),
  normalizeProductRecord({
    id: "product:electrical:light-fitting",
    familyKey: "lighting",
    brand: "Beacon",
    productCode: "BEA-PENDANT",
    productName: "Beacon Pendant",
    description: "Client-selected pendant light fitting.",
    category: "Electrical Fixtures",
    applicableRooms: ["Kitchen", "Dining"],
    primaryImageUrl: "/images/product-library/example-light.jpg",
    sellPrice: 220,
  }),
  archivedHandle,
];

assert.deepEqual(getProductsForFamily(products, "ovens").map((item) => item.id), [
  "product:appliances:oven:westinghouse-wvep615sc",
  "product:appliances:oven:smeg-a1",
], "family filtering must return active products for the requested family");
assert.deepEqual(getProductsForRoom(products, "Dining").map((item) => item.id), ["product:electrical:light-fitting"], "room filtering must use applicable rooms");
assert.deepEqual(getBrandsForFamily(products, "ovens").map((brand) => brand.id), ["smeg", "westinghouse"], "brand list must derive from family products");
assert.deepEqual(getProductsForBrand(products, "ovens", "Westinghouse").map((item) => item.productCode), ["WVEP615SC"], "brand filtering must return products in a family");
assert.equal(validateProductRecord(archivedHandle).valid, true, "archived legacy products remain resolvable");

assert.equal(classifyCatalogueRecord({ item: "ROOFING", quantity: "", unit: "", lineType: "heading" }).proposedSourceType, "heading", "headings are not products");
assert.equal(classifyCatalogueRecord({ item: "Subtotal", formulas: { cost: "=SUM(A1:A4)" } }).proposedSourceType, "formula", "formula rows are not products");
assert.equal(classifyCatalogueRecord({ item: "Excavator hire", unit: "DAY" }).proposedSourceType, "estimating-item", "machine hire cannot appear in Client Selections");
assert.equal(classifyCatalogueRecord({ item: "Prime cost oven allowance", unit: "ITEM" }).proposedSourceType, "allowance", "allowance rows are not physical products");
assert.equal(classifyCatalogueRecord({ item: "Supply and install selected oven", unit: "EACH" }).proposedSourceType, "assembly", "product plus installation rows are assemblies");

const reference = createQuotationSourceReference({
  sourceType: "product",
  sourceId: oven.id,
  sourceVersion: "v1",
  categoryId: "Appliances",
  subcategoryId: "Ovens",
});
assert.deepEqual(reference, {
  sourceType: "product",
  sourceId: oven.id,
  sourceVersion: "v1",
  categoryId: "category:appliances",
  subcategoryId: "subcategory:ovens",
}, "quotation references must use stable IDs independent from labels");
assert.equal(taxonomyNodeById("category:appliances")?.label, "Appliances", "shared taxonomy exposes stable category IDs");
assert.equal(familyByLegacyKey("ovens")?.id, "family:built-in-ovens", "legacy Product Library family keys map to stable taxonomy family IDs");

const snapshot = createQuotationSnapshot({ sourceType: "product", record: oven, selectedOptions: { finish: "Stainless steel" }, snapshotAt: "2026-09-02T00:00:00.000Z" });
const modified = { ...oven, description: "Updated supplier copy", sellPrice: 999 };
assert.equal(snapshot.description, "Selectable physical oven model.", "quotation snapshot description remains frozen");
assert.equal(snapshot.sellPrice, 895, "quotation snapshot price remains frozen");
assert.equal(modified.sellPrice, 999, "test fixture sanity check for changed master record");

console.log("Master catalogue schema tests passed.");
