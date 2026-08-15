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
const exteriorOpeningsCatalogue = require("../data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json");
const exteriorFinishesCatalogue = require("../data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json");

const finishFamilyKeys = [
  "cladding",
  "gutters-fascia",
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
const roofing = auMetalRoofingCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const exteriorOpenings = exteriorOpeningsCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const exteriorFinishes = exteriorFinishesCatalogue.products.map((product) => normalizeMasterProductRecord(product));
const masterProducts = [...bricks, ...roofing, ...exteriorOpenings, ...exteriorFinishes];
const enablements = ensureDemoBuilderCatalogueEnablements(masterProducts, [], DEMO_BUILDER_ORGANISATION_ID);

assert.equal(exteriorFinishes.length, 21, "Exterior finishes catalogue must expose every requested finish record");
assert.equal(activeExteriorFinishMasterProducts(masterProducts).length, exteriorFinishes.length, "Exterior finish demo enablement candidates must cover the new catalogue");

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

const completedSelections = ["bricks", "roofing", "windows", "entry-door", "garage-door", "cladding", "gutters-fascia", "external-lighting"].map(selectionFor);
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
assert.match(selectionsPageSource, /AU-EXTERIOR-FINISHES-CATALOGUE\.json/, "Client Selections imports the exterior finishes master catalogue");
assert.match(selectionsPageSource, /requirementAppliesToBook/, "Client Selections must filter project-conditional exterior requirements");
assert.match(selectionsPageSource, /requirementsForGuidedArea\("exterior", book\)/, "Exterior card flow must use book-aware requirement filtering");
assert.match(selectionsPageSource, /applicableGuidedRequirementsForBook\(book\)/, "Auto-advance must use book-aware guided requirements");
assert.match(selectionsPageSource, /EXTERIOR COMPLETE\. Opening Interior\./, "Completing the last applicable exterior item must announce Exterior complete before opening Interior");
assert.doesNotMatch(selectionsPageSource, /data\/product-library\/catalogues\/client-selections/i, "Client Selections must not load a separate client-only product catalogue");

const productLibraryPageSource = fs.readFileSync(new URL("../pages/modules/builders/product-library.js", import.meta.url), "utf8");
assert.match(productLibraryPageSource, /AU-EXTERIOR-FINISHES-CATALOGUE\.json/, "Product Library imports the exterior finishes master catalogue");

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
