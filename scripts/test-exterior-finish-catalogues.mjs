import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  FAMILY_IMAGE_FALLBACKS,
  PRODUCT_FAMILIES,
  activeExteriorFinishMasterProducts,
  createBuilderProductReference,
  ensureDemoBuilderCatalogueEnablements,
  familyByKey,
  mergeMasterCatalogueProducts,
  normalizeMasterProductRecord,
  queryClientSelectableProducts,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";
import {
  EXTERIOR_REQUIREMENTS,
  createSelectionPayloadFromProduct,
  nextIncompleteRequirement,
  selectedByRequirement,
  statusForRequirement,
} from "../lib/builders/clientSelectionWorkflow.js";

const require = createRequire(import.meta.url);
const qldBrickMasterCatalogue = require("../data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json");
const auMetalRoofingCatalogue = require("../data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json");
const auFasciaGutterDownpipeCatalogue = require("../data/product-library/catalogues/roofing/AU-FASCIA-GUTTER-DOWNPIPE-CATALOGUE.json");
const exteriorOpeningsCatalogue = require("../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");
const exteriorFinishesCatalogue = require("../data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json");

const finishFamilyKeys = [
  "cladding",
  "balustrades",
  "external-lighting",
  "exterior-paint",
  "driveway",
  "decking",
  "pool",
  "retaining-walls",
  "landscaping",
];
const optionalProjectFamilies = new Set(["balustrades", "driveway", "decking", "pool", "retaining-walls", "landscaping"]);

const bricks = qldBrickMasterCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const roofing = [
  ...auMetalRoofingCatalogue.products,
  ...auFasciaGutterDownpipeCatalogue.products,
].map((product) => normalizeMasterProductRecord(product));
const exteriorOpenings = exteriorOpeningsCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const exteriorFinishes = exteriorFinishesCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const masterProducts = [...bricks, ...roofing, ...exteriorOpenings, ...exteriorFinishes];
const enablements = ensureDemoBuilderCatalogueEnablements(masterProducts, [], DEMO_BUILDER_ORGANISATION_ID);

assert.equal(exteriorFinishes.length, 27, "Exterior finishes catalogue must expose every requested finish record");
assert.equal(activeExteriorFinishMasterProducts(masterProducts).length, exteriorFinishes.length, "Exterior finish demo enablement candidates must cover the new catalogue");

const expectedCladdingCodes = [
  "CLADDING-JAMES-HARDIE-LINEA-150",
  "CLADDING-JAMES-HARDIE-LINEA-180",
  "CLADDING-JAMES-HARDIE-AXON",
  "CLADDING-JAMES-HARDIE-MATRIX",
  "CLADDING-JAMES-HARDIE-STRIA",
  "CLADDING-JAMES-HARDIE-FINE-TEXTURE",
  "CLADDING-JAMES-HARDIE-EXOTEC",
  "CLADDING-JAMES-HARDIE-HARDIE-PLANK",
  "CLADDING-COLORBOND-LYSAGHT-WALL",
  "CLADDING-PGH-FEATURE-STONE",
];
const claddingProducts = exteriorFinishes.filter((product) => product.familyKey === "cladding");
assert.equal(claddingProducts.length, expectedCladdingCodes.length, "Cladding must expose the restored ten top-level options");
assert.deepEqual(claddingProducts.map((product) => product.productCode), expectedCladdingCodes, "Cladding options must stay in the intended client-facing order");
assert.equal(claddingProducts.filter((product) => /linea/i.test(product.productName)).length, 2, "150mm and 180mm Linea must remain separate top-level products");
assert.deepEqual(claddingProducts.slice(0, 2).map((product) => product.displayOrder), [1, 2], "Linea display order must pin the first two cards");

expectedCladdingCodes.forEach((code) => {
  const product = claddingProducts.find((item) => item.productCode === code);
  assert.ok(product, `${code} must exist in the cladding catalogue`);
  assert.equal(product.priceStatus, "quote_required", `${code} must remain quote-required, not fake-priced`);
  assert.equal(product.imageStatus, "verified_exact", `${code} must use a verified relevant image`);
});

