import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isRemovedDuplicateCladdingProduct } from "../lib/product-library/catalogueModel.js";

const catalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/exterior/AU-EXTERIOR-FINISHES-CATALOGUE.json", "utf8"));

test("150mm and 180mm Linea remain separate selectable cladding products", () => {
  const cladding = catalogue.products.filter((product) => product.family_key === "cladding");
  const [first, second] = cladding;

  assert.equal(first.product_code, "CLADDING-JAMES-HARDIE-LINEA-150");
  assert.equal(second.product_code, "CLADDING-JAMES-HARDIE-LINEA-180");
  assert.equal(first.product_name, "James Hardie 150mm Linea Board");
  assert.equal(second.product_name, "James Hardie 180mm Linea Board");
  assert.equal(first.primary_image_url, "/images/product-library/cladding-linea-weatherboard-150.webp");
  assert.equal(second.primary_image_url, "/images/product-library/cladding-linea-weatherboard-180.jpeg");
  assert.equal(first.active, "true");
  assert.equal(second.active, "true");
  assert.notEqual(first.product_code, second.product_code);
  assert.notEqual(first.model, second.model);
  assert.equal(isRemovedDuplicateCladdingProduct(first), false);
  assert.equal(isRemovedDuplicateCladdingProduct(second), false);
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
