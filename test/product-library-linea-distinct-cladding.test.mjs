import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  FAMILY_IMAGE_FALLBACKS,
  LOCKED_PRODUCT_FAMILIES,
  builderEnablementState,
  commitMasterProductImport,
  ensureBuilderBrickEnablements,
  ensureBuilderCladdingEnablements,
  ensureBuilderCompletedFamilyEnablements,
  ensureDemoBuilderCatalogueEnablements,
  familyCatalogueStatus,
  isExplicitlyDisabledBuilderReference,
  isRemovedDuplicateCladdingProduct,
  mergeMasterCatalogueProducts,
  normalizeMasterProductRecord,
  previewMasterProductImport,
  queryClientSelectableProducts,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";

const catalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json", "utf8"));
const bricksCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/bricks/QLD-BRICKS-MASTER-CATALOGUE.json", "utf8"));
const roofingCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/roofing/AU-METAL-ROOFING-CATALOGUE.json", "utf8"));
const openingsCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/exterior/AU-WINDOWS-ENTRY-DOORS-GARAGE-DOORS-CATALOGUE.json", "utf8"));
const kitchenCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/kitchen/AU-KITCHEN-PRODUCT-CATALOGUE.json", "utf8"));
const normalizedProducts = catalogue.products.map((product) => normalizeMasterProductRecord(product));
const claddingProducts = normalizedProducts.filter((product) => product.familyKey === "cladding");
const combinedMasterProducts = [
  ...(bricksCatalogue.products || []),
  ...(roofingCatalogue.products || []),
  ...(openingsCatalogue.products || []),
  ...(catalogue.products || []),
  ...(kitchenCatalogue.products || []),
].map((product) => normalizeMasterProductRecord(product));
const countFamily = (products, familyKey) => products.filter((product) => product.familyKey === familyKey).length;
const enabledForFamily = (products, enablements, organisationId, familyKey) => {
  const familyCodes = new Set(products.filter((product) => product.familyKey === familyKey).map((product) => product.productCode));
  return enablements.filter((item) => item.organisationId === organisationId && item.enabled !== false && item.active !== false && familyCodes.has(item.masterProductCode)).length;
};

test("150mm and 180mm Linea remain separate selectable cladding products", () => {
  const [first, second] = catalogue.products.filter((product) => product.family_key === "cladding");

  assert.equal(first.product_code, "CLADDING-JAMES-HARDIE-LINEA-150");
  assert.equal(second.product_code, "CLADDING-JAMES-HARDIE-LINEA-180");
  assert.equal(first.product_name, "James Hardie 150mm Linea Board");
  assert.equal(second.product_name, "James Hardie 180mm Linea Board");
  assert.equal(first.primary_image_url, "/images/product-library/cladding-linea-weatherboard-150.webp");
  assert.equal(second.primary_image_url, "/images/product-library/cladding-linea-weatherboard-180.jpeg");
  assert.equal(first.active, "true");
  assert.equal(second.active, "true");
  assert.equal(first.display_order, 1);
  assert.equal(second.display_order, 2);
  assert.notEqual(first.product_code, second.product_code);
  assert.notEqual(first.model, second.model);
  assert.equal(isRemovedDuplicateCladdingProduct(first), false);
  assert.equal(isRemovedDuplicateCladdingProduct(second), false);
});

