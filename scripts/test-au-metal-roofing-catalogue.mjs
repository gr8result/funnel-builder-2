import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  activeAuMetalRoofingMasterProducts,
  commitMasterProductImport,
  createBuilderProductReference,
  ensureDemoBuilderCatalogueEnablements,
  ensureDemoBuilderRoofingEnablements,
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
const csvPath = path.join(repoRoot, "data", "product-library", "catalogues", "roofing", "AU-METAL-ROOFING-CATALOGUE.csv");
const selectionsPath = path.join(repoRoot, "pages", "modules", "builders", "selections-book.js");
const productLibraryPath = path.join(repoRoot, "pages", "modules", "builders", "product-library.js");

const catalogue = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const csv = fs.readFileSync(csvPath, "utf8");
const selectionsSource = fs.readFileSync(selectionsPath, "utf8");
const productLibrarySource = fs.readFileSync(productLibraryPath, "utf8");

const roofingRequirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "roofing");
assert.equal(roofingRequirement.familyKey, "roofing", "Roofing must be one client selection family");
assert.equal(EXTERIOR_REQUIREMENTS.filter((item) => item.label === "Roofing").length, 1, "Exterior must expose one Roofing card");
assert.ok(!EXTERIOR_REQUIREMENTS.some((item) => /roof colour|roof finish|metal roofing colour/i.test(item.label)), "roof colour and finish must not be separate Client Selection categories");
assert.equal(EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "gutters-fascia").familyKey, "visual-gutters-fascia", "Gutters/Fascia must remain separate from Roofing");

assert.equal(catalogue.familyKey, "roofing", "catalogue must use the canonical roofing family");
assert.deepEqual(catalogue.roofTypes.map((item) => item.key), ["metal_roofing", "roof_tiles"], "roof type branch must include metal roofing and roof tiles");
assert.equal(catalogue.roofTypes.find((item) => item.key === "roof_tiles").products.length, 0, "roof tiles must not seed fake product records");
assert.equal(catalogue.products.length, 3, "first roofing release should seed the official metal profiles only");
assert.ok(catalogue.officialSources.every((url) => ["colorbond.com", "lysaght.com"].includes(new URL(url).hostname)), "all source URLs must be official COLORBOND or LYSAGHT pages");

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

const disabledRoofingEnablements = demoRoofingEnablements.map((item) => ({ ...item, enabled: false, active: false }));
const preservedDisabledRoofing = ensureDemoBuilderRoofingEnablements(committed.products, disabledRoofingEnablements, DEMO_BUILDER_ORGANISATION_ID);
assert.equal(queryClientSelectableProducts({
  organisationId: DEMO_BUILDER_ORGANISATION_ID,
  familyKey: "roofing",
  region: "QLD",
  masterProducts: committed.products,
  builderProducts: preservedDisabledRoofing,
}).length, 0, "explicit disable-all roofing state must return the no-products state");

const combinedEnablements = ensureDemoBuilderCatalogueEnablements(committed.products, [], DEMO_BUILDER_ORGANISATION_ID);
assert.equal(combinedEnablements.length, 3, "combined demo helper must include roofing when no brick products are present");

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

["GuidedRoofingWorkflow", "roofingConfiguration", "Select Roofing Configuration", "Roof tile catalogue awaiting product data", "Matt is only available"].forEach((needle) => {
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
