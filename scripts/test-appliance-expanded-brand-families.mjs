import assert from "node:assert/strict";
import {
  APPLIANCE_FAMILIES,
  applianceProductToCatalogueRecord,
  createApplianceCatalogueSelectors,
  filterApplianceRecords,
  isApplianceRecordSelectable,
} from "../lib/product-library/applianceCatalogueSelectorsCore.js";
import { applianceHncPriceLabel, appliancePriceLabel, applianceSelectionUnavailableReason, applianceSpecificationEntries, productIsAppliance } from "../lib/product-library/applianceCataloguePresentation.js";

const activeBrands = ["Bosch", "Euromaid", "Omega", "Smeg", "Westinghouse", "Whirlpool"];
const product = (brandName, familyId, manufacturerModel, extra = {}) => ({
  productId: `${brandName}:${manufacturerModel}`, brandName, familyId, manufacturerModel,
  productName: `${brandName} ${manufacturerModel}`, sku: `SKU-${manufacturerModel}`,
  descriptionStatus: "verified-complete", specificationStatus: "complete", active: true, selectable: true,
  ...extra,
});
const newFamilies = ["freezers", "washing-machines", "dryers", "washer-dryers", "appliance-accessories", "other-appliances"];
const catalogue = {
  products: [
    ...activeBrands.map((brandName) => product(brandName, "ovens", "OVEN1")),
    ...newFamilies.map((familyId, index) => product("Whirlpool", familyId, `EXACT${index}`, {
      fullDescription: "Exact supplier description for laundry and refrigeration",
      specifications: { capacity: "9 kg", features: ["Verified cycle"], noiseLevel: 0, childLock: false, rating: { stars: 4 }, pendingValue: null },
      primaryImage: `/images/whirlpool/exact${index}.jpg`, imageStatus: "verified-authorised-supplier-local",
    })),
    product("Whirlpool", "freezers", "RETIRED", { active: false }),
    product("Whirlpool", "freezers", "REFERENCE", { selectable: false }),
    product("Blanco", "ovens", "HISTORICAL"),
  ],
};
const selectors = createApplianceCatalogueSelectors({
  productCatalogue: catalogue,
  brandCatalogue: { brands: [
    ...activeBrands.map((brandName) => ({ brandName, logoUrl: `/logos/${brandName}.svg` })),
    { brandName: "Blanco", active: false, selectable: false },
  ] },
  packCatalogue: { packs: [{ packId: "whirlpool-pack", brandName: "Whirlpool", packName: "Whirlpool package", componentProductIds: ["Whirlpool:OVEN1"] }] },
});

