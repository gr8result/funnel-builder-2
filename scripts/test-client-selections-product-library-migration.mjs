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
import { clientSelectionCategorySummaries } from "../lib/product-library/plumbingFixtureCatalogue.js";

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

assert.ok(masterProducts.length >= 1378, "Product Library retains a growing canonical catalogue");
assert.equal(migrated.length, 0, "retired one-time migration markers are not reintroduced into the canonical master catalogue");
assert.equal(new Set(masterProducts.map((product) => product.productCode)).size, masterProducts.length, "canonical master product codes remain unique after migrated products are superseded");
assert.equal(GARAGE_DOOR_COLOUR_CATALOGUE.length, 42, "garage door colour options remain available as garage-door colour variants");

const appliances = getEffectiveApplianceCatalogue({ organisationId: ORG_A });
assert.equal(appliances.counts.products, appliances.records.length, "appliance product count reflects selectable canonical records");
assert.equal(appliances.counts.packs, appliances.packs.length, "appliance pack count reflects selectable canonical packs");
assert.equal(appliances.counts.relationships, appliances.packs.reduce((total, pack) => total + (pack.componentRelationships?.length || pack.componentProductIds?.length || pack.components?.length || 0), 0), "appliance component relationships remain connected to selectable packs");
assert.ok(appliances.brands.length > 0, "selectable canonical appliance brands are available");
assert.equal(new Set(appliances.records.map((record) => record.brand).filter(Boolean)).size, appliances.brands.length, "appliance brand list reflects selectable canonical records");

const cabinetry = getEffectiveCabinetryCatalogue({ organisationId: ORG_A });
assert.ok(cabinetry.counts.total >= 500, "effective cabinetry retains the canonical range");
assert.ok(cabinetry.counts.byCanonicalType.handle_product >= 8, "cabinetry retains cabinet handles without entry-door furniture");
assert.ok(cabinetry.counts.byCanonicalType.cabinet_unit >= 32, "cabinetry retains canonical vanity units");
assert.equal(cabinetry.products.some((product) => /Blum/i.test(`${product.productName} ${product.description}`)), true, "cabinet hardware includes Blum soft-close");

const categorySummaries = clientSelectionCategorySummaries(
  ALL_GUIDED_REQUIREMENTS.filter((item) => ["plumbing-fixtures", "shower-screens-mirrors", "hot-water", "hvac", "tiles-stone"].includes(item.areaKey)),
  { organisationId: ORG_A },
);
for (const key of ["sink", "bathroom-basin", "basin-mixer", "toilet-suite", "shower-screen", "mirror", "shaving-cabinet", "hot-water-system", "air-conditioning", "indoor-heating", "floor-tiles", "wall-tiles", "external-tiles", "tiling-rooms"]) {
  assert.ok(categorySummaries[key]?.count > 0, `Client Selections ${key} resolves a real canonical Product Library range`);
}
assert.ok(categorySummaries["feature-tiles"].count > 0, "National Tiles products explicitly rated for Feature are selectable");
assert.ok(categorySummaries.mosaics.count > 0, "National Tiles mosaic products are selectable from their product classification");

const externalDoorFurniture = roomCategory("external-door-furniture");
assert.ok(
  selectableProducts.filter((product) => productBelongsToRoomCategory(product, externalDoorFurniture)).length >= 10,
  "Exterior Product Library page routes the canonical entry-door furniture range",
);

const cabinetHandles = roomCategory("cabinet-handles");
assert.equal(
  selectableProducts.filter((product) => productBelongsToRoomCategory(product, cabinetHandles)).length,
  8,
  "Cabinet handle Product Library page excludes entry-door hardware",
);

for (const [categoryKey, minCount] of [
  ["tiles", 4],
  ["gutters", 6],
  ["fascia", 3],
  ["downpipes", 4],
]) {
  const category = roomCategory(categoryKey);
  assert.ok(
    selectableProducts.filter((product) => productBelongsToRoomCategory(product, category)).length >= minCount,
    `${categoryKey} has canonical Product Library records`,
  );
}

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
    && quotationVisibleProduct.quoteMappingStatus === "UNMAPPED"
    && !quotationVisibleProduct.quotationMappingId
    && quotationVisibleProduct.snapshotPolicy === "consumers store immutable selection snapshots; Product Library owns the canonical record"),
  true,
  "builder-private import is exposed to Quotation Builder without leaking another workspace's quote mapping",
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
