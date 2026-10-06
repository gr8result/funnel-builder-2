// Stage the complete public HNC Euromaid range without changing the shared catalogue.
// HNC pagination is unrestricted by category. Manufacturer data must match the exact model.
// Existing catalogue IDs and prices are recorded for the separate integration step.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const DATE = new Date().toISOString().slice(0, 10);
const OUT = 'data/product-library/catalogues/appliances/AU-EUROMAID-HNC-RANGE.json';
const EVIDENCE = `data/product-library/source-evidence/euromaid/hnc-complete-range-${DATE}`;
const ASSETS = 'public/images/catalogues/appliances/products/euromaid';
const HNC = 'https://www.harveynormancommercial.com.au';
const GRAPHQL = 'https://backend.harveynormancommercial.com.au/graphql';
const OFFICIAL = 'https://www.euromaid.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
for (const dir of [EVIDENCE, ASSETS]) fs.mkdirSync(dir, { recursive: true });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const norm = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const safe = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&bull;/g, '•').replace(/&deg;/g, '°').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const plain = value => decode(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const save = (name, value) => fs.writeFileSync(path.join(EVIDENCE, name), JSON.stringify(value, null, 2) + '\n');
const failures = [];
async function fetchResponse(url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers: { 'User-Agent': UA, ...options.headers }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return response;
    } catch (error) { if (attempt === 2) throw error; }
  }
}
async function textEvidence(url, key) {
  const file = path.join(EVIDENCE, `${key}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const response = await fetchResponse(url);
  const text = await response.text();
  const record = { url, retrievedAt: new Date().toISOString(), status: response.status, sha256: hash(text), text };
  save(`${key}.json`, record);
  return record;
}
async function graph(query, variables, key) {
  const file = path.join(EVIDENCE, `${key}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')).response;
  const response = await (await fetchResponse(GRAPHQL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) })).json();
  if (response.errors) throw new Error(JSON.stringify(response.errors));
  save(`${key}.json`, { url: GRAPHQL, retrievedAt: new Date().toISOString(), query, variables, response });
  return response;
}
async function pool(values, run, concurrency = 5) {
  let cursor = 0;
  const results = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < values.length) { const index = cursor++; results[index] = await run(values[index], index); }
  }));
  return results;
}

const fields = `id sku vendorcode name url_key url_suffix image{url label} thumbnail{url label}
  product_images{thumbnail small base first_gallery second_gallery} media_gallery{url label position disabled}
  description{html} short_description{html} product_dimensions price_promo price_store price_trade
  wels_reg_number stock_status gp_product_group categories{id name url_path}
  price_range{minimum_price{regular_price{value currency} final_price{value currency}}}`;
const query = `query EuromaidCompleteRange($page:Int!){products(filter:{brand:{in:["59"]}},pageSize:28,currentPage:$page,sort:{name:ASC}){
  total_count page_info{current_page page_size total_pages} aggregations{attribute_code label options{label value count}} items{${fields}}}}`;