test("restoring Linea does not replace the rest of the cladding catalogue", () => {
  const expectedCodes = [
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
  assert.equal(claddingProducts.length, expectedCodes.length);
  assert.deepEqual(claddingProducts.map((product) => product.productCode), expectedCodes);
});

test("Client Selections and Product Library share the cladding master source", () => {
  const enablements = ensureBuilderCladdingEnablements(
    normalizedProducts,
    ensureDemoBuilderCatalogueEnablements(normalizedProducts, [], DEMO_BUILDER_ORGANISATION_ID),
    DEMO_BUILDER_ORGANISATION_ID,
  );
  const selectable = queryClientSelectableProducts({
    organisationId: DEMO_BUILDER_ORGANISATION_ID,
    familyKey: "cladding",
    region: "QLD",
    masterProducts: normalizedProducts,
    builderProducts: enablements,
  });
  assert.deepEqual(selectable.map((product) => product.productCode), claddingProducts.map((product) => product.productCode));
  assert.equal(enablements.filter((item) => claddingProducts.some((product) => product.productCode === item.masterProductCode)).length, claddingProducts.length);
});

test("current organisation cladding enablement does not depend on demo-only seeding", () => {
  const organisationId = "current-workspace";
  const enablements = ensureBuilderCladdingEnablements(normalizedProducts, [], organisationId);
  assert.equal(enablements.length, claddingProducts.length);
  assert.ok(enablements.every((item) => item.organisationId === organisationId));
  const selectable = queryClientSelectableProducts({
    organisationId,
    familyKey: "cladding",
    region: "QLD",
    masterProducts: normalizedProducts,
    builderProducts: enablements,
  });
  assert.deepEqual(selectable.map((product) => product.productCode), claddingProducts.map((product) => product.productCode));
});

test("disabled current organisation cladding refs are restored on load", () => {
  const organisationId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
  const disabledEnablements = ensureBuilderCladdingEnablements(normalizedProducts, [], organisationId)
    .map((item) => ({ ...item, enabled: false, active: false }));
  const repairedEnablements = ensureBuilderCladdingEnablements(normalizedProducts, disabledEnablements, organisationId);
  const selectable = queryClientSelectableProducts({
    organisationId,
    familyKey: "cladding",
    region: "QLD",
    masterProducts: normalizedProducts,
    builderProducts: repairedEnablements,
  });
  assert.equal(repairedEnablements.length, claddingProducts.length);
  assert.ok(repairedEnablements.every((item) => item.enabled === true && item.active === true));
  assert.deepEqual(selectable.map((product) => product.productCode), claddingProducts.map((product) => product.productCode));
});

test("explicit cladding disables are preserved and not treated as stale state", () => {
  const organisationId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
  const enabledEnablements = ensureBuilderCladdingEnablements(normalizedProducts, [], organisationId);
  const explicitlyDisabled = enabledEnablements.map((item) => builderEnablementState(item, false));
  assert.ok(explicitlyDisabled.every((item) => isExplicitlyDisabledBuilderReference(item)));

  const repaired = ensureBuilderCladdingEnablements(normalizedProducts, explicitlyDisabled, organisationId);
  assert.equal(enabledForFamily(normalizedProducts, repaired, organisationId, "cladding"), 0);
  assert.ok(repaired.every((item) => item.enabled === false && item.active === false));
  assert.ok(repaired.every((item) => isExplicitlyDisabledBuilderReference(item)));
});

test("mixed explicit and stale cladding disables repair stale rows only", () => {
  const organisationId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
  const enabledEnablements = ensureBuilderCladdingEnablements(normalizedProducts, [], organisationId);
  const [explicitlyDisabled, ...staleDisabled] = enabledEnablements.map((item, index) => (
    index === 0
      ? builderEnablementState(item, false)
      : { ...item, enabled: false, active: false, disableReason: "" }
  ));

  const repaired = ensureBuilderCladdingEnablements(normalizedProducts, [explicitlyDisabled, ...staleDisabled], organisationId);
  assert.equal(enabledForFamily(normalizedProducts, repaired, organisationId, "cladding"), claddingProducts.length - 1);
  assert.ok(isExplicitlyDisabledBuilderReference(repaired.find((item) => item.masterProductCode === explicitlyDisabled.masterProductCode)));
});

test("stored stale cladding rows cannot override the authoritative catalogue", () => {
  const staleStoredProducts = [
    {
      productCode: "CLADDING-JAMES-HARDIE-LINEA",
      familyKey: "cladding",
      productName: "James Hardie Linea Weatherboard",
      primaryImageUrl: "/images/product-library/cladding-linea-weatherboard-180.jpeg",
      active: true,
    },
    {
      ...claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA-150"),
      description: "Edited in Product Library",
    },
  ];
  const merged = mergeMasterCatalogueProducts(normalizedProducts, staleStoredProducts);
  const mergedCladding = merged.filter((product) => product.familyKey === "cladding");
  assert.equal(mergedCladding.some((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA"), false);
  assert.equal(mergedCladding.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA-150").description, "Edited in Product Library");
  assert.equal(mergedCladding.length, claddingProducts.length);
});

test("editing one cladding product does not replace cladding or unrelated families", () => {
  const beforeCounts = {
    cladding: countFamily(combinedMasterProducts, "cladding"),
    roofing: countFamily(combinedMasterProducts, "roofing"),
    bricks: countFamily(combinedMasterProducts, "bricks"),
    windows: countFamily(combinedMasterProducts, "windows"),
    "entry-doors": countFamily(combinedMasterProducts, "entry-doors"),
    "garage-doors": countFamily(combinedMasterProducts, "garage-doors"),
    cabinetry: countFamily(combinedMasterProducts, "cabinetry"),
  };
  const edited = {
    ...claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-MATRIX"),
    description: "Edited cladding description for regression proof",
  };
  const merged = mergeMasterCatalogueProducts(combinedMasterProducts, [edited]);
  Object.entries(beforeCounts).forEach(([familyKey, expectedCount]) => {
    assert.equal(countFamily(merged, familyKey), expectedCount, `${familyKey} count must survive a cladding-only edit`);
  });
  assert.equal(merged.find((product) => product.productCode === edited.productCode).description, edited.description);
});

test("editing cladding cannot remove bricks or roofing", () => {
  const edited = {
    ...claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-MATRIX"),
    description: "Scoped cladding edit",
  };
  const merged = mergeMasterCatalogueProducts(combinedMasterProducts, [edited]);
  assert.equal(countFamily(merged, "bricks"), 147);
  assert.equal(countFamily(merged, "roofing"), 3);
  assert.equal(countFamily(merged, "cladding"), 10);
});

test("editing roofing cannot remove bricks or cladding", () => {
  const roofing = combinedMasterProducts.find((product) => product.familyKey === "roofing");
  const merged = mergeMasterCatalogueProducts(combinedMasterProducts, [{ ...roofing, description: "Scoped roofing edit" }]);
  assert.equal(countFamily(merged, "bricks"), 147);
  assert.equal(countFamily(merged, "cladding"), 10);
  assert.equal(countFamily(merged, "roofing"), 3);
});

test("editing kitchen cannot remove exterior families", () => {
  const kitchen = combinedMasterProducts.find((product) => product.familyKey === "cabinetry");
  const merged = mergeMasterCatalogueProducts(combinedMasterProducts, [{ ...kitchen, description: "Scoped kitchen edit" }]);
  assert.equal(countFamily(merged, "bricks"), 147);
  assert.equal(countFamily(merged, "cladding"), 10);
  assert.equal(countFamily(merged, "roofing"), 3);
  assert.equal(countFamily(merged, "windows"), 6);
  assert.equal(countFamily(merged, "entry-doors"), 4);
  assert.equal(countFamily(merged, "garage-doors"), 5);
});

test("builder enablement repair for cladding preserves bricks", () => {
  const organisationId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
  const brickRefs = ensureBuilderBrickEnablements(combinedMasterProducts, [], organisationId);
  const claddingRefsDisabled = ensureBuilderCladdingEnablements(combinedMasterProducts, [], organisationId)
    .map((item) => ({ ...item, enabled: false, active: false }));
  const repaired = ensureBuilderCompletedFamilyEnablements(combinedMasterProducts, [...brickRefs, ...claddingRefsDisabled], organisationId);
  assert.equal(enabledForFamily(combinedMasterProducts, repaired, organisationId, "bricks"), 147);
  assert.equal(enabledForFamily(combinedMasterProducts, repaired, organisationId, "cladding"), 10);
});

test("family-scoped stale repair preserves unrelated explicit disables", () => {
  const organisationId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
  const brickRefs = ensureBuilderBrickEnablements(combinedMasterProducts, [], organisationId);
  const roofingRefs = ensureBuilderCompletedFamilyEnablements(combinedMasterProducts, [], organisationId)
    .filter((item) => combinedMasterProducts.some((product) => product.familyKey === "roofing" && product.productCode === item.masterProductCode))
    .map((item) => builderEnablementState(item, false));
  const claddingRefsDisabledStale = ensureBuilderCladdingEnablements(combinedMasterProducts, [], organisationId)
    .map((item) => ({ ...item, enabled: false, active: false, disableReason: "" }));

  const repaired = ensureBuilderCladdingEnablements(combinedMasterProducts, [...brickRefs, ...roofingRefs, ...claddingRefsDisabledStale], organisationId);
  assert.equal(enabledForFamily(combinedMasterProducts, repaired, organisationId, "bricks"), 147);
  assert.equal(enabledForFamily(combinedMasterProducts, repaired, organisationId, "cladding"), 10);
  assert.equal(enabledForFamily(combinedMasterProducts, repaired, organisationId, "roofing"), 0);
  assert.ok(repaired.filter((item) => roofingRefs.some((ref) => ref.masterProductCode === item.masterProductCode)).every((item) => isExplicitlyDisabledBuilderReference(item)));
});

test("filtered Product Library save cannot replace the full catalogue", () => {
  const filteredCladdingView = claddingProducts.map((product) => (
    product.productCode === "CLADDING-JAMES-HARDIE-AXON"
      ? { ...product, description: "Filtered view edit" }
      : product
  ));
  const merged = mergeMasterCatalogueProducts(combinedMasterProducts, filteredCladdingView, { explicitFamilyKey: "cladding" });
  assert.equal(countFamily(merged, "bricks"), 147);
  assert.equal(countFamily(merged, "roofing"), 3);
  assert.equal(countFamily(merged, "cladding"), 10);
  assert.equal(merged.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-AXON").description, "Filtered view edit");
});

test("bootstrap merge preserves populated completed families", () => {
  const emptyStoredCatalogue = [];
  const merged = mergeMasterCatalogueProducts(combinedMasterProducts, emptyStoredCatalogue);
  assert.equal(countFamily(merged, "bricks"), 147);
  assert.equal(countFamily(merged, "cladding"), 10);
  assert.equal(countFamily(merged, "roofing"), 3);
});

test("locked family status protects completed catalogues", () => {
  assert.equal(familyCatalogueStatus("bricks"), "locked");
  assert.equal(familyCatalogueStatus("cladding"), "locked");
  assert.equal(familyCatalogueStatus("roofing"), "locked");
  assert.equal(LOCKED_PRODUCT_FAMILIES.bricks.expectedMinimumRecords, 147);
});

test("master product import commit preserves unrelated families when merged", () => {
  const edited = {
    ...claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-STRIA"),
    description: "Imported cladding edit",
  };
  const preview = previewMasterProductImport([edited], combinedMasterProducts);
  const committed = commitMasterProductImport(preview, claddingProducts);
  const merged = mergeMasterCatalogueProducts(combinedMasterProducts, committed.products, { explicitFamilyKey: "cladding" });
  assert.equal(countFamily(merged, "bricks"), 147);
  assert.equal(countFamily(merged, "roofing"), 3);
  assert.equal(countFamily(merged, "cladding"), 10);
});

test("explicit Linea product image beats family fallback", () => {
  const fallback = resolveProductLibraryImage({ familyKey: "cladding" });
  const linea150 = claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA-150");
  const linea180 = claddingProducts.find((product) => product.productCode === "CLADDING-JAMES-HARDIE-LINEA-180");
  assert.notEqual(linea150.primaryImageUrl, FAMILY_IMAGE_FALLBACKS.cladding);
  assert.notEqual(linea180.primaryImageUrl, FAMILY_IMAGE_FALLBACKS.cladding);
  assert.notEqual(linea150.primaryImageUrl, fallback);
  assert.notEqual(linea180.primaryImageUrl, fallback);
});

test("generic broken Colorbond wall sheeting source row remains excluded", () => {
  assert.equal(isRemovedDuplicateCladdingProduct({
    familyKey: "cladding",
    productName: "COLORBOND WALL SHEETING",
  }), true);
});

test("uncoded Linea source rows are excluded without removing distinct Linea products", () => {
  assert.equal(isRemovedDuplicateCladdingProduct({
    familyKey: "cladding",
    productName: "150mm LINEA BOARD",
    model: "150MM",
  }), true);
  assert.equal(isRemovedDuplicateCladdingProduct({
    familyKey: "cladding",
    productName: "180mm LINEA BOARD",
    model: "180MM",
  }), true);
});