assert.deepEqual(selectors.getApplianceBrands().map((brand) => brand.brandName), activeBrands, "brand cards come from active catalogue records");
const whirlpool = selectors.getApplianceBrands().find((brand) => brand.brandName === "Whirlpool");
assert.equal(whirlpool.logoUrl, "/logos/Whirlpool.svg");
assert.equal(whirlpool.count, newFamilies.length + 2, "brand count includes actual visible products and package");
const products = selectors.getActiveProductLibraryApplianceRecords().filter((record) => record.brand === "Whirlpool");
assert.equal(products.length, newFamilies.length + 1, "individual count excludes inactive, non-selectable and package records");
assert.equal(selectors.getApplianceRecordsByFamily("appliance-packs").length, 1);
assert.equal(products.filter((record) => record.selectableStatus === "client-selectable").length, products.length);
assert.deepEqual(filterApplianceRecords(products, { selectable: "not-client-selectable" }), []);
assert.equal(filterApplianceRecords(products, { status: "active-selectable" }).length, products.length);
for (const familyId of newFamilies) {
  assert.ok(APPLIANCE_FAMILIES.some((family) => family.familyId === familyId));
  assert.equal(selectors.getApplianceFamilies().find((family) => family.familyId === familyId).productCount, 1);
  const records = filterApplianceRecords(products, { productType: familyId });
  assert.equal(records.length, 1);
  assert.equal(records[0].familyId, familyId);
  assert.ok(records[0].image, "exact supplied image remains visible");
  assert.equal(productIsAppliance({ familyId }), true);
  assert.equal(productIsAppliance({ familyKey: familyId }), true);
}
assert.equal(filterApplianceRecords(products, { search: "SKU-EXACT0" })[0]?.model, "EXACT0", "SKU search resolves exact model");
assert.equal(filterApplianceRecords(products, { search: "supplier description" }).length, newFamilies.length);
assert.equal(filterApplianceRecords(products, { search: "Verified cycle" }).length, newFamilies.length, "specification search is available");
const specifications = applianceSpecificationEntries(products.find((record) => record.model === "EXACT0"));
assert.deepEqual(specifications.find((entry) => entry.key === "noiseLevel"), { key: "noiseLevel", label: "Noise Level", value: "0" });
assert.equal(specifications.find((entry) => entry.key === "childLock").value, "No");
assert.equal(specifications.find((entry) => entry.key === "rating").value, "Stars: 4");
assert.equal(specifications.some((entry) => entry.key === "pendingValue"), false, "missing specifications are never invented");
assert.deepEqual(applianceSpecificationEntries({}), []);
const sourceVerified = product("Whirlpool", "washing-machines", "SOURCED1", {
  descriptionStatus: "source-verified", specificationStatus: "source-verified-published-fields",
  specifications: { capacity: "9 kg", unknownEnergyRating: null },
  research: { verificationStatus: "source-verified" }, manufacturerRangeStatus: "archived-on-manufacturer-site",
  manualReviewRequired: false, hncPrice: 1099.95, priceStatus: "fixed", sellPrice: null, tenantSellPrice: null,
});
const sourcedRecord = applianceProductToCatalogueRecord(sourceVerified);
assert.equal(sourcedRecord.eligibility, "active-selectable", "all source-published fields can be verified while unpublished values remain unknown");
assert.equal(isApplianceRecordSelectable(sourcedRecord), true);
assert.equal(sourcedRecord.specifications.unknownEnergyRating, null);
assert.equal(sourcedRecord.manufacturerRangeStatus, "archived-on-manufacturer-site", "manufacturer archive conflict remains explicit");
assert.equal(sourcedRecord.price, 1099.95, "HNC reference is available to catalogue consumers");
assert.equal(sourcedRecord.tenantSellPrice, null, "reference price never becomes a tenant sell price");
assert.equal(sourcedRecord.sellPrice, null);
assert.equal(sourcedRecord.priceIsHncReference, true);
assert.equal(applianceHncPriceLabel(sourcedRecord), "HNC SRP (inc. GST): $1,099.95");
const existingRecord = applianceProductToCatalogueRecord({ ...sourceVerified, tenantSellPrice: 900, sellPrice: 850 });
assert.equal(existingRecord.price, 900, "existing tenant sell price retains precedence");
assert.equal(existingRecord.priceIsHncReference, false);
assert.equal(appliancePriceLabel(existingRecord), "$900 EACH");
assert.equal(applianceHncPriceLabel(existingRecord), "HNC SRP (inc. GST): $1,099.95", "distinct HNC price is still labelled independently");
for (const extra of [{ descriptionStatus: "pending" }, { specificationStatus: "partial" }, { manualReviewRequired: true }, { imageStatus: "exact-image-unavailable" }]) {
  const record = applianceProductToCatalogueRecord({ ...sourceVerified, ...extra });
  assert.equal(record.eligibility, "verification-required", "pending, partial and review-required records do not gain selectable status");
  assert.equal(isApplianceRecordSelectable(record), false, "selection handlers and buttons reject records awaiting verification");
  assert.ok(applianceSelectionUnavailableReason(record), "disabled selection has a visible reason");
}
const sourceReviewSelectors = createApplianceCatalogueSelectors({ productCatalogue: { products: [sourceVerified, { ...sourceVerified, productId: "review-needed", manualReviewRequired: true, manualReviewReason: "Conflicting supplier dimensions" }] } });
assert.equal(sourceReviewSelectors.getActiveProductLibraryApplianceRecords().length, 2, "review record remains available for browsing and details");
assert.equal(sourceReviewSelectors.getClientSelectableApplianceRecords().length, 1, "client-selectable statistic excludes review records");
assert.equal(applianceSelectionUnavailableReason(sourceReviewSelectors.getApplianceProductById("review-needed")), "Conflicting supplier dimensions");
for (const hncPrice of [null, "", undefined, 0, "not supplied"]) assert.equal(applianceHncPriceLabel({ hncPrice }), "", "missing or invalid source prices are not invented");
console.log("PASS: six dynamic brand cards, exact images, expanded appliance categories, active/selectable filtering, SKU/specification search and full detail specifications.");
