import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  APPROVED_SELECTIONS_CSV_PATH,
  GENERIC_DEMO_PRODUCTS,
  GENERIC_IMAGE_URLS,
  PRODUCT_FAMILIES,
  PRODUCT_LIBRARY_IMPORT_COLUMNS,
  PRODUCT_LIBRARY_SOURCE_CSV,
  TAXONOMY_CATEGORY_DEFINITIONS,
  TOP_LEVEL_AREAS,
  buildProductFamilyDefinitions,
  buildProductLibraryTaxonomy,
  createProductEntity,
  familyByKey,
  familiesForArea,
  parseApprovedProductLibraryCsv,
  previewProductImportRows,
  selectionQueryForFamily,
} from "../lib/product-library/catalogueModel.js";

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, APPROVED_SELECTIONS_CSV_PATH);
const sourceText = fs.readFileSync(sourcePath, "utf8");
const audit = parseApprovedProductLibraryCsv(sourceText);
const taxonomy = buildProductLibraryTaxonomy(audit.usableRows);
const derivedFamilies = buildProductFamilyDefinitions(audit.usableRows);

assert.equal(PRODUCT_LIBRARY_SOURCE_CSV, "data/product-library/PRODUCTS-LIBRARY.csv", "catalogue source must be the approved repo CSV");
assert.ok(fs.existsSync(sourcePath), "approved product library CSV must exist");
assert.ok(!PRODUCT_LIBRARY_SOURCE_CSV.includes("Downloads"), "old local Downloads source must not be used");
assert.ok(!PRODUCT_LIBRARY_SOURCE_CSV.toLowerCase().includes("fixture"), "old demo fixture paths must not be used");
assert.equal(GENERIC_DEMO_PRODUCTS.length, 0, "generic demo products must not seed the standard selections template");

assert.ok(audit.totalPhysicalRows > 700, "approved CSV row count should be read from the canonical source");
assert.ok(audit.usableRows.length > 500, "approved CSV should yield quotation-derived product rows");
assert.ok(audit.headingRows.length > 20, "repeated section heading rows must be detected");
assert.ok(!audit.usableRows.some((row) => row.originalQuoteItemCode === "CODE"), "section heading rows must be ignored");
assert.ok(!audit.usableRows.some((row) => row.itemDescription.toUpperCase() === "ITEM"), "repeated ITEM header rows must be ignored");
assert.ok(audit.usableRows.every((row) => row.sourceRow > 0 && row.sourceRow <= audit.totalPhysicalRows), "all parsed rows must point back to approved CSV source rows");

const expectedTopLevelAreas = [
  "Exterior",
  "Interior",
  "Kitchen",
  "Bathroom & Ensuite",
  "Laundry",
  "Bedrooms",
  "Living Areas",
  "Garage",
  "Outdoor Areas",
  "Pool",
];
assert.deepEqual(TOP_LEVEL_AREAS.map((area) => area.displayName), expectedTopLevelAreas, "top-level selections areas must match the approved structure");
assert.deepEqual(taxonomy.areas.map((area) => area.displayName), expectedTopLevelAreas, "generated taxonomy must include every approved top-level area");

function categoryNames(areaKey) {
  return taxonomy.areas.find((area) => area.key === areaKey)?.categories.map((category) => category.displayName) || [];
}

["Bricks", "Feature Bricks", "Cladding", "Render", "Roofing", "Gutters & Fascia", "Windows", "Entry Doors", "External Doors", "Garage Doors", "Balustrades", "Handrails", "Exterior Paint", "External Lighting", "Driveway Finishes", "Decking", "Pool", "Retaining Walls", "Landscaping"].forEach((category) => {
  assert.ok(categoryNames("exterior").includes(category), `Exterior taxonomy must include ${category}`);
});
assert.ok(!categoryNames("exterior").includes("Roof Colour"), "Roof Colour must be a Roofing variant, not a standalone category");
["Cabinetry", "Cabinet Finish", "Handles", "Benchtops", "Splashback", "Sink", "Sink Mixer", "Ovens", "Cooktop", "Rangehood", "Dishwasher", "Microwave", "Flooring", "Lighting", "Paint"].forEach((category) => {
  assert.ok(categoryNames("kitchen").includes(category), `Kitchen taxonomy must include ${category}`);
});
["Vanity", "Basin", "Basin Mixer", "Shower Mixer", "Shower Outlet", "Shower Screen", "Bath", "Toilet", "Mirror", "Accessories", "Floor Tiles", "Wall Tiles", "Feature Tiles"].forEach((category) => {
  assert.ok(categoryNames("bathroom-ensuite").includes(category), `Bathroom & Ensuite taxonomy must include ${category}`);
});
["Internal Doors", "Door Hardware", "Skirting", "Architraves", "Paint", "Flooring", "Robes", "Window Furnishings"].forEach((category) => {
  assert.ok(categoryNames("interior").includes(category), `Interior taxonomy must include ${category}`);
});

