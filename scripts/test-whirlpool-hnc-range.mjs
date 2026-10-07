import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const catalogue = read('data/product-library/catalogues/appliances/AU-WHIRLPOOL-HNC-RANGE.json');
const report = read('data/catalogue/reconciliation/WHIRLPOOL_HNC_RANGE_IMPORT_REPORT.json');
const evidence = 'artifacts/catalogue/whirlpool-hnc-20260916';
const listing = report.pages.flatMap(page => read(`${evidence}/listing-all-page-${page.page}.json`).data.products.items);
assert.equal(listing.length, report.expectedTotal, 'Every HNC result must be accounted for');
assert.equal(catalogue.products.length, report.expectedTotal);
assert.deepEqual(catalogue.products.map(p => p.sku).sort(), listing.map(p => p.sku).sort());
assert.equal(new Set(catalogue.products.map(p => p.productId)).size, catalogue.products.length);
assert.equal(report.brandPageAndUnfilteredBrandModelsMatch, true);
for (const product of catalogue.products) {
  assert.equal(product.brandName, 'Whirlpool');
  const raw = read(product.evidence.file).data.products.items.find(item => item.sku === product.sku);
  assert.ok(raw, `Exact HNC SKU evidence for ${product.sku}`);
  assert.equal(product.manufacturerModel, raw.vendorcode || raw.sku);
  assert.equal(product.hncPrice, Number(raw.price_store) > 0 ? Number(raw.price_store) : null);
  assert.equal(product.priceSourceUrl, product.productPageUrl);
  assert.equal(product.gstStatus, 'inclusive');
  assert.equal(product.imageVerificationStatus, 'verified-exact-model');
  const image = fs.readFileSync(`public${product.primaryImage}`);
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'), product.imageMetadata.sha256);
  const metadata = await sharp(image).metadata();
  assert.ok(metadata.width >= 300 && metadata.height >= 250, `${product.sku} image resolution`);
  const expectedExtension = { jpeg: '.jpg', png: '.png', webp: '.webp', gif: '.gif', avif: '.avif' }[metadata.format];
  assert.ok(expectedExtension && product.primaryImage.endsWith(expectedExtension), `${product.manufacturerModel} filename must match actual ${metadata.format} bytes`);
  assert.ok(product.manufacturerUrl.startsWith('https://whirlpool.com.au/products/'));
  for (const dimension of ['widthMm', 'heightMm', 'depthMm']) {
    assert.ok(product[dimension] == null || product[dimension] > 0);
    if (product[dimension] != null) assert.ok(product.specificationSources[dimension].sourceUrl);
  }
}
assert.equal(catalogue.products.find(p => p.sku === 'W6OMPBSOC').hncPrice, null, 'HNC POA must stay unknown');
assert.equal(catalogue.products.find(p => p.sku === 'WIO3033PELAUS').hncPrice, null);
assert.equal(catalogue.products.find(p => p.sku === 'AKC640IXOC').heightMm, null, 'Unpublished height must not be invented');
assert.equal(catalogue.products.find(p => p.sku === 'WDFS3R4NWEAU').heightMm, 850);
assert.equal(catalogue.products.find(p => p.sku === 'WDFS3R4NWEAU').specificationSources.heightMm.source, 'Whirlpool Australia');
for (const [family, count] of Object.entries(report.familyCounts)) assert.equal(catalogue.products.filter(p => p.familyId === family).length, count);
assert.equal(report.problems.length, 0);
const manualReviewModels = catalogue.products.filter(product => product.manualReviewRequired).map(product => product.manufacturerModel).sort();
assert.deepEqual(manualReviewModels, ['FWEB9012IW', 'W7MWBLAUS']);
assert.equal(report.sourceConflicts.length, 2);
const washer = catalogue.products.find(product => product.manufacturerModel === 'FWEB9012IW');
assert.equal(washer.capacity, '10 kg', 'Keep HNC value intact while explicitly flagging conflicting evidence');
assert.equal(washer.specifications.manufacturerPublishedFields['Washing Capacity'], '9kg');
assert.deepEqual(washer.sourceDiscrepancies[0].sources.map(source => source.value), ['10kg', '9kg']);
assert.equal(washer.sourceDiscrepancies[0].sources[0].evidenceText, read(washer.evidence.file).data.products.items[0].name.trim());
const microwave = catalogue.products.find(product => product.manufacturerModel === 'W7MWBLAUS');
assert.deepEqual(microwave.sourceDiscrepancies[0].sources.map(source => source.value), [16, 17]);
for (const product of [washer, microwave]) {
  assert.ok(product.manualReviewReason.includes('HNC publishes'));
  assert.equal(product.sourceDiscrepancies[0].status, 'unresolved-source-conflict');
  assert.ok(product.sourceDiscrepancies[0].sources.every(source => source.url && source.checkedAt));
}
console.log(`PASS ${catalogue.products.length} Whirlpool HNC models, complete pagination, exact images, source prices, dimensions and unknown-value preservation.`);