const first = (await graph(query, { page: 1 }, 'listing-page-1')).data.products;
const pages = [first];
for (let page = 2; page <= first.page_info.total_pages; page++) pages.push((await graph(query, { page }, `listing-page-${page}`)).data.products);
const listed = pages.flatMap(page => page.items);
if (listed.length !== first.total_count || new Set(listed.map(p => p.sku)).size !== first.total_count) throw new Error('Pagination count or unique SKU coverage does not match HNC total_count.');
if (pages.some(page => page.total_count !== first.total_count)) throw new Error('HNC total changed between pages; repeat import.');
console.log(`HNC Euromaid: ${first.total_count} exact SKUs across ${pages.length} pages; all categories queried.`);
const catalogue = JSON.parse(fs.readFileSync('data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json', 'utf8'));
const existing = catalogue.products.filter(p => p.brandName === 'Euromaid');
const targetModels = [...new Set([...listed.map(p => p.vendorcode || p.sku), ...existing.map(p => p.manufacturerModel)])];
const manufacturerPages = new Map();
async function manufacturerPage(url) {
  if (!manufacturerPages.has(url)) manufacturerPages.set(url, (async () => {
    const html = await textEvidence(url, `manufacturer-page-${safe(url.split('/').pop())}`);
    const match = html.text.match(/data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
    if (!match) return [];
    const node = JSON.parse(match[1]).path.currentPath.match(/^node\/(\d+)$/)?.[1];
    if (!node) return [];
    const init = await textEvidence(`${OFFICIAL}/en-au/product/${node}/init`, `manufacturer-init-${node}`);
    const commands = JSON.parse(init.text);
    const settings = commands.find(command => command.settings?.gdProductDetails)?.settings.gdProductDetails || {};
    const content = commands.find(command => command.command === 'productDetailsInit') || {};
    return Object.values(settings).map(product => ({ url, node, product, detailsText: plain(content.details), specsHtml: content.specs || '', downloadsHtml: content.downloads || '', retrievedAt: init.retrievedAt }));
  })());
  return manufacturerPages.get(url);
}
const manufacturerRecords = await pool(targetModels, async model => {
  try {
    const search = await textEvidence(`${OFFICIAL}/en-au/live-search?keywords=${encodeURIComponent(model)}`, `manufacturer-search-${safe(model)}`);
    const content = JSON.parse(search.text).find(command => command.command === 'liveSearchResults')?.content || '';
    const productsContent = content.split('<div class="content-results">')[0];
    const urls = [...new Set([...productsContent.matchAll(/href="(\/en-au\/[^"?]+)"/g)].map(match => OFFICIAL + decode(match[1])))];
    for (const url of urls) {
      const match = (await manufacturerPage(url)).find(row => norm(row.product.model_number || row.product.sku) === norm(model));
      if (match) return { model, exactMatch: true, ...match };
    }
    return { model, exactMatch: false, searchUrl: search.url, searchedUrls: urls };
  } catch (error) { failures.push({ model, phase: 'manufacturer', error: error.message }); return { model, exactMatch: false, error: error.message }; }
});
const manufacturerMap = new Map(manufacturerRecords.map(row => [norm(row.model), row]));
console.log(`Manufacturer exact matches: ${manufacturerRecords.filter(row => row.exactMatch).length}/${targetModels.length}.`);
function dimensions(raw) {
  const result = { widthMm: null, depthMm: null, heightMm: null };
  const ranges = {};
  for (const [letter, name] of [['W', 'widthMm'], ['D', 'depthMm'], ['H', 'heightMm']]) {
    const match = String(raw || '').match(new RegExp(`${letter}\\s*(\\d+(?:\\.\\d+)?)(?:\\s*[-–]\\s*(\\d+(?:\\.\\d+)?))?`, 'i'));
    if (match) {
      result[name] = Number(match[1]);
      if (match[2]) ranges[name] = { minimum: Number(match[1]), maximum: Number(match[2]) };
    }
  }
  return { ...result, dimensionRanges: ranges };
}
function family(product) {
  const ids = new Set(product.categories.map(category => category.id));
  if (ids.has(105)) return 'freestanding-cookers';
  if (ids.has(22)) return 'ovens';
  if (ids.has(23)) return 'cooktops';
  if (ids.has(25)) return 'rangehoods';
  if (ids.has(28)) return 'dishwashers';
  if (ids.has(24)) return 'microwaves';
  return null;
}
async function imageFor(model, hnc, manufacturer) {
  const hncCandidates = [...(hnc?.media_gallery || []).filter(p => !p.disabled).sort((a, b) => a.position - b.position).map(p => p.url), hnc?.image?.url, hnc?.product_images?.base, hnc?.product_images?.first_gallery].filter(Boolean);
  const manufacturerCandidates = (manufacturer?.product?.images || []).map(image => image.url_original || image.url).filter(Boolean);
  const candidates = [...new Set(hncCandidates)].map(url => ({ url, organisation: 'Harvey Norman Commercial', sourcePage: `${HNC}/products/${encodeURIComponent(hnc.sku)}` }))
    .concat([...new Set(manufacturerCandidates)].map(url => ({ url, organisation: 'Euromaid Australia', sourcePage: manufacturer.url })));
  const rejected = [];
  for (const candidate of candidates) {
    if (/placeholder|no_image|_tech|drawing|dimension|specification/i.test(candidate.url)) { rejected.push({ ...candidate, reason: 'placeholder-or-technical-drawing' }); continue; }
    try {
      const response = await fetchResponse(candidate.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 80) throw new Error('Invalid or undersized product image');
      const ext = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
      const file = path.join(ASSETS, `hnc-${safe(model)}.${ext}`);
      if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== hash(buffer)) fs.writeFileSync(file, buffer);
      return { primaryImage: '/' + file.replaceAll('\\', '/').replace(/^public\//, ''), imageSourceUrl: candidate.url, imageSourceOrganisation: candidate.organisation,
        imageSourcePageUrl: candidate.sourcePage, imageStatus: candidate.organisation === 'Harvey Norman Commercial' ? 'verified-authorised-supplier-local' : 'verified-official-local',
        imageCheckedAt: DATE, imageWidth: metadata.width, imageHeight: metadata.height, imageBytes: buffer.length, imageSha256: hash(buffer), rejectedCandidates: rejected };
    } catch (error) { rejected.push({ ...candidate, reason: error.message }); }
  }
  return { primaryImage: null, imageSourceUrl: null, imageSourceOrganisation: null, imageStatus: 'exact-image-unavailable', rejectedCandidates: rejected };
}
const products = await pool(listed, async (hnc, index) => {
  const model = hnc.vendorcode || hnc.sku;
  const official = manufacturerMap.get(norm(model));
  const existingProduct = existing.find(product => norm(product.manufacturerModel) === norm(model));
  const sourceUrl = `${HNC}/products/${encodeURIComponent(hnc.sku)}`;
  const page = await textEvidence(sourceUrl, `hnc-product-${safe(model)}`);
  const colourMatch = page.text.match(/>Colour:<\/span>\s*(?:<!--.*?-->\s*)?([^<]+)/);
  const displayedColour = colourMatch ? plain(colourMatch[1]) : null;
  const displayedPrice = page.text.match(/SRP[\s\S]{0,350}?\$([\d,.]+)/)?.[1];
  const pagePrice = displayedPrice ? Number(displayedPrice.replaceAll(',', '')) : null;
  const apiPrice = Number(hnc.price_store) > 0 ? Number(hnc.price_store) : null;
  const hncPrice = apiPrice && pagePrice === apiPrice ? apiPrice : null;
  const features = String(hnc.description?.html || '').split(/<br\s*\/?>|<\/?(?:li|p|ul)[^>]*>/i).map(plain).map(value => value.replace(/^[•\-]\s*/, '')).filter(Boolean);
  const manufacturerSpecifications = Object.fromEntries(Object.values({ ...(official?.product?.key_specs || {}), ...(official?.product?.extra_specs || {}) }).filter(spec => spec && typeof spec === 'object' && spec.name).map(spec => [spec.name, spec.value]));
  const specs = { hncProductDimensions: hnc.product_dimensions || null, hncProductGroup: hnc.gp_product_group || null, hncColour: displayedColour, hncFeatures: features, hncWelsRegistration: hnc.wels_reg_number || null, manufacturer: manufacturerSpecifications };
  const dims = dimensions(hnc.product_dimensions);
  const officialDims = { widthMm: manufacturerSpecifications['Product Width (mm)'], depthMm: manufacturerSpecifications['Product Depth (mm)'], heightMm: manufacturerSpecifications['Product Height (mm)'] };
  for (const key of ['widthMm', 'depthMm', 'heightMm']) if (dims[key] === null && /^\d+(?:\.\d+)?$/.test(String(officialDims[key] || ''))) dims[key] = Number(officialDims[key]);
  const discrepancies = [];
  if (apiPrice !== pagePrice) discrepancies.push({ field: 'price', api: apiPrice, displayed: pagePrice, resolution: 'unverified-price-not-imported' });
  if (/600mm/i.test(hnc.name) && dims.widthMm >= 850) discrepancies.push({ field: 'titleWidth', title: hnc.name, dimensions: hnc.product_dimensions, resolution: 'actual-dimensions-retained-title-preserved-as-source' });
  if (/Induction/i.test(hnc.name) && /ceramic/i.test(official?.product?.title || '')) discrepancies.push({ field: 'cooktopType', hncTitle: hnc.name, manufacturerTitle: official.product.title, resolution: 'manufacturer-exact-model-title-used-for-type' });
  const manufacturerDiscontinued = official?.exactMatch ? /discontinued|no longer available|no longer manufactured/i.test(official.detailsText) : false;
  const category = family(hnc);
  const displayTitle = discrepancies.some(item => ['cooktopType', 'titleWidth'].includes(item.field)) && official?.product?.title ? official.product.title : hnc.name.trim();
  const row = { brandName: 'Euromaid', brandId: 'brand:euromaid', manufacturerModel: model, sku: hnc.sku, supplierSku: hnc.sku,
    productName: `Euromaid ${displayTitle} ${model}`, sourceProductName: hnc.name, familyId: category,
    displayTitleSource: displayTitle === hnc.name.trim() ? sourceUrl : official.url,
    hncCategories: hnc.categories, manufacturerProductName: official?.product?.title || null,
    shortDescription: plain(hnc.short_description?.html) || null, fullDescription: plain(hnc.description?.html) || null,
    manufacturerDescription: official?.product?.description || null, features, manufacturerFeatures: official?.product?.features || [],
    specifications: specs, dimensionsRaw: hnc.product_dimensions || null, ...dims,
    capacity: manufacturerSpecifications.Capacity || null, size: manufacturerSpecifications.Size || null, finish: displayedColour || manufacturerSpecifications['Colour/finish'] || null,
    hncPrice, priceCurrency: 'AUD', priceLabel: 'SRP (inc. GST)', priceSourceUrl: sourceUrl, priceCheckedAt: DATE,
    rawHncPrices: { price_store: hnc.price_store, price_promo: hnc.price_promo, price_trade: hnc.price_trade, regular: hnc.price_range.minimum_price.regular_price },
    productPageUrl: sourceUrl, supplierUrl: sourceUrl, manufacturerUrl: official?.url || null, sourceCheckedAt: DATE,
    hncCurrentlyListed: true, hncStockStatus: hnc.stock_status, manufacturerDiscontinued,
    manufacturerStatus: official?.exactMatch ? (manufacturerDiscontinued ? 'manufacturer-discontinued-hnc-currently-listed' : 'exact-manufacturer-page-currently-published') : 'not-verified',
    manufacturerActiveValue: official?.product?.active ?? null, sourceDiscrepancies: discrepancies,
    existingProductId: existingProduct?.productId || null, integrationAction: existingProduct ? 'update-exact-model-preserve-id-and-prices' : 'append-new-exact-model',
    preservedLegacyPrices: existingProduct ? Object.fromEntries(['costPrice', 'sourceCostPrice', 'sellPrice', 'importedSourceCost', 'tenantSellPrice', 'priceStatus'].map(key => [key, existingProduct[key]])) : null,
    ...(await imageFor(model, hnc, official)),
  };
  console.log(`${index + 1}/${listed.length} ${model}: ${row.familyId}; image ${row.imageWidth || '?'}x${row.imageHeight || '?'}; HNC ${row.hncPrice ?? 'unverified'}`);
  return row;
});
const listedModels = new Set(listed.map(product => norm(product.vendorcode || product.sku)));
// These exact official documents establish historical models, not present stock or discontinuation.
const archivedManufacturerDocuments = {
  EDW14S: 'https://www.euromaid.com/sites/g/files/emiian466/files/2021-03/EDW14S-Spec-Sheet-20200316.pdf',
  GG90S: 'https://www.euromaid.com/sites/g/files/emiian466/files/2021-04/GG90S_Product-Card.pdf',
};
const absentLegacy = await pool(existing.filter(product => !listedModels.has(norm(product.manufacturerModel))), async product => {
  const official = manufacturerMap.get(norm(product.manufacturerModel));
  const archivedUrl = archivedManufacturerDocuments[norm(product.manufacturerModel)];
  let archivedDocument = null;
  if (archivedUrl) {
    const file = path.join(EVIDENCE, `manufacturer-archived-${safe(product.manufacturerModel)}.pdf`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(await (await fetchResponse(archivedUrl)).arrayBuffer()));
    const buffer = fs.readFileSync(file);
    if (buffer.subarray(0, 4).toString() !== '%PDF') throw new Error(`Invalid archived document for ${product.manufacturerModel}`);
    archivedDocument = { url: archivedUrl, file, checkedAt: DATE, sha256: hash(buffer), bytes: buffer.length };
  }
  return { existingProductId: product.productId, manufacturerModel: product.manufacturerModel, hncCurrentlyListed: false,
    classification: official?.exactMatch && /discontinued|no longer available|no longer manufactured/i.test(official.detailsText) ? 'archived-manufacturer-discontinued' : official?.exactMatch ? 'absent-from-hnc-exact-manufacturer-page-found' : archivedDocument ? 'absent-from-hnc-manufacturer-archived-document-found' : 'absent-from-hnc-manufacturer-unverified',
    manufacturerUrl: official?.url || archivedUrl || null, manufacturerEvidence: official || null, archivedDocument,
    ...(await imageFor(product.manufacturerModel, null, official)), preserveHistoricalId: true, doNotSubstituteModel: true };
});
save('manufacturer-exact-models.json', manufacturerRecords);
const result = { schemaVersion: 'product-library.euromaid-hnc-range.v1', generatedAt: new Date().toISOString(), sourceOrganisation: 'Harvey Norman Commercial', sourceCheckedAt: DATE,
  sourceUrl: `${HNC}/brands/euromaid`, endpoint: GRAPHQL, brandFilter: '59', categoryFilter: null,
  pagination: pages.map(page => ({ ...page.page_info, totalCount: page.total_count, returnedCount: page.items.length, skus: page.items.map(item => item.sku) })),
  totalSourceCount: first.total_count, uniqueModelCount: new Set(products.map(product => norm(product.manufacturerModel))).size,
  categoryAggregations: first.aggregations.find(aggregation => aggregation.attribute_code === 'category_id').options,
  scopeNote: 'All public HNC products for brand 59, with no category restriction. Current HNC result contains no laundry or refrigeration products; those categories were not excluded by this importer.',
  pricePolicy: 'HNC price_store is accepted only when equal to displayed public SRP (inc. GST). Zero platform/trade values are not treated as prices. Preserve existing catalogue prices during integration.',
  imagePolicy: 'Exact HNC SKU page gallery photograph first; exact Euromaid AU model image next. Technical drawings and placeholders excluded. No generated or similar-model substitutions.',
  products, absentLegacy, failures };
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
save('coverage-report.json', { generatedAt: result.generatedAt, totalSourceCount: first.total_count, pagination: result.pagination,
  familyCounts: products.reduce((counts, p) => ({ ...counts, [p.familyId]: (counts[p.familyId] || 0) + 1 }), {}),
  exactManufacturerMatches: products.filter(p => p.manufacturerUrl).length, localImages: products.filter(p => p.primaryImage).length,
  verifiedHncPrices: products.filter(p => p.hncPrice !== null).length, existingMatches: products.filter(p => p.existingProductId).length,
  absentLegacy: absentLegacy.map(({ manufacturerEvidence, ...row }) => row), discrepancies: products.filter(p => p.sourceDiscrepancies.length).map(p => ({ model: p.manufacturerModel, differences: p.sourceDiscrepancies })), failures });
console.log(`Wrote ${OUT}: ${products.length} current HNC products, ${absentLegacy.length} absent legacy exact models; canonical catalogue unchanged.`);