const internalDoors = familyByKey("internal-doors");
assert.equal(internalDoors.topLevelArea, "interior", "Internal Doors must be under Interior");
assert.equal(internalDoors.category, "Fix Out", "Internal Doors must be under Fix Out / Interior");
assert.equal(internalDoors.subcategory, "Internal Doors", "Internal Doors subcategory must be explicit");
assert.ok(familiesForArea("interior").some((family) => family.familyKey === "internal-doors"), "Interior families must expose Internal Doors");
assert.ok(familiesForArea("exterior").some((family) => family.familyKey === "garage-doors"), "Exterior families must expose Garage Doors");

const forbiddenSupplierNames = /\b(PGH|Austral|Caesarstone|Smartstone|Hume|Colorbond|Colourbond)\b/i;
const platformFamilySchema = PRODUCT_FAMILIES.map((family) => ({
  familyKey: family.familyKey,
  displayName: family.displayName,
  topLevelArea: family.topLevelArea,
  category: family.category,
  subcategory: family.subcategory,
  sourceMatchers: family.sourceMatchers,
  requiredAttributes: family.requiredAttributes,
  optionalAttributes: family.optionalAttributes,
  supportedVariantTypes: family.supportedVariantTypes,
}));
assert.doesNotMatch(JSON.stringify(platformFamilySchema), forbiddenSupplierNames, "supplier names must not be hard-coded into mandatory platform structure");

const requiredFamilyKeys = ["stone-20mm-tops", "stone-40mm-tops", "bricks", "roofing", "garage-doors", "internal-doors", "ovens", "tapware", "tiles", "flooring"];
requiredFamilyKeys.forEach((familyKey) => {
  const family = derivedFamilies.find((item) => item.familyKey === familyKey);
  assert.ok(family, `missing product family ${familyKey}`);
  ["familyKey", "displayName", "topLevelArea", "category", "subcategory", "linkedQuoteItemCode", "unit", "quantityRule", "requiredAttributes", "optionalAttributes", "supportedVariantTypes"].forEach((field) => {
    assert.ok(Object.hasOwn(family, field), `${familyKey} must define ${field}`);
  });
  assert.ok(Array.isArray(family.requiredAttributes), `${familyKey} requiredAttributes must be an array`);
  assert.ok(Array.isArray(family.optionalAttributes), `${familyKey} optionalAttributes must be an array`);
  assert.ok(Array.isArray(family.supportedVariantTypes), `${familyKey} supportedVariantTypes must be an array`);
});

function assertFamilyAttributes(familyKey, requiredAttributes, optionalAttributes, supportedVariantTypes) {
  const family = derivedFamilies.find((item) => item.familyKey === familyKey);
  requiredAttributes.forEach((attribute) => assert.ok(family.requiredAttributes.includes(attribute), `${familyKey} must require ${attribute}`));
  optionalAttributes.forEach((attribute) => assert.ok(family.optionalAttributes.includes(attribute), `${familyKey} must optionally support ${attribute}`));
  supportedVariantTypes.forEach((variant) => assert.ok(family.supportedVariantTypes.includes(variant), `${familyKey} must support ${variant} variants`));
}

