import assert from "node:assert/strict";
import fs from "node:fs/promises";
import catalogue from "../data/product-library/catalogues/benchtops/AU-POLYTEC-LAMINATE-BENCHTOPS.js";

const evidence = JSON.parse(await fs.readFile("data/product-library/source-evidence/benchtops/polytec-laminate-source-manifest.json", "utf8"));
const products = catalogue.products;
const variants = products.flatMap((product) => product.variants);
const verifiedPages = new Map(evidence.pages.map((page) => [page.url, page]));
const verifiedImages = new Set(evidence.images.filter((image) => image.httpStatus === 200 && image.contentType.startsWith("image/")).map((image) => image.url));
assert.equal(products.length, 200, "200 colour families after excluding two manufacturer kickboard-only entries");
assert.equal(new Set(products.map((product) => product.colourName)).size, products.length, "Colour families must not be duplicated by finish or sheet size");
assert.equal(variants.length, 629, "629 verified manufacturer sheet SKUs");
assert.equal(new Set(variants.map((variant) => variant.sku)).size, variants.length, "A sheet SKU must identify one material variant");
assert.equal(products.reduce((sum, product) => sum + product.finishes.length, 0), 224);
for (const product of products) {
  assert.equal(product.sku, "", "A colour-family identity must not pretend to be a manufacturer sheet SKU");
  assert.equal(product.productCode, "");
  assert.equal(product.price, null);
  assert.equal(product.priceStatus, "quote_required");
  assert.equal(product.active, true);
  assert.equal(product.benchtopSuitability, true);
  assert.deepEqual(product.thicknessOptions, [], "No sheet thickness may be offered as finished benchtop thickness");
  const page = verifiedPages.get(product.officialProductUrl);
  assert.equal(page?.httpStatus, 200);
  assert.match(page.sha256, /^[0-9a-f]{64}$/);
  assert.equal(page.manufacturerSkuCount, product.variants.length);
  assert(verifiedImages.has(product.imageUrl), `Unverified colour image: ${product.colourName}`);
  for (const variant of product.variants) {
    assert.match(variant.sku, /^\d+$/);
    assert.equal(variant.productCode, variant.sku);
    assert.match(variant.productName, /^Laminate /);
    assert(!/kickboard|xenolith|compact/i.test(variant.productName), "Only verified HPL benchtop sheet variants belong in this catalogue");
    assert.equal(variant.thicknessKind, "laminate_sheet");
    assert(variant.thicknessMm > 0 && variant.thicknessMm < 3);
    assert(variant.lengthMm > variant.widthMm && variant.widthMm > 0);
    assert(product.finishes.includes(variant.finish));
    assert(verifiedImages.has(variant.imageUrl));
    assert.equal(variant.price, null);
  }
}
const calacutta = products.find((product) => product.colourName === "Calacutta Grey");
assert.equal(calacutta.id, "polytec-laminate-benchtop-calacutta-grey");
const sheet = calacutta.variants.find((variant) => variant.sku === "57519");
assert.equal(sheet.finish, "Smooth");
assert.equal(sheet.thicknessMm, 0.7);
assert.equal(sheet.lengthMm, 3650);
assert.equal(sheet.widthMm, 1360);
assert.equal(sheet.sourceUrl, "https://www.polytec.com.au/colour/calacutta-grey/smooth/");
assert(products.find((product) => product.colourName === "Black").finishes.includes("Venette"));
for (const excluded of ["Brushed Aluminium", "Brushed Stainless"]) {
  assert(!products.some((product) => product.colourName === excluded));
  assert(evidence.exclusions.some((entry) => entry.colourName === excluded && entry.publishedProductNames.every((product) => /kickboard/i.test(product.productName))));
}
console.log("PASS Polytec laminate catalogue: 200 unique colours, 224 finishes, 629 actual sheet SKUs, 214 HTTP-verified swatches; quote prices and sheet/benchtop thickness separation preserved.");
