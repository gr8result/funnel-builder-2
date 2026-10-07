import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { classifyBathroomAccessory } from '../lib/product-library/bathroomAccessoryDiscovery.js';
const directory = 'data/product-library/source-evidence/hnc-bathroom-five-brands';
const report = JSON.parse(fs.readFileSync(`${directory}/import-report.json`));
const catalogue = JSON.parse(fs.readFileSync('data/product-library/catalogues/plumbing/AU-HNC-PLUMBING-CATALOGUE.json'));
const batch = catalogue.products.filter(p => p.attributes?.accessoryImportBatch === report.batch);
const identity = p => `${p.brand.toUpperCase()}|${p.sku.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
const sources = new Map();
for (const file of fs.readdirSync(`${directory}/candidates`, { recursive: true }).filter(f => f.endsWith('.json'))) {
  const page = JSON.parse(fs.readFileSync(path.join(directory, 'candidates', file)));
  for (const p of page.data.products.items) sources.set(p.sku, p);
}
assert(report.complete && !report.dryRun);
assert.equal(batch.length, report.imported + report.updated);
assert(batch.length > 0 && batch.length <= 50);
assert.equal(new Set(batch.map(p => p.brand)).size, 5);
assert.equal(new Set(batch.map(identity)).size, batch.length);
for (const row of batch) {
  const source = sources.get(row.attributes.hncUrlKey);
  assert(source, `${row.sku}: supplier evidence`);
  assert.equal(row.product_name, source.name.trim());
  assert.equal(row.sku, source.vendorcode || source.sku);
  assert.equal(row.rrp, source.price_store);
  assert.equal(row.client_price, source.price_promo > 0 ? source.price_promo : source.price_store);
  assert.equal(row.brand, source.custom_attributesV2.items.find(a => a.code === 'brand').selected_options[0].label);
  assert(row.description.length > 15 && row.finish, `${row.sku}: description and finish`);
  assert.equal(row.dimensions, (source.product_dimensions || '').trim(), `${row.sku}: preserve published dimensions without guessing`);
  assert.equal(classifyBathroomAccessory(row).key, row.attributes.bathroomAccessoryType);
  assert(report.coverage.some(c => c.type === row.attributes.bathroomAccessoryType && c.brand === row.brand && c.selected.includes(row.sku)));
  assert.equal(catalogue.products.filter(p => p.sku && identity(p) === identity(row)).length, 1, `${row.sku}: not duplicated in existing library`);
  const image = await sharp(path.join('public', row.primary_image_url)).metadata();
  assert(image.width > 0 && image.height > 0, `${row.sku}: valid image`);
}
for (const coverage of report.coverage) assert(coverage.selected.length <= report.perBrandType);
const originalPath = 'tmp/hnc-plumbing-before-curated-accessories.json';
if (fs.existsSync(originalPath)) {
  const original = JSON.parse(fs.readFileSync(originalPath));
  for (const row of original.products) assert.deepEqual(catalogue.products.find(p => p.product_code === row.product_code), row, `Existing ${row.product_code} preserved`);
  assert.equal(catalogue.products.length, original.products.length + batch.length);
}
console.log(JSON.stringify({ passed: true, additions: batch.length, brands: report.brands, categories: report.categories.map(c => ({type:c.label,count:c.count})), duplicateSkus: 0, allImagesDescriptionsPricesVerified: true }));