assertFamilyAttributes("stone-20mm-tops", ["supplier", "brand", "range", "colour", "finish", "thickness"], ["edgeProfile", "image", "price", "supplierURL"], ["range", "colour", "finish", "thickness", "edgeProfile"]);
assertFamilyAttributes("stone-40mm-tops", ["supplier", "brand", "range", "colour", "finish", "thickness"], ["edgeProfile", "image", "price", "supplierURL"], ["range", "colour", "finish", "thickness", "edgeProfile"]);
assertFamilyAttributes("bricks", ["supplier", "brand", "range", "brickName", "colour"], ["texture", "format", "officialColourName", "colourGroup", "image", "price", "supplierURL"], ["range", "brickName", "colour", "officialColourName", "colourGroup", "texture", "format"]);
assertFamilyAttributes("roofing", ["roofType", "manufacturer", "brand", "material", "profile", "colour", "finish"], ["materialManufacturer", "gauge", "image", "price", "supplierURL"], ["roofType", "material", "profile", "colour", "finish", "gauge"]);
assertFamilyAttributes("internal-doors", ["supplier", "brand", "range", "design", "construction", "size", "finish"], ["glazing", "image", "price", "supplierURL"], ["range", "design", "construction", "size", "finish", "glazing"]);

const kitchenStoneQuery = selectionQueryForFamily({ areaKey: "kitchen", familyKey: "stone-20mm-tops" });
assert.equal(kitchenStoneQuery.area, "kitchen", "family selection query must stay area-scoped");
assert.throws(() => selectionQueryForFamily({ areaKey: "exterior", familyKey: "stone-20mm-tops" }), /does not belong/, "wrong-area queries must fail");
assert.deepEqual(PRODUCT_LIBRARY_IMPORT_COLUMNS, [
  "product_code",
  "family_key",
  "requirement_keys",
  "category_key",
  "top_level_area",
  "manufacturer",
  "brand",
  "supplier",
  "range",
  "collection",
  "product_name",
  "model",
  "sku",
  "description",
  "colour",
  "official_colour_name",
  "colour_group",
  "finish",
  "size",
  "dimensions",
  "profile",
  "texture",
  "configuration",
  "material",
  "primary_image_url",
  "thumbnail_url",
  "gallery_image_urls",
  "image_source_url",
  "image_source_type",
  "image_verified_at",
  "image_status",
  "official_product_url",
  "specification_url",
  "brochure_url",
  "supplier_url",
  "rrp",
  "client_price",
  "currency",
  "gst_included",
  "price_unit",
  "normalized_unit_price",
  "price_status",
  "price_source_url",
  "price_verified_at",
  "country",
  "regions",
  "region_review_required",
  "active",
  "discontinued",
  "archived",
  "source_type",
  "source_name",
  "source_url",
  "source_retrieved_at",
  "source_verified_at",
  "notes",
], "master product CSV import columns must match the reusable catalogue import contract");

const orgAProduct = createProductEntity({
  product_code: "ORG-A-OVEN-1",
  linked_quote_item_code: "approved-family:ovens",
  supplier_name: "Organisation A Supplier",
  brand: "Private Brand",
  range: "Series 1",
  product_name: "Organisation A Built-in Oven",
  model: "OV-60",
  product_family: "ovens",
  colour: "Black",
  finish: "Glass",
  size: "600mm",
  width: "600",
  height: "600",
  depth: "580",
  variant_name: "Black Glass",
  primary_image: "https://example.com/oven.jpg",
  gallery_images: "https://example.com/oven-1.jpg|https://example.com/oven-2.jpg",
  official_product_url: "https://example.com/oven",
  specification_url: "https://example.com/oven.pdf",
  rrp: "1200",
  builder_cost: "900",
  client_price: "1100",
  currency: "AUD",
  gst_treatment: "GST inclusive",
  price_effective_date: "2026-08-09",
  active: "true",
  discontinued: "false",
}, "org-a");
assert.equal(orgAProduct.organisationId, "org-a", "actual products must be organisation scoped");
["productId", "productCode", "organisationId", "linkedQuoteItemCode", "familyKey", "supplier", "brand", "range", "model", "productName", "description", "colour", "finish", "size", "width", "height", "depth", "dimensions", "variants", "primaryImage", "thumbnail", "galleryImages", "colourSwatches", "officialProductURL", "specificationURL", "supplierURL", "RRP", "builderCost", "clientPrice", "allowance", "upgradePrice", "currency", "gstTreatment", "priceSource", "priceEffectiveDate", "active", "discontinued", "archived", "unavailable"].forEach((field) => {
  assert.ok(Object.hasOwn(orgAProduct, field), `actual product must support ${field}`);
});
assert.equal(orgAProduct.width, "600", "actual product must expose width");
assert.equal(orgAProduct.dimensions.depth, "580", "actual product dimensions must preserve depth");
assert.equal(orgAProduct.variants[0].variantName, "Black Glass", "actual product must preserve variant name");
assert.equal(orgAProduct.priceEffectiveDate, "2026-08-09", "actual product must preserve price effective date");

