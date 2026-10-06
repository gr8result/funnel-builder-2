// Repairs the existing 38-model import from exact product pages. Never walks listings.
// node scripts/product-library/enrich-bosch-import.mjs --fetch-sources
// node scripts/product-library/enrich-bosch-import.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const rangePath = 'data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json';
const evidencePath = 'data/product-library/source-evidence/bosch/product-page-verification.json';
const range = JSON.parse(fs.readFileSync(rangePath, 'utf8'));
const now = new Date().toISOString();

function productPayload(html, model) {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[1].startsWith('(window[Symbol.for("ApolloSSRDataTransport")]')) continue;
    const start = match[1].indexOf('.push(') + 6;
    const end = match[1].lastIndexOf(')');
    const data = JSON.parse(match[1].slice(start, end));
    for (const item of Object.values(data.json?.rehydrate || {})) {
      const products = item.data?.products;
      const product = products?.items?.find((p) => p.sku === model);
      if (product) return { product, aggregations: products.aggregations || [] };
    }
  }
  throw new Error(`No structured exact-model payload for ${model}`);
}

if (process.argv.includes('--fetch-sources')) {
  const previous = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : { products: [] };
  const byModel = new Map(previous.products.map((p) => [p.model, p]));
  const pending = range.products.filter((p) => !byModel.has(p.model));
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < pending.length) {
      const record = pending[cursor++];
      assert.equal(new URL(record.source_url).hostname, 'www.harveynormancommercial.com.au');
      const response = await fetch(record.source_url, { signal: AbortSignal.timeout(45000) });
      assert(response.ok, `${record.model}: HTTP ${response.status}`);
      const html = await response.text();
      const payload = productPayload(html, record.model);
      assert(payload.aggregations.find((a) => a.attribute_code === 'brand')?.options.some((o) => o.label === 'Bosch'), `${record.model}: wrong brand`);
      byModel.set(record.model, {
        model: record.model, url: record.source_url, finalUrl: response.url,
        retrievedAt: new Date().toISOString(), status: response.status,
        htmlSha256: crypto.createHash('sha256').update(html).digest('hex'),
        extraction: 'Exact-SKU ApolloSSRDataTransport product payload from supplier product page',
        originalImport: { image: record.primary_image_url, imageSource: record.image_source_url, price: record.client_price },
        ...payload,
      });
      console.log(`verified ${record.model}`);
    }
  }));
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    verifiedAt: now, source: 'Harvey Norman Commercial exact product pages',
    scope: 'Targeted enrichment of the existing Claude import; no listing scrape and no added model IDs.',
    products: range.products.map((p) => byModel.get(p.model)),
  }, null, 2)}\n`);
  console.log(`Saved ${byModel.size} exact-model source records to ${evidencePath}`);
}

if (!process.argv.includes('--fetch-sources') && !process.argv.includes('--apply')) {
  console.log('Choose --fetch-sources to save exact-model evidence, or --apply to repair the existing range from saved evidence.');
}
