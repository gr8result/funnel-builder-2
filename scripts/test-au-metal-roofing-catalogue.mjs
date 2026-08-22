import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  activeAuMetalRoofingMasterProducts,
  builderEnablementState,
  commitMasterProductImport,
  createBuilderProductReference,
  ensureBuilderRoofingEnablements,
  ensureDemoBuilderCatalogueEnablements,
  ensureDemoBuilderRoofingEnablements,
  isExplicitlyDisabledBuilderReference,
  mergeMasterCatalogueProducts,
  normalizeMasterProductRecord,
  parseMasterProductCatalogueImport,
  previewMasterProductImport,
  queryClientSelectableProducts,
} from "../lib/product-library/catalogueModel.js";
import {
  EXTERIOR_REQUIREMENTS,
  PRICE_STATES,
  statusForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(repoRoot, "data", "product-library", "catalogues", "roofing", "AU-METAL-ROOFING-CATALOGUE.json");
const monierRoofTilesPath = path.join(repoRoot, "data", "product-library", "catalogues", "roofing", "AU-MONIER-ROOF-TILES-CATALOGUE.json");
const bristileRoofTilesPath = path.join(repoRoot, "data", "product-library", "catalogues", "roofing", "AU-BRISTILE-ROOF-TILES-CATALOGUE.json");
const csvPath = path.join(repoRoot, "data", "product-library", "catalogues", "roofing", "AU-METAL-ROOFING-CATALOGUE.csv");
const bricksPath = path.join(repoRoot, "data", "product-library", "catalogues", "bricks", "QLD-BRICKS-MASTER-CATALOGUE.json");
const exteriorOpeningsPath = path.join(repoRoot, "data", "product-library", "catalogues", "exterior", "AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");
const exteriorFinishesPath = path.join(repoRoot, "data", "product-library", "catalogues", "exterior", "AU-EXTERIOR-FINISHES-CATALOGUE.json");
const kitchenPath = path.join(repoRoot, "data", "product-library", "catalogues", "kitchen", "AU-KITCHEN-PRODUCT-CATALOGUE.json");
const selectionsPath = path.join(repoRoot, "pages", "modules", "builders", "selections-book.js");
const productLibraryPath = path.join(repoRoot, "pages", "modules", "builders", "product-library.js");

const catalogue = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const monierRoofTilesCatalogue = JSON.parse(fs.readFileSync(monierRoofTilesPath, "utf8"));
const bristileRoofTilesCatalogue = JSON.parse(fs.readFileSync(bristileRoofTilesPath, "utf8"));
const brickCatalogue = JSON.parse(fs.readFileSync(bricksPath, "utf8"));
const exteriorOpeningsCatalogue = JSON.parse(fs.readFileSync(exteriorOpeningsPath, "utf8"));
const exteriorFinishesCatalogue = JSON.parse(fs.readFileSync(exteriorFinishesPath, "utf8"));
const kitchenCatalogue = JSON.parse(fs.readFileSync(kitchenPath, "utf8"));
const csv = fs.readFileSync(csvPath, "utf8");
const selectionsSource = fs.readFileSync(selectionsPath, "utf8");
const productLibrarySource = fs.readFileSync(productLibraryPath, "utf8");

const roofingRequirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "roofing");
assert.equal(roofingRequirement.familyKey, "roofing", "Roofing must be one client selection family");
assert.equal(EXTERIOR_REQUIREMENTS.filter((item) => item.label === "Roofing").length, 1, "Exterior must expose one Roofing card");
assert.ok(!EXTERIOR_REQUIREMENTS.some((item) => /roof colour|roof finish|metal roofing colour/i.test(item.label)), "roof colour and finish must not be separate Client Selection categories");
assert.equal(EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "gutters-fascia").familyKey, "gutters-fascia", "Gutters/Fascia must remain separate from Roofing without using a visual placeholder");