const orgBProduct = createProductEntity({ product_code: "ORG-A-OVEN-1", product_name: "Org B Oven", product_family: "ovens" }, "org-b");
assert.notEqual(orgAProduct.organisationId, orgBProduct.organisationId, "same product code in different organisations must remain private to each builder");

const importPreview = previewProductImportRows([
  {
    product_code: "ORG-A-OVEN-1",
    linked_quote_item_code: "approved-family:ovens",
    supplier_name: "Organisation A Supplier",
    brand: "Private Brand",
    range: "Series 1",
    product_name: "Organisation A Built-in Oven Updated",
    model: "OV-60",
    product_family: "ovens",
    primary_image: "https://example.com/oven.jpg",
    official_product_url: "https://example.com/oven",
    specification_url: "https://example.com/oven.pdf",
    currency: "AUD",
    gst_treatment: "GST inclusive",
    active: "true",
    discontinued: "false",
  },
  {
    product_code: "ORG-A-OVEN-1",
    product_family: "ovens",
  },
  {
    product_code: "BAD-URL",
    product_family: "ovens",
    product_name: "Bad URL",
    primary_image: "not-a-url",
  },
  {
    product_code: "NEW-TAP",
    product_family: "tapware",
    product_name: "New Mixer",
    primary_image: "https://example.com/tap.jpg",
  },
], { organisationId: "org-a", existingProducts: [orgAProduct] });
assert.equal(importPreview[0].action, "update", "changed existing organisation product must update");
assert.ok(importPreview[0].familyMapping.displayName, "import preview must expose family mapping");
assert.ok(importPreview[0].quoteItemMapping, "import preview must expose quote-item mapping");
assert.equal(importPreview[0].imagePreview, "https://example.com/oven.jpg", "import preview must expose image preview");
assert.equal(importPreview[1].action, "error", "duplicate product codes inside one import must be row-level errors");
assert.ok(importPreview[1].errors.includes("Duplicate product_code in import"), "duplicate detection must report row-level error");
assert.equal(importPreview[2].action, "error", "invalid image URL must be a row-level error");
assert.ok(importPreview[2].errors.includes("Invalid primary_image URL"), "URL validation must report the invalid field");
assert.equal(importPreview[3].action, "create", "new valid organisation product must create");

const unchangedPreview = previewProductImportRows([{
  product_code: "ORG-A-OVEN-1",
  linked_quote_item_code: "approved-family:ovens",
  supplier_name: "Organisation A Supplier",
  brand: "Private Brand",
  range: "Series 1",
  product_name: "Organisation A Built-in Oven",
  model: "OV-60",
  product_family: "ovens",
  colour: "Black",
  finish: "Glass",
  size: "600mm",
  width: "600",
  height: "600",
  depth: "580",
  variant_name: "Black Glass",
  primary_image: "https://example.com/oven.jpg",
  gallery_images: "https://example.com/oven-1.jpg|https://example.com/oven-2.jpg",
  official_product_url: "https://example.com/oven",
  specification_url: "https://example.com/oven.pdf",
  rrp: "1200",
  builder_cost: "900",
  client_price: "1100",
  currency: "AUD",
  gst_treatment: "GST inclusive",
  price_effective_date: "2026-08-09",
  active: "true",
  discontinued: "false",
}], { organisationId: "org-a", existingProducts: [orgAProduct] });
assert.equal(unchangedPreview[0].action, "skip-unchanged", "unchanged import rows must be skipped");