const jamesHardieCladding = claddingProducts.filter((product) => product.supplier === "James Hardie");
assert.equal(jamesHardieCladding.length, 8, "The corrected cladding list keeps eight genuine James Hardie products");
jamesHardieCladding.forEach((product) => {
  assert.match(product.officialProductUrl, /^https:\/\/www\.jameshardie\.com\.au\/products\//, `${product.productCode} must keep its official James Hardie URL`);
  if (!["CLADDING-JAMES-HARDIE-LINEA-150", "CLADDING-JAMES-HARDIE-LINEA-180"].includes(product.productCode)) {
    assert.match(product.primaryImageUrl, /^https:\/\/images\.ctfassets\.net\//, `${product.productCode} must use a relevant James Hardie image CDN asset`);
  }
});

const linea150 = claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA-150");
const linea180 = claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA-180");
assert.equal(linea150.primaryImageUrl, "/images/product-library/cladding-linea-weatherboard-150.webp", "150mm Linea must use the supplied 150 Linea image");
assert.equal(linea180.primaryImageUrl, "/images/product-library/cladding-linea-weatherboard-180.jpeg", "180mm Linea must use the supplied 180 Linea image");
assert.notEqual(linea150.productId, linea180.productId, "150mm and 180mm Linea must have separate product IDs");

const mergedWithStaleCladding = mergeMasterCatalogueProducts(masterProducts, [{
  productCode: "CLADDING-JAMES-HARDIE-LINEA",
  familyKey: "cladding",
  productName: "James Hardie Linea Weatherboard",
  primaryImageUrl: "/images/product-library/cladding-linea-weatherboard-180.jpeg",
  active: true,
}]);
assert.equal(mergedWithStaleCladding.some((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA"), false, "Old single-Linea stored rows cannot repopulate Cladding");
assert.equal(mergedWithStaleCladding.filter((product) => product.familyKey === "cladding").length, claddingProducts.length, "Catalogue initialization must not overwrite or shrink populated Cladding");

const colorbondWall = claddingProducts.find((product) => product.productCode === "CLADDING-COLORBOND-LYSAGHT-WALL");
assert.equal(colorbondWall.primaryImageUrl, "/images/product-library/cladding-colorbond-wall.jpg", "COLORBOND wall cladding must use the supplied wall-cladding image");
assert.equal(colorbondWall.attributes.material, "COLORBOND steel", "COLORBOND cladding must be stored as wall cladding material, not roofing");
assert.match(colorbondWall.specificationUrl, /walling-cladding-facades/, "COLORBOND cladding must point at LYSAGHT walling/cladding source material");

const featureStone = claddingProducts.find((product) => product.productCode === "CLADDING-PGH-FEATURE-STONE");
assert.equal(featureStone.productName, "Feature Stone Wall Cladding", "Feature Stone must remain a top-level cladding option");
assert.match(featureStone.primaryImageUrl, /^https:\/\/www\.csrassetlibrary\.com\/celum\//, "Feature Stone must use relevant stone wall imagery");

finishFamilyKeys.forEach((familyKey) => {
  const products = exteriorFinishes.filter((product) => product.familyKey === familyKey);
  const requirement = EXTERIOR_REQUIREMENTS.find((item) => item.familyKey === familyKey);
  assert.ok(familyByKey(familyKey), `${familyKey} is a first-class Product Library family`);
  assert.ok(PRODUCT_FAMILIES.some((family) => family.familyKey === familyKey), `${familyKey} family is registered`);
  assert.ok(requirement, `${familyKey} has a Client Selections guided requirement`);
  assert.equal(requirement.familyKey.startsWith("visual-"), false, `${familyKey} cannot use a legacy visual family`);
  assert.ok(products.length > 0, `${familyKey} has imported master products`);
  assert.ok(products.every((product) => product.primaryImageUrl), `${familyKey} products carry image URLs`);
  assert.ok(products.every((product) => product.imageStatus !== "missing"), `${familyKey} products must not be missing images`);
  assert.ok(products.every((product) => ["quote_required", "price_pending"].includes(product.priceStatus)), `${familyKey} products must not invent current pricing`);
  assert.ok(products.every((product) => product.rrp === null && product.clientPrice === null), `${familyKey} products must not store fake prices`);
  assert.notEqual(resolveProductLibraryImage({ familyKey }), FAMILY_IMAGE_FALLBACKS.bedrooms, `${familyKey} fallback cannot resolve to bedroom imagery`);
  assert.notEqual(resolveProductLibraryImage({ familyKey }), FAMILY_IMAGE_FALLBACKS.bathroom, `${familyKey} fallback cannot resolve to bathroom imagery`);
  assert.notEqual(resolveProductLibraryImage({ familyKey }), FAMILY_IMAGE_FALLBACKS.cooktop, `${familyKey} fallback cannot resolve to appliance imagery`);
  assert.equal(Boolean(requirement.optionalWhenProjectMissing), optionalProjectFamilies.has(familyKey), `${familyKey} conditional workflow metadata is correct`);

  const enabledRefs = enablements.filter((item) => (
    item.organisationId === DEMO_BUILDER_ORGANISATION_ID &&
    item.enabled &&
    products.some((product) => product.productCode === item.masterProductCode)
  ));
  assert.equal(enabledRefs.length, products.length, `${familyKey} demo builder enablement should cover imported active records`);

  const selectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts,
    builderProducts: enablements,
  });
  assert.equal(selectable.length, products.length, `${familyKey} Client Selections reads the same Product Library master records`);

  const editedDescription = `${products[0].description} shared propagation proof`;
  const editedMasterProducts = masterProducts.map((product) => product.productCode === products[0].productCode ? { ...product, description: editedDescription } : product);
  const editedSelectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts: editedMasterProducts,
    builderProducts: enablements,
  });
  assert.equal(editedSelectable.find((product) => product.productCode === products[0].productCode)?.description, editedDescription, `${familyKey} Product Library edits propagate to Client Selections`);

  const disabledRef = createBuilderProductReference(products[0], {
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    enabled: false,
    active: false,
  });
  const disabledSelectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts,
    builderProducts: enablements
      .filter((item) => item.masterProductCode !== products[0].productCode)
      .concat(disabledRef),
  });
  assert.equal(disabledSelectable.some((product) => product.productCode === products[0].productCode), false, `${familyKey} disabled builder records disappear from new selections`);

  const archivedProducts = masterProducts.map((product) => product.productCode === products[0].productCode ? { ...product, archived: true, active: false } : product);
  const archivedSelectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey,
    region: "QLD",
    masterProducts: archivedProducts,
    builderProducts: enablements,
  });
  assert.equal(archivedSelectable.some((product) => product.productCode === products[0].productCode), false, `${familyKey} archived master records disappear from new selections`);
});

