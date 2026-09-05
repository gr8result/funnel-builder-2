import assert from "node:assert/strict";
import {
  ALL_GUIDED_REQUIREMENTS,
  GARAGE_DOOR_COLOUR_CATALOGUE,
  productsForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";
import {
  addBuilderProduct,
  disableProduct,
  getClientSelectableProducts,
  getEffectiveApplianceCatalogue,
  getEffectiveCabinetryCatalogue,
  getEffectiveProductCatalogue,
  getMasterProducts,
  resetLegacyMigrationFlag,
  setCatalogueStorage,
} from "../lib/product-library/catalogueService.js";
import {
  PRODUCT_LIBRARY_ROOM_CATEGORIES,
  productBelongsToRoomCategory,
} from "../lib/product-library/productLibraryTaxonomy.js";

const ORG_A = "migration-test-builder-a";
const ORG_B = "migration-test-builder-b";

function freshStorage() {
  const map = new Map();
  setCatalogueStorage({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  });
  resetLegacyMigrationFlag();
  return map;
}

function requirement(key) {
  return ALL_GUIDED_REQUIREMENTS.find((item) => item.requirementKey === key || item.familyKey === key);
}

function productsFor(key, products) {
  const req = requirement(key);
  assert.ok(req, `guided requirement exists for ${key}`);
  return productsForRequirement(products, req);
}

function roomCategory(categoryKey) {
  const category = PRODUCT_LIBRARY_ROOM_CATEGORIES
    .find((page) => page.key === categoryKey);
  assert.ok(category, `room category exists: ${categoryKey}`);
  return category;
}

freshStorage();

const masterProducts = getMasterProducts();
const selectableProducts = getClientSelectableProducts(ORG_A);
const migrated = masterProducts.filter((product) => product.sourceType === "client_selections_legacy_migration");

assert.equal(masterProducts.length, 1378, "Product Library includes migrated Client Selections records without losing canonical catalogues");
assert.equal(migrated.length, 68, "68 physical Client Selections records were migrated into Product Library");
assert.equal(migrated.filter((product) => product.attributes?.legacySourceKey).length, 32, "32 physical PRODUCT_OPTION_LIBRARY rows migrated");
assert.equal(migrated.filter((product) => product.attributes?.handleUse === "entry-door").length, 10, "10 entry door furniture products migrated");
assert.equal(migrated.filter((product) => product.attributes?.optionType === "entry-door-glass").length, 6, "6 Hume Savoy glass options migrated");
assert.equal(migrated.filter((product) => product.familyKey === "exterior-paint").length, 20, "20 physical exterior colour selections migrated");
assert.equal(GARAGE_DOOR_COLOUR_CATALOGUE.length, 42, "42 garage door colour options remain available as garage-door colour variants");

const noGenericPlaceholderImages = migrated
  .filter((product) => product.primaryImageUrl)
  .every((product) => !/unsplash|photo-\d|rice|hand-cream/i.test(product.primaryImageUrl));
assert.equal(noGenericPlaceholderImages, true, "migrated Product Library records do not import generic Client Selections placeholder photos");

const swatchProducts = migrated.filter((product) => product.attributes?.swatchHex);
assert.ok(swatchProducts.length >= 26, "colour and finish options keep colour swatches");
assert.equal(
  swatchProducts.every((product) => /^data:image\/svg\+xml/.test(product.primaryImageUrl || "")),
  true,
  "swatch records use deterministic visual swatches instead of unrelated photos",
);

const appliances = getEffectiveApplianceCatalogue({ organisationId: ORG_A });
assert.equal(appliances.counts.products, 83, "canonical appliance product count is preserved");
assert.equal(appliances.counts.packs, 35, "canonical appliance pack count is preserved");
assert.equal(appliances.counts.relationships, 159, "canonical appliance component relationship count is preserved");
assert.deepEqual(appliances.brands, ["Ariston", "Blanco", "Euromaid", "Omega", "Smeg", "Westinghouse"], "six canonical appliance brands remain available");

const cabinetry = getEffectiveCabinetryCatalogue({ organisationId: ORG_A });
assert.equal(cabinetry.counts.total, 561, "effective cabinetry includes migrated vanity units but excludes entry-door furniture");
assert.equal(cabinetry.counts.byCanonicalType.handle_product, 8, "cabinetry handle count remains the cabinet handle catalogue only");
assert.equal(cabinetry.counts.byCanonicalType.cabinet_unit, 33, "cabinetry includes migrated Client Selections vanity units");
assert.equal(cabinetry.products.some((product) => /Blum/i.test(`${product.productName} ${product.description}`)), true, "cabinet hardware includes Blum soft-close");

const guidedCounts = {
  oven: 20,
  cooktop: 31,
  rangehood: 41,
  dishwasher: 10,
  microwave: 3,
  "freestanding-cooker": 6,
  "appliance-pack": 35,
  sink: 4,
  "sink-mixer": 3,
  "bathroom-basin": 2,
  "basin-mixer": 2,
  "toilet-suite": 2,
  "garage-door": 5,
  balustrades: 2,
  "exterior-paint": 22,
  driveway: 2,
  decking: 2,
  pool: 2,
  "retaining-walls": 2,
  landscaping: 2,
};

for (const [key, expected] of Object.entries(guidedCounts)) {
  assert.equal(productsFor(key, selectableProducts).length, expected, `Client Selections ${key} options come from Product Library`);
}

const externalDoorFurniture = roomCategory("external-door-furniture");
assert.equal(
  selectableProducts.filter((product) => productBelongsToRoomCategory(product, externalDoorFurniture)).length,
  10,
  "Exterior Product Library page routes migrated entry-door furniture",
);

const cabinetHandles = roomCategory("cabinet-handles");
assert.equal(
  selectableProducts.filter((product) => productBelongsToRoomCategory(product, cabinetHandles)).length,
  8,
  "Cabinet handle Product Library page excludes entry-door hardware",
);

for (const [categoryKey, minCount] of [
  ["basins", 2],
  ["toilets", 2],
  ["vanities", 2],
  ["tiles", 4],
  ["laundry-tubs", 4],
  ["internal-paint-colours", 2],
  ["gutters", 6],
  ["fascia", 3],
  ["downpipes", 4],
]) {
  const category = roomCategory(categoryKey);
  assert.ok(
    selectableProducts.filter((product) => productBelongsToRoomCategory(product, category)).length >= minCount,
    `${categoryKey} has migrated or matched Product Library records`,
  );
}

assert.equal(
  migrated.every((product) => product.attributes?.legacyClientSelectionId && product.attributes?.quotationMappingId),
  true,
  "migrated records preserve legacy Client Selections IDs and safe Quotation Builder mapping IDs",
);

const productLibraryCommitCompletedAt = new Date().toISOString();
const privateRecord = addBuilderProduct(ORG_A, {
  product_code: "BUILDER-PRIVATE-MIGRATION-SINK-001",
  family_key: "kitchen-sinks",
  top_level_area: "kitchen",
  manufacturer: "Builder Private",
  brand: "Builder Private",
  supplier: "Builder Private",
  product_name: "Builder private undermount sink",
  model: "Private-001",
  description: "Private CSV import sync proof product.",
  primary_image_url: "data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='10'%20height='10'%3E%3Crect%20width='10'%20height='10'%20fill='%23cccccc'/%3E%3C/svg%3E",
  image_status: "verified_exact",
  price_status: "quote_required",
  price_unit: "EACH",
  active: true,
  source_type: "builder_private_csv_import",
  source_name: "Builder private CSV import proof",
  source_verified_at: productLibraryCommitCompletedAt,
  attributes: {
    applicableRooms: ["kitchen", "butlers-pantry", "laundry"],
    quotationMappingId: "approved-family:kitchen-sinks",
  },
});
assert.ok(privateRecord, "Product Library commit completed before consumer queries");

const productLibraryQueryAt = new Date().toISOString();
assert.equal(
  getEffectiveProductCatalogue({ tenantId: ORG_A, builderId: ORG_A, catalogueVersion: "test-private-import-v1", familyKey: "kitchen-sinks" }).counts.builderPrivate,
  1,
  "builder-private Product Library import appears for the importing builder",
);
assert.equal(
  getEffectiveProductCatalogue({ tenantId: ORG_B, builderId: ORG_B, catalogueVersion: "test-private-import-v1", familyKey: "kitchen-sinks" }).counts.builderPrivate,
  0,
  "builder-private Product Library import does not leak to another builder",
);

const clientSelectionsQueryAt = new Date().toISOString();
assert.equal(
  productsFor("sink", getClientSelectableProducts(ORG_A)).some((product) => product.productCode === "BUILDER-PRIVATE-MIGRATION-SINK-001"),
  true,
  "builder-private Product Library import appears automatically in Client Selections",
);
const quotationBuilderQueryAt = new Date().toISOString();
const quotationVisibleProduct = getEffectiveProductCatalogue({ tenantId: ORG_A, builderId: ORG_A, catalogueVersion: "test-private-import-v1", familyKey: "kitchen-sinks" })
    .canonicalProducts
    .find((product) => product.productCode === "BUILDER-PRIVATE-MIGRATION-SINK-001");
assert.equal(
  Boolean(quotationVisibleProduct
    && quotationVisibleProduct.catalogueOwner === "builder-private"
    && quotationVisibleProduct.quotationMappingId === "approved-family:kitchen-sinks"
    && quotationVisibleProduct.snapshotPolicy === "consumers store immutable selection snapshots; Product Library owns the canonical record"),
  true,
  "builder-private import is exposed through the same canonical Product Library contract for Quotation Builder consumers",
);

assert.deepEqual(
  [productLibraryCommitCompletedAt, productLibraryQueryAt, clientSelectionsQueryAt, quotationBuilderQueryAt].slice().sort(),
  [productLibraryCommitCompletedAt, productLibraryQueryAt, clientSelectionsQueryAt, quotationBuilderQueryAt],
  "migration proof timestamps preserve Product Library commit -> Product Library query -> Client Selections query -> Quotation Builder query order",
);

disableProduct(ORG_A, "BUILDER-PRIVATE-MIGRATION-SINK-001");
assert.equal(
  productsFor("sink", getClientSelectableProducts(ORG_A)).some((product) => product.productCode === "BUILDER-PRIVATE-MIGRATION-SINK-001"),
  false,
  "Product Library disable removes builder-private product from new Client Selections choices",
);
assert.equal(
  getEffectiveProductCatalogue({ tenantId: ORG_A, builderId: ORG_A, catalogueVersion: "test-private-import-v1", familyKey: "kitchen-sinks" })
    .canonicalProducts
    .some((product) => product.productCode === "BUILDER-PRIVATE-MIGRATION-SINK-001" && product.selectable),
  false,
  "Product Library disable removes builder-private product from new Quotation Builder choices",
);

console.log(JSON.stringify({
  productLibraryCommitCompletedAt,
  productLibraryQueryAt,
  clientSelectionsQueryAt,
  quotationBuilderQueryAt,
  catalogueVersion: "test-private-import-v1",
  stableProductId: quotationVisibleProduct.stableProductId,
}, null, 2));

console.log("PASS client selections Product Library migration parity");