const pageSource = fs.readFileSync(new URL("../pages/modules/builders/product-library.js", import.meta.url), "utf8");
assert.match(pageSource, /data-area-key=\{area\.key\}/, "normal Product Library must render area cards");
assert.match(pageSource, /data-category-key=\{categoryItem\.key\}/, "normal Product Library must render category cards");
assert.match(pageSource, /openCategory\(categoryItem\.key\)/, "category cards must route to the exact selected category");
assert.match(pageSource, /setSelectedCategoryKey\(""\)/, "Back navigation must step from category back to area");
assert.match(pageSource, /router\.push\("\/modules\/builders"\)/, "root Back must use a logical Builders route");
assert.match(pageSource, /No products have been added for this category yet\./, "empty category state must be explicit");
assert.match(pageSource, /> Add Product</, "empty state must expose Add Product");
assert.match(pageSource, />\s*Import Products\s*</, "empty state must expose Import Products");
assert.match(pageSource, />Back</, "empty state must expose Back");
assert.match(pageSource, /@media \(max-width: 560px\)/, "mobile layout must have a small-screen breakpoint");
assert.match(pageSource, /grid-template-columns: 1fr;/, "mobile grids must collapse to one column instead of clipping");
assert.doesNotMatch(pageSource, /window\.history\.back/, "normal Back must not use random browser history");
assert.doesNotMatch(pageSource, /sourceRow|headingRows|manualReviewRows/, "normal Product Library must not expose raw CSV row internals");
["Add Supplier", "Add Brand", "Add Range", "Add Product", "Add Variant", "Edit", "Duplicate", "Archive", "Import CSV"].forEach((label) => {
  assert.match(pageSource, new RegExp(label), `Product Library Admin must expose ${label}`);
});
assert.match(pageSource, /workspace_id", workspaceId/, "Product Library writes must include active organisation scope");
assert.match(pageSource, /\.eq\("workspace_id", workspaceId\)/, "Product Library updates must be constrained to the active organisation");
assert.match(pageSource, /skip-unchanged/, "Product import must skip unchanged rows");
assert.match(pageSource, /imagePreview/, "Product import preview must include image previews");

const requiredVisualCategories = [
  ["exterior", "Bricks", "brick"],
  ["exterior", "Roofing", "roof"],
  ["exterior", "Garage Doors", "garage door"],
  ["interior", "Internal Doors", "door"],
  ["kitchen", "Ovens", "oven"],
  ["kitchen", "Benchtops", "stone"],
  ["bathroom-ensuite", "Tapware", "tap"],
  ["bathroom-ensuite", "Floor Tiles", "tile"],
  ["interior", "Flooring", "floor"],
];
const requiredVisualUrls = new Map();
const curatedVisualImagePattern = /^(https:\/\/images\.unsplash\.com\/|\/images\/product-library\/.+\.(?:jpg|jpeg|png|webp)$)/i;
requiredVisualCategories.forEach(([areaKey, categoryName, label]) => {
  const category = TAXONOMY_CATEGORY_DEFINITIONS.find((item) => item.topLevelArea === areaKey && item.category === categoryName);
  assert.ok(category?.image, `${categoryName} must have a visual ${label} image`);
  assert.match(category.image, curatedVisualImagePattern, `${categoryName} must render a high-quality image URL or curated local product-library asset`);
  assert.ok(!requiredVisualUrls.has(category.image), `${categoryName} must not reuse the ${requiredVisualUrls.get(category.image)} image`);
  requiredVisualUrls.set(category.image, categoryName);
});

const areaImageUrls = new Map();
TOP_LEVEL_AREAS.forEach((area) => {
  assert.ok(area.image, `${area.displayName} must have a visual card image`);
  assert.match(area.image, curatedVisualImagePattern, `${area.displayName} must render a high-quality image URL or curated local product-library asset`);
  assert.ok(!areaImageUrls.has(area.image), `${area.displayName} must not reuse the ${areaImageUrls.get(area.image)} area image`);
  areaImageUrls.set(area.image, area.displayName);
});
assert.notEqual(GENERIC_IMAGE_URLS.exterior, GENERIC_IMAGE_URLS.roofing, "Exterior and Roofing must not reuse one house image");
assert.notEqual(GENERIC_IMAGE_URLS.kitchen, GENERIC_IMAGE_URLS.ovens, "Kitchen and Ovens must not reuse one kitchen image");
assert.notEqual(GENERIC_IMAGE_URLS.garage, GENERIC_IMAGE_URLS.garageDoors, "Garage and Garage Doors must not reuse one garage image");

console.log("Product Library approved-source taxonomy tests passed.");