assert.equal(catalogue.familyKey, "roofing", "catalogue must use the canonical roofing family");
assert.deepEqual(catalogue.roofTypes.map((item) => item.key), ["metal_roofing", "roof_tiles"], "roof type branch must include metal roofing and roof tiles");
assert.equal(catalogue.products.length, 3, "first roofing release should seed the official metal profiles only");
assert.ok(catalogue.officialSources.every((url) => ["colorbond.com", "lysaght.com"].includes(new URL(url).hostname)), "all source URLs must be official COLORBOND or LYSAGHT pages");
assert.equal(monierRoofTilesCatalogue.familyKey, "roofing", "Monier tiles must stay in the Roofing family");
assert.equal(bristileRoofTilesCatalogue.familyKey, "roofing", "Bristile tiles must stay in the Roofing family");
assert.ok(monierRoofTilesCatalogue.products.length >= 60, "Monier roof tiles must import real colour variants");
assert.ok(bristileRoofTilesCatalogue.products.length >= 100, "Bristile roof tiles must import real QLD catalogue variants");
assert.ok(monierRoofTilesCatalogue.products.every((product) => product.configuration === "roof_tiles" && product.attributes.roofType === "roof_tiles"), "Monier records must be roof tile records");
assert.ok(bristileRoofTilesCatalogue.products.every((product) => product.configuration === "roof_tiles" && product.attributes.roofType === "roof_tiles"), "Bristile records must be roof tile records");
assert.ok(monierRoofTilesCatalogue.products.every((product) => product.source_url.includes("monier.com.au")), "Monier product records must store official Monier URLs");
assert.ok(bristileRoofTilesCatalogue.products.every((product) => product.source_url.includes("bristileroofing.com.au")), "Bristile product records must store official Bristile URLs");
assert.ok(monierRoofTilesCatalogue.products.every((product) => product.primary_image_url && !/bedroom|bathroom/i.test(product.primary_image_url)), "Monier tile cards need relevant manufacturer imagery or swatches");
assert.ok(bristileRoofTilesCatalogue.products.every((product) => product.primary_image_url && !/bedroom|bathroom/i.test(product.primary_image_url)), "Bristile tile cards need relevant manufacturer imagery or swatches");
assert.ok(monierRoofTilesCatalogue.products.some((product) => product.range === "Madison" && !product.regions.includes("QLD")), "Monier master catalogue retains non-QLD Madison records without exposing them to QLD");
assert.ok(monierRoofTilesCatalogue.products.some((product) => product.range === "Urban Shingle" && !product.regions.includes("QLD")), "Monier master catalogue retains non-QLD Urban Shingle records without exposing them to QLD");
["Atura", "Cambridge", "Horizon", "Tudor", "Elabana", "Nouveau", "Marseille"].forEach((range) => {
  assert.ok(monierRoofTilesCatalogue.products.some((product) => product.range === range && product.regions.includes("QLD")), `Monier ${range} must expose QLD-compatible variants`);
});
["Designer", "Artisan", "Classic", "Prestige", "Eton", "Premiere", "Innova", "Marseille", "Curvado", "Curvado Glazed", "Alicantina", "5XL"].forEach((range) => {
  assert.ok(bristileRoofTilesCatalogue.products.some((product) => product.range === range && product.regions.includes("QLD")), `Bristile ${range} must expose QLD-compatible variants`);
});

const records = parseMasterProductCatalogueImport(csv, { format: "csv" });
const preview = previewMasterProductImport(records, []);
assert.equal(preview.invalidProducts, 0, "CSV companion must import through the master catalogue validator");
const committed = commitMasterProductImport(preview, []);
assert.equal(committed.products.length, 3, "CSV import must create the three metal roofing profile records");
assert.ok(committed.products.every((product) => product.familyKey === "roofing"), "imported records must remain in the Roofing family");
assert.ok(committed.products.every((product) => product.priceStatus === "quote_required"), "roofing profile pricing must be quote required");
assert.ok(committed.products.every((product) => product.clientPrice === null && product.rrp === null), "unknown roofing prices must be null, not zero");
assert.equal(activeAuMetalRoofingMasterProducts(committed.products).length, 3, "active AU/QLD metal roofing candidates must be detected");

const products = catalogue.products;
const allRoofingProducts = [
  ...catalogue.products,
  ...monierRoofTilesCatalogue.products,
  ...bristileRoofTilesCatalogue.products,
].map((product) => normalizeMasterProductRecord(product));
const qldRoofingCount = allRoofingProducts.filter((product) => product.regions.includes("AU") || product.regions.includes("QLD")).length;
const colourNames = products[0].attributes.colours.map((colour) => colour.name);
assert.equal(colourNames.length, 22, "COLORBOND core colours must include 22 official colours");
["CUSTOM ORB", "TRIMDEK", "KLIP-LOK 700 CLASSIC"].forEach((profile) => {
  assert.ok(products.some((product) => product.attributes.profile === profile), `${profile} profile must be represented`);
});
assert.ok(products.every((product) => product.attributes.material === "COLORBOND steel"), "material must be COLORBOND steel");
assert.ok(products.every((product) => product.manufacturer === "LYSAGHT"), "profile supplier/manufacturer must be LYSAGHT");
assert.ok(products.every((product) => product.attributes.materialManufacturer === "BlueScope"), "COLORBOND steel material manufacturer must be distinct from LYSAGHT profile supplier");

