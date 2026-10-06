import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = read('data/product-library/catalogues/appliances/AU-EUROMAID-HNC-RANGE.json');
const evidence = `data/product-library/source-evidence/euromaid/hnc-complete-range-${catalogue.sourceCheckedAt}`;
const normalize = model => String(model).toUpperCase().replace(/[^A-Z0-9]/g, '');
const slug = model => model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pages = catalogue.pagination.map(page => read(`${evidence}/listing-page-${page.current_page}.json`));
const source = pages.flatMap(page => page.response.data.products.items);
assert.equal(catalogue.categoryFilter, null, 'The full brand query must not omit appliance categories');
assert.equal(catalogue.totalSourceCount, 38);
assert.equal(pages.length, pages[0].response.data.products.page_info.total_pages);
for (const [index, page] of pages.entries()) {
  assert.equal(page.variables.page, index + 1, 'All source pages are sequentially present');
  assert.match(page.query, /filter:\{brand:\{in:\["59"\]\}\}/);
  assert.doesNotMatch(page.query, /filter:[^}]*category/);
  assert.equal(page.response.data.products.total_count, catalogue.totalSourceCount);
  assert.equal(page.response.data.products.items.length, catalogue.pagination[index].returnedCount);
}
assert.equal(source.length, catalogue.totalSourceCount);
assert.equal(new Set(source.map(product => product.sku)).size, catalogue.totalSourceCount);
assert.deepEqual(catalogue.products.map(p => p.sku).sort(), source.map(p => p.sku).sort());
assert.deepEqual(catalogue.products.reduce((totals, p) => ({ ...totals, [p.familyId]: (totals[p.familyId] || 0) + 1 }), {}), {
  microwaves: 1, 'freestanding-cookers': 6, rangehoods: 13, dishwashers: 3, cooktops: 8, ovens: 7,
});
const official = read(`${evidence}/manufacturer-exact-models.json`);
for (const product of catalogue.products) {
  const raw = source.find(item => item.sku === product.sku);
  const manufacturer = official.find(row => normalize(row.model) === normalize(product.manufacturerModel));
  assert.equal(product.manufacturerModel, raw.vendorcode || raw.sku);
  assert.equal(product.sourceProductName, raw.name, 'Raw supplier titles must remain available');
  assert.equal(manufacturer.exactMatch, true);
  assert.equal(normalize(manufacturer.product.model_number || manufacturer.product.sku), normalize(product.manufacturerModel));
  assert.equal(product.manufacturerUrl, manufacturer.url);
  const page = read(`${evidence}/hnc-product-${slug(product.manufacturerModel)}.json`);
  assert.equal(page.url, product.productPageUrl);
  assert.equal(sha256(page.text), page.sha256);
  const displayed = page.text.match(/SRP[\s\S]{0,350}?\$([\d,.]+)/)?.[1];
  assert.ok(displayed, `${product.sku} must have actual public SRP evidence`);
  assert.equal(product.hncPrice, Number(displayed.replaceAll(',', '')));
  assert.equal(product.hncPrice, Number(raw.price_store));
  assert.ok(product.hncPrice > 0);
  assert.equal(product.priceSourceUrl, page.url);
  assert.equal(product.priceLabel, 'SRP (inc. GST)');
  assert.equal(product.hncCurrentlyListed, true);
  assert.equal(product.dimensionsRaw, raw.product_dimensions);
  for (const field of ['widthMm', 'heightMm', 'depthMm']) assert.ok(product[field] > 0, `${product.sku} ${field}`);
  assert.ok(product.finish);
  assert.equal(product.capacity, product.specifications.manufacturer.Capacity || null, 'Capacity must not be inferred');
  assert.equal(product.imageStatus, 'verified-authorised-supplier-local');
  const exactSourceImages = [...raw.media_gallery.map(image => image.url), raw.image.url, raw.product_images.base, raw.product_images.first_gallery];
  assert.ok(exactSourceImages.includes(product.imageSourceUrl), `${product.sku} image must belong to its exact HNC record`);
  assert.doesNotMatch(product.imageSourceUrl, /placeholder|no_image|_tech|drawing|dimension|specification/i);
  const bytes = fs.readFileSync(`public${product.primaryImage}`);
  assert.equal(sha256(bytes), product.imageSha256);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, product.imageWidth);
  assert.equal(metadata.height, product.imageHeight);
  assert.ok(Math.min(metadata.width, metadata.height) >= 250);
}
assert.equal(catalogue.products.filter(p => p.existingProductId).length, 12);
assert.equal(catalogue.products.filter(p => !p.existingProductId).length, 26);
assert.equal(catalogue.absentLegacy.length, 10);
const canonical = read('data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json');
for (const product of catalogue.products.filter(p => p.existingProductId)) {
  const old = canonical.products.find(p => p.productId === product.existingProductId);
  assert.ok(old, `${product.sku} stable historical ID`);
  assert.equal(normalize(old.manufacturerModel), normalize(product.manufacturerModel), 'Do not substitute a similar model');
  for (const [key, value] of Object.entries(product.preservedLegacyPrices)) assert.equal(old[key], value, `Preserve ${product.sku} ${key}`);
}
for (const product of catalogue.absentLegacy) {
  assert.equal(product.hncCurrentlyListed, false);
  assert.equal(product.doNotSubstituteModel, true);
  assert.equal(product.preserveHistoricalId, true);
  assert.ok(!source.some(row => normalize(row.vendorcode || row.sku) === normalize(product.manufacturerModel)));
  if (product.archivedDocument) {
    const bytes = fs.readFileSync(product.archivedDocument.file);
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    assert.equal(sha256(bytes), product.archivedDocument.sha256);
    assert.equal(product.classification, 'absent-from-hnc-manufacturer-archived-document-found');
  }
}
const ceramic = catalogue.products.find(p => p.sku === 'ECE641T');
assert.match(ceramic.productName, /Ceramic/);
assert.match(ceramic.sourceProductName, /Induction/);
assert.equal(ceramic.displayTitleSource, ceramic.manufacturerUrl);
const wide = catalogue.products.find(p => p.sku === 'EC95GLB');
assert.match(wide.productName, /90cm/);
assert.match(wide.sourceProductName, /600mm/);
assert.equal(wide.widthMm, 880);
assert.deepEqual(catalogue.products.find(p => p.sku === 'CPT6S').dimensionRanges.heightMm, { minimum: 645, maximum: 1025 });
assert.equal(catalogue.failures.length, 0);
console.log(`PASS all ${catalogue.products.length} Euromaid HNC models, complete global pagination, exact model images, displayed prices, dimensions, existing IDs/prices and documented source conflicts.`);
