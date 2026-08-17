import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  DEMO_BUILDER_ORGANISATION_ID,
  FAMILY_IMAGE_FALLBACKS,
  ensureBuilderCladdingEnablements,
  ensureDemoBuilderCatalogueEnablements,
  isRemovedDuplicateCladdingProduct,
  mergeMasterCatalogueProducts,
  normalizeMasterProductRecord,
  queryClientSelectableProducts,
  resolveProductLibraryImage,
} from "../lib/product-library/catalogueModel.js";

const catalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json", "utf8"));
const normalizedProducts = catalogue.products.map((product) => normalizeMasterProductRecord(product));
const claddingProducts = normalizedProducts.filter((product) => product.familyKey === "cladding");

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