const colours = new Map(products[0].attributes.colours.map((colour) => [colour.name, colour]));
assert.deepEqual(colours.get("Monument").availableFinishes, ["Classic", "Matt"], "Monument must support Matt");
assert.deepEqual(colours.get("Dover White").availableFinishes, ["Classic"], "Dover White must not expose Matt");
const mattColours = [...colours.values()].filter((colour) => colour.availableFinishes.includes("Matt")).map((colour) => colour.name).sort();
assert.deepEqual(mattColours, ["Basalt", "Bluegum", "Dune", "Monument", "Shale Grey", "Surfmist"].sort(), "Matt must be limited to the six official colours");
assert.ok(products[0].attributes.colours.every((colour) => colour.hex?.startsWith("#")), "visual swatch hex values must be present");
assert.ok(products[0].attributes.colours.every((colour) => colour.reusableFor.includes("gutters-fascia") && colour.reusableFor.includes("downpipes")), "COLORBOND colour variants must be reusable for gutters/fascia/downpipes later");

const builderProducts = committed.products.map((product) => createBuilderProductReference(product, { organisationId: "test-builder", enabled: product.productCode.includes("CUSTOM-ORB"), active: product.productCode.includes("CUSTOM-ORB") }));
const selectable = queryClientSelectableProducts({
  organisationId: "test-builder",
  familyKey: "roofing",
  region: "QLD",
  masterProducts: committed.products,
  builderProducts,
});
assert.equal(selectable.length, 1, "Client Selections should only receive builder-enabled compatible roofing profiles");
assert.match(selectable[0].productCode, /CUSTOM-ORB/, "builder-enabled profile should be the selectable proof product");

const demoRoofingEnablements = ensureDemoBuilderRoofingEnablements(committed.products, [], DEMO_BUILDER_ORGANISATION_ID);
assert.equal(demoRoofingEnablements.length, 3, "empty demo builder store must enable the three real metal roofing profiles");
assert.ok(demoRoofingEnablements.every((item) => item.organisationId === DEMO_BUILDER_ORGANISATION_ID), "demo roofing enablements must be scoped to the current organisation");
assert.ok(demoRoofingEnablements.every((item) => item.clientPrice === null && item.allowance === null), "demo roofing enablements must not invent builder-specific prices");
assert.ok(demoRoofingEnablements.every((item) => item.tier === ""), "demo roofing enablements must not manufacture Premier/Premium tiers");
assert.equal(queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "roofing",
  region: "QLD",
  masterProducts: committed.products,
  builderProducts: demoRoofingEnablements,
}).length, 3, "Client Selections query must return all demo-enabled QLD metal roofing profiles");

const partialDemoRoofingEnablements = ensureDemoBuilderRoofingEnablements(committed.products, [demoRoofingEnablements[0]], DEMO_BUILDER_ORGANISATION_ID);
assert.equal(queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "roofing",
  region: "QLD",
  masterProducts: committed.products,
  builderProducts: partialDemoRoofingEnablements,
}).length, 3, "partial demo roofing enablements must be repaired without waiting for a full reseed");

const currentWorkspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const currentWorkspaceRoofingEnablements = ensureBuilderRoofingEnablements(committed.products, [], currentWorkspaceId);
assert.equal(queryClientSelectableProducts({
  organisationId: currentWorkspaceId,
  familyKey: "roofing",
  region: "QLD",
  masterProducts: committed.products,
  builderProducts: currentWorkspaceRoofingEnablements,
}).length, 3, "active workspace roofing enablements must be added without relying on demo-only bootstrap");

const disabledRoofingEnablements = demoRoofingEnablements.map((item) => ({ ...item, enabled: false, active: false }));
const preservedDisabledRoofing = ensureDemoBuilderRoofingEnablements(committed.products, disabledRoofingEnablements, DEMO_BUILDER_ORGANISATION_ID);
assert.equal(queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "roofing",
  region: "QLD",
  masterProducts: committed.products,
  builderProducts: preservedDisabledRoofing,
}).length, 3, "stale disabled roofing refs must be repaired instead of returning the no-products state");

const explicitlyDisabledRoofing = demoRoofingEnablements.map((item) => builderEnablementState(item, false));
const preservedExplicitRoofingDisable = ensureDemoBuilderRoofingEnablements(committed.products, explicitlyDisabledRoofing, DEMO_BUILDER_ORGANISATION_ID);
assert.equal(queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "roofing",
  region: "QLD",
  masterProducts: committed.products,
  builderProducts: preservedExplicitRoofingDisable,
}).length, 3, "fully disabled completed roofing refs must be repaired for the current builder");
assert.ok(preservedExplicitRoofingDisable.every((item) => !isExplicitlyDisabledBuilderReference(item)), "full-family roofing disable marker must be cleared during visibility repair");