assert.equal(EXTERIOR_REQUIREMENTS.some((requirement) => requirement.familyKey.startsWith("visual-")), false, "Exterior requirements must not use visual-only placeholder families");
assert.equal(EXTERIOR_REQUIREMENTS.some((requirement) => /colour$/i.test(requirement.label)), false, "Exterior colour choices must live inside product/family variants, not standalone colour requirements");

const completedSelections = ["bricks", "roofing", "windows", "entry-door", "garage-door", "cladding", "external-lighting"].map(selectionFor);
const selectionMap = selectedByRequirement(completedSelections, EXTERIOR_REQUIREMENTS);
const paintRequirement = EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "exterior-paint");
const paintProduct = exteriorFinishes.find((product) => product.familyKey === "exterior-paint");
const paintPayload = createSelectionPayloadFromProduct({
  workspaceId: DEMO_BUILDER_ORGANISATION_ID,
  projectId: "project-test",
  requirement: paintRequirement,
  product: paintProduct,
});
assert.equal(paintPayload.selected_details.familyKey, "exterior-paint", "Exterior Paint payload persists the exterior-paint family");
assert.equal(paintPayload.selected_details.selectedPrice, null, "Quote-required Exterior Paint selection does not persist a fake selected price");
assert.equal(statusForRequirement(paintRequirement, selectionFor("exterior-paint")), "complete", "Completed Exterior Paint marks complete after confirmation");
assert.equal(nextIncompleteRequirement(EXTERIOR_REQUIREMENTS, selectionMap, EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "external-lighting"))?.requirementKey, "exterior-paint", "Exterior auto-advance reaches Exterior Paint after External Lighting");

const selectionsPageSource = fs.readFileSync(new URL("../pages/modules/builders/selections-book.js", import.meta.url), "utf8");
const catalogueServiceSource = fs.readFileSync(new URL("../lib/product-library/catalogueService.js", import.meta.url), "utf8");
assert.match(selectionsPageSource, /catalogueService/, "Client Selections uses the shared Product Library catalogue service");
assert.match(catalogueServiceSource, /AU-EXTERIOR-FINISHES-CATALOGUE\.json/, "Shared Product Library catalogue service imports the exterior finishes master catalogue");
assert.match(catalogueServiceSource, /AU-FASCIA-GUTTER-DOWNPIPE-CATALOGUE\.json/, "Shared Product Library catalogue service imports the Roofing fascia/gutter/downpipe catalogue");
assert.match(selectionsPageSource, /requirementAppliesToBook/, "Client Selections must filter project-conditional exterior requirements");
assert.match(selectionsPageSource, /requirementsForGuidedArea\("exterior", book\)/, "Exterior card flow must use book-aware requirement filtering");
assert.match(selectionsPageSource, /applicableGuidedRequirementsForBook\(book\)/, "Auto-advance must use book-aware guided requirements");
assert.match(selectionsPageSource, /EXTERIOR COMPLETE\. Opening Interior\./, "Completing the last applicable exterior item must announce Exterior complete before opening Interior");
assert.doesNotMatch(selectionsPageSource, /data\/product-library\/catalogues\/client-selections/i, "Client Selections must not load a separate client-only product catalogue");

const productLibraryPageSource = fs.readFileSync(new URL("../pages/modules/builders/product-library.js", import.meta.url), "utf8");
assert.match(productLibraryPageSource, /catalogueService/, "Product Library uses the shared catalogue service");
assert.match(productLibraryPageSource, /function addSupplier\(\)/, "Product Library must expose real Add Supplier management");
assert.match(productLibraryPageSource, /function addRange\(\)/, "Product Library must expose real Add Range management");
assert.match(productLibraryPageSource, /startNewProduct\(\)/, "Product Library Add Product must open the canonical product form");

function selectionFor(requirementKey) {
  const requirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === requirementKey);
  return {
    selection_status: "selected",
    selected_details: {
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
      priceState: "Current Price",
      selectedPrice: 1,
      variationPending: false,
    },
    metadata: {
      area: requirement.areaKey,
      requirementKey: requirement.requirementKey,
      familyKey: requirement.familyKey,
    },
  };
}

console.log(`Exterior finish catalogue tests passed. Products=${exteriorFinishes.length} Families=${finishFamilyKeys.length}`);