const combinedEnablements = ensureDemoBuilderCatalogueEnablements(committed.products, [], DEMO_BUILDER_ORGANISATION_ID);
assert.equal(combinedEnablements.length, 3, "combined demo helper must include roofing when no brick products are present");

const demoAllRoofingEnablements = ensureDemoBuilderRoofingEnablements(allRoofingProducts, [], DEMO_BUILDER_ORGANISATION_ID);
assert.equal(demoAllRoofingEnablements.length, qldRoofingCount, "empty demo builder store must enable every QLD-compatible roofing product, including tiles");
assert.equal(queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "roofing",
  region: "QLD",
  masterProducts: allRoofingProducts,
  builderProducts: demoAllRoofingEnablements,
}).length, qldRoofingCount, "Client Selections query must return QLD metal and roof tile records together");

const allMasterProducts = [
  ...(brickCatalogue.products || []),
  ...(catalogue.products || []),
  ...(monierRoofTilesCatalogue.products || []),
  ...(bristileRoofTilesCatalogue.products || []),
  ...(exteriorOpeningsCatalogue.products || []),
  ...(exteriorFinishesCatalogue.products || []),
  ...(kitchenCatalogue.products || []),
].map((product) => normalizeMasterProductRecord(product));
const familyCount = (productsForCount, familyKey) => productsForCount.filter((product) => product.familyKey === familyKey).length;
const beforeFamilyCounts = {
  bricks: familyCount(allMasterProducts, "bricks"),
  roofing: familyCount(allMasterProducts, "roofing"),
  windows: familyCount(allMasterProducts, "windows"),
  "entry-doors": familyCount(allMasterProducts, "entry-doors"),
  "garage-doors": familyCount(allMasterProducts, "garage-doors"),
  cabinetry: familyCount(allMasterProducts, "cabinetry"),
};
const claddingRecord = allMasterProducts.find((product) => product.familyKey === "cladding");
assert.ok(claddingRecord, "family isolation test requires a cladding product");
const claddingOnlyUpdate = [{ ...claddingRecord, description: `${claddingRecord.description} Family isolation proof.` }];
const mergedAfterCladdingUpdate = mergeMasterCatalogueProducts(allMasterProducts, claddingOnlyUpdate);
Object.entries(beforeFamilyCounts).forEach(([familyKey, expectedCount]) => {
  assert.equal(familyCount(mergedAfterCladdingUpdate, familyKey), expectedCount, `cladding update must preserve ${familyKey} product count`);
});
assert.equal(
  mergedAfterCladdingUpdate.find((product) => product.productCode === claddingRecord.productCode).description,
  claddingOnlyUpdate[0].description,
  "family-scoped merge must still apply the intended cladding update",
);

const roofingPayload = {
  selection_status: "selected",
  selected_details: {
    requirementKey: "roofing",
    familyKey: "roofing",
    priceState: PRICE_STATES.quoteRequired,
    configurationComplete: true,
  },
};
assert.equal(statusForRequirement(roofingRequirement, roofingPayload), "complete", "completed roofing configuration should be green even when final price is quote required");

["GuidedRoofingWorkflow", "roofingConfiguration", "Select Roofing Configuration", "tileManufacturer", "roofing-tile-product-step", "Matt is only available"].forEach((needle) => {
  assert.ok(selectionsSource.includes(needle), `Selections Book must include ${needle}`);
});
assert.ok(selectionsSource.includes("roofingGuidedProducts"), "Roofing workflow must use master roofing products instead of approved quote rows");
assert.ok(selectionsSource.includes('products={guidedRequirement.requirementKey === "bricks" ? brickGuidedProducts : guidedRequirement.requirementKey === "roofing" ? roofingGuidedProducts : guidedProducts}'), "Roofing workflow must be fed by filtered roofing master products");
["Colorbond Corrugated", "Premium Colorbond Profile", "Monier Horizon Roof Tile"].forEach((fakeName) => {
  assert.ok(!selectionsSource.includes(fakeName), `${fakeName} fake roofing option must not be displayed`);
});
assert.ok(selectionsSource.includes('setGuidedRoofingStep("colour")'), "Back from finish must return to colour");
assert.ok(selectionsSource.includes('setGuidedScreen("exterior")'), "Back from Roofing Configuration must return to Exterior");
assert.ok(productLibrarySource.includes('data-roofing-admin="systems-profiles-colours-compatibility-builder-availability"'), "Product Library admin must expose Roofing management sections");

console.log("AU metal roofing catalogue regression passed.");
