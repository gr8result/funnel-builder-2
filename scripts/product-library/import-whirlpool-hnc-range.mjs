// Enumerate the entire public HNC Whirlpool brand catalogue, preserve source
// evidence, and stage canonical-shaped records. Never edits the shared catalogue.
// Run: node scripts/product-library/import-whirlpool-hnc-range.mjs [--refresh]
// Re-annotate checked evidence without networking or rewriting images:
// node scripts/product-library/import-whirlpool-hnc-range.mjs --annotate-discrepancies-only
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = process.cwd();
const BASE = 'https://www.harveynormancommercial.com.au';
const SOURCE = 'Harvey Norman Commercial';
const DATE = new Date().toISOString().slice(0, 10);
const EVIDENCE = path.join(ROOT, 'artifacts/catalogue/whirlpool-hnc-20260916');
const OUT = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-WHIRLPOOL-HNC-RANGE.json');
const REPORT = path.join(ROOT, 'data/catalogue/reconciliation/WHIRLPOOL_HNC_RANGE_IMPORT_REPORT.json');
const REFRESH = process.argv.includes('--refresh');
const BRAND = '1084'; // Published by HNC's brands/[brand] client bundle.
const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const json = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); };
const clean = html => String(html || '').replace(/<br\s*\/?\s*>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).split('\n').map(s => s.trim()).filter(Boolean).join('\n');
async function fetchChecked(url, options = {}) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { const r = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`); return r; } catch (e) { error = e; }
  }
  throw error;
}
async function graphql(query, variables, file) {
  const full = path.join(EVIDENCE, file);
  if (!REFRESH && fs.existsSync(full)) return JSON.parse(fs.readFileSync(full, 'utf8'));
  // Magento's category resolver rejects an explicit null `in`; omit the
  // category filter entirely for the independent, brand-only census.
  if (query.includes('$root') && !variables.root) query = query.replace(',$root:[String]', '').replace(',category_id:{in:$root}', '');
  const response = await fetchChecked(`${BASE}/api/magento-proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const result = await response.json();
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  json(full, result);
  return result;
}
const LISTING_QUERY = `query WhirlpoolRange($page:Int!,$root:[String]){products(filter:{brand:{eq:"${BRAND}"},category_id:{in:$root}},pageSize:25,currentPage:$page){total_count page_info{total_pages current_page page_size}aggregations{attribute_code label options{label value count}}items{id sku vendorcode name categories{id name url_path}__typename}}}`;
const DETAIL_QUERY = `query WhirlpoolProduct($sku:String!){products(filter:{sku:{eq:$sku}}){items{id sku vendorcode name image{url} product_images{thumbnail small base first_gallery second_gallery} media_gallery{url} description{html} product_dimensions price_promo price_store wels_reg_number gp_product_group __typename}aggregations{attribute_code label options{label value count}}}}`;
const REQUESTED_FAMILIES = ['ovens', 'cooktops', 'rangehoods', 'dishwashers', 'freestanding-cookers', 'microwaves', 'fridges', 'freezers', 'washing-machines', 'dryers', 'washer-dryers', 'appliance-accessories'];
const CATEGORY_FAMILIES = { 22: 'ovens', 23: 'cooktops', 24: 'microwaves', 25: 'rangehoods', 26: 'freestanding-cookers', 28: 'dishwashers', 34: 'washing-machines', 35: 'dryers' };
function familyFor(item) {
  const categories = item.categories || [];
  const names = categories.map(c => c.name).join(' ').toLowerCase();
  if (/washer.*dryer|washing.*drying/.test(names)) return 'washer-dryers';
  if (/freestanding (?:oven|cooker)|upright cooker/.test(names)) return 'freestanding-cookers';
  if (/freezer/.test(names) && !/fridge|refrig/.test(names)) return 'freezers';
  if (/fridge|refriger/.test(names)) return 'fridges';
  for (const c of categories) if (CATEGORY_FAMILIES[c.id]) return CATEGORY_FAMILIES[c.id];
  if (/accessor/.test(names)) return 'appliance-accessories';
  throw new Error(`Unclassified HNC appliance ${item.sku}: ${names}`);
}
function dimensions(raw) {
  const read = key => { const match = String(raw || '').match(new RegExp(`\\b${key}\\s*(\\d+(?:\\.\\d+)?)`, 'i')); return match ? Number(match[1]) : null; };
  // HNC explicitly prints mm for these products; retain the original string too.
  return /mm/i.test(raw || '') ? { widthMm: read('W'), heightMm: read('H'), depthMm: read('D') } : { widthMm: null, heightMm: null, depthMm: null };
}
async function saveImage(url, target) {
  const response = await fetchChecked(url);
  if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Non-image response: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || bytes.length < 1000) throw new Error(`Invalid or tiny image: ${url}`);
  const fileExtension = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', avif: 'avif' }[metadata.format];
  if (!fileExtension) throw new Error(`Unsupported image format ${metadata.format}: ${url}`);
  const actualTarget = target.slice(0, -path.extname(target).length) + `.${fileExtension}`;
  fs.mkdirSync(path.dirname(actualTarget), { recursive: true }); fs.writeFileSync(actualTarget, bytes);
  return { width: metadata.width, height: metadata.height, bytes: bytes.length, sha256: hash(bytes), fileExtension };
}
async function manufacturerFields(url, model) {
  if (!url) return {};
  const file = path.join(EVIDENCE, `manufacturer-${slug(model)}.html`);
  if (REFRESH || !fs.existsSync(file)) fs.writeFileSync(file, await (await fetchChecked(url)).text());
  const html = fs.readFileSync(file, 'utf8');
  return Object.fromEntries([...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => clean(m[1]));
    return cells.length === 2 && cells[0] && cells[0].length < 120 ? cells : null;
  }).filter(Boolean));
}
function publishedDiscrepanciesFor(product) {
  const conflicts = [];
  const sourceValue = (organisation, url, value, sourceField, evidenceText) => ({ organisation, url, value, sourceField, evidenceText, checkedAt: product.sourceCheckedAt });
  if (product.manufacturerModel === 'FWEB9012IW') {
    const supplierCapacity = product.productName.match(/\b(\d+(?:\.\d+)?)\s*kg\b/i);
    const officialText = product.specifications?.manufacturerPublishedFields?.['Washing Capacity'] || '';
    const officialCapacity = officialText.match(/\b(\d+(?:\.\d+)?)\s*kg\b/i);
    if (supplierCapacity && officialCapacity && Number(supplierCapacity[1]) !== Number(officialCapacity[1])) conflicts.push({
      field: 'washingCapacity', status: 'unresolved-source-conflict',
      reason: `HNC publishes ${supplierCapacity[1]}kg; Whirlpool Australia publishes ${officialCapacity[1]}kg for this exact model. Neither source has been substituted or treated as resolved.`,
      sources: [sourceValue(SOURCE, product.productPageUrl, `${supplierCapacity[1]}kg`, 'name', product.productName.replace(/^Whirlpool\s+/i, '')), sourceValue('Whirlpool Australia', product.manufacturerUrl, `${officialCapacity[1]}kg`, 'Washing Capacity', officialText)],
    });
  }
  if (product.manufacturerModel === 'W7MWBLAUS') {
    const supplierFeature = (product.features || []).find(feature => /\b\d+\s+cooking functions\b/i.test(feature)) || '';
    const supplierFunctions = supplierFeature.match(/\b(\d+)\s+cooking functions\b/i);
    const officialFunctions = (product.manufacturerDescription || '').match(/\b(\d+)\s+versatile functions\b/i);
    if (supplierFunctions && officialFunctions && Number(supplierFunctions[1]) !== Number(officialFunctions[1])) conflicts.push({
      field: 'cookingFunctions', status: 'unresolved-source-conflict',
      reason: `HNC publishes ${supplierFunctions[1]} cooking functions; Whirlpool Australia publishes ${officialFunctions[1]} versatile functions for this exact model. The differing counts remain unresolved.`,
      sources: [sourceValue(SOURCE, product.productPageUrl, Number(supplierFunctions[1]), 'description.html', supplierFeature), sourceValue('Whirlpool Australia', product.manufacturerUrl, Number(officialFunctions[1]), 'body_html', officialFunctions[0])],
    });
  }
  return conflicts;
}
function annotateSourceDiscrepancies(product) {
  const sourceDiscrepancies = publishedDiscrepanciesFor(product);
  return { ...product, sourceDiscrepancies, manualReviewRequired: !product.primaryImage || sourceDiscrepancies.length > 0, manualReviewReason: [!product.primaryImage ? 'Exact-model image unavailable' : '', ...sourceDiscrepancies.map(conflict => conflict.reason)].filter(Boolean).join(' ') };
}
function discrepancyReport(products) {
  return { sourceConflicts: products.flatMap(product => (product.sourceDiscrepancies || []).map(conflict => ({ model: product.manufacturerModel, ...conflict }))), manualReviewModels: products.filter(product => product.manualReviewRequired).map(product => product.manufacturerModel) };
}
if (process.argv.includes('--annotate-discrepancies-only')) {
  const output = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  output.products = output.products.map(annotateSourceDiscrepancies);
  const report = { ...JSON.parse(fs.readFileSync(REPORT, 'utf8')), ...discrepancyReport(output.products) };
  json(OUT, output); json(REPORT, report);
  console.log(JSON.stringify({ mode: 'checked-evidence-only-no-network', ...discrepancyReport(output.products) }, null, 2));
  process.exit(0);
}
fs.mkdirSync(EVIDENCE, { recursive: true });
json(path.join(EVIDENCE, 'queries.json'), { checkedAt: DATE, endpoint: `${BASE}/api/magento-proxy`, brandId: BRAND, listing: LISTING_QUERY, detail: DETAIL_QUERY });
const listings = [];
const first = await graphql(LISTING_QUERY, { page: 1 }, 'listing-all-page-1.json');
listings.push(first.data.products);
for (let page = 2; page <= first.data.products.page_info.total_pages; page++) listings.push((await graphql(LISTING_QUERY, { page }, `listing-all-page-${page}.json`)).data.products);
const listed = listings.flatMap(p => p.items);
if (listed.length !== first.data.products.total_count || new Set(listed.map(p => p.sku)).size !== listed.length) throw new Error('HNC pagination did not yield every unique reported product');
const brandRoot = await graphql(LISTING_QUERY, { page: 1, root: ['1036'] }, 'brand-root-page-1.json');
if (brandRoot.data.products.total_count !== listed.length) throw new Error('Brand-page root and unfiltered brand totals disagree');
const rootProducts = [...brandRoot.data.products.items];
for (let page = 2; page <= brandRoot.data.products.page_info.total_pages; page++) rootProducts.push(...(await graphql(LISTING_QUERY, { page, root: ['1036'] }, `brand-root-page-${page}.json`)).data.products.items);
if (rootProducts.map(p => p.sku).sort().join('|') !== listed.map(p => p.sku).sort().join('|')) throw new Error('HNC brand-page and brand-all model sets disagree');
console.log(`HNC Whirlpool: ${listed.length} unique products across ${listings.length} pages; brand-page set matches.`);
const manufacturerFile = path.join(EVIDENCE, 'manufacturer-products-1.json');
if (REFRESH || !fs.existsSync(manufacturerFile)) json(manufacturerFile, await (await fetchChecked('https://whirlpool.com.au/products.json?limit=250&page=1')).json());
const manufacturerProducts = JSON.parse(fs.readFileSync(manufacturerFile, 'utf8')).products || [];
const manufacturerModels = new Map();
for (const product of manufacturerProducts) for (const variant of product.variants || []) if (variant.sku) manufacturerModels.set(variant.sku.toUpperCase(), product);
const products = []; const problems = []; const manufacturerArchived = [];
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const index = next++; if (index >= listed.length) return;
    const item = listed[index], sku = item.sku;
    const result = await graphql(DETAIL_QUERY, { sku }, `details/${slug(sku)}.json`);
    const exact = result.data.products.items.find(p => p.sku === sku);
    if (!exact) throw new Error(`Exact SKU detail missing: ${sku}`);
    const attributes = Object.fromEntries(result.data.products.aggregations.map(a => [a.attribute_code, a.options.filter(o => o.count > 0).map(o => o.label)]));
    if (!attributes.brand?.includes('Whirlpool')) throw new Error(`Wrong brand for ${sku}`);
    const familyId = familyFor(item), manufacturerModel = exact.vendorcode || sku;
    const manufacturer = manufacturerModels.get(manufacturerModel.toUpperCase()) || manufacturerModels.get(sku.toUpperCase()) || null;
    const productPageUrl = `${BASE}/products/${encodeURIComponent(sku)}`;
    const manufacturerUrl = manufacturer ? `https://whirlpool.com.au/products/${manufacturer.handle}` : '';
    const rawDescription = clean(exact.description?.html);
    const features = rawDescription.split('\n').map(s => s.replace(/^[•●*-]\s*/, '')).filter(Boolean);
    const manufacturerSpecs = await manufacturerFields(manufacturerUrl, manufacturerModel);
    const manufacturerDimensions = Object.entries(manufacturerSpecs).find(([key]) => /^(product )?dimensions$/i.test(key))?.[1] || null;
    const supplierSize = dimensions(exact.product_dimensions);
    const manufacturerSize = dimensions(manufacturerDimensions);
    const size = Object.fromEntries(Object.keys(supplierSize).map(key => [key, supplierSize[key] ?? manufacturerSize[key]]));
    const colour = (attributes.colours || []).join(' / ');
    const title = `Whirlpool ${exact.name.trim()}`;
    const capacityMatch = `${exact.name} ${rawDescription}`.match(/\b(\d+(?:\.\d+)?)\s*(L(?:itre)?s?|kg)\b/i);
    const manufacturerCapacity = Object.entries(manufacturerSpecs).find(([key]) => /^(total )?capacity$/i.test(key))?.[1] || null;
    const capacity = capacityMatch ? `${capacityMatch[1]} ${/^l/i.test(capacityMatch[2]) ? 'L' : 'kg'}` : manufacturerCapacity;
    const nameForType = `${exact.name} ${(item.categories || []).map(c => c.name).join(' ')}`;
    const installation = /fully integrated/i.test(nameForType) ? 'Fully integrated' : /built.?under/i.test(nameForType) ? 'Built-under' : /built.?in/i.test(exact.name) ? 'Built-in' : /freestanding/i.test(exact.name) ? 'Freestanding' : /front.?load/i.test(exact.name) ? 'Front load' : /top.?load/i.test(exact.name) ? 'Top load' : null;
    const fuel = /gas/i.test(exact.name) ? 'Gas' : /induction/i.test(exact.name) ? 'Induction' : /ceramic/i.test(exact.name) ? 'Ceramic electric' : /electric/i.test(exact.name) ? 'Electric' : null;
    const price = Number(exact.price_store) > 0 ? Number(exact.price_store) : null;
    const images = [...new Set([exact.product_images?.base, exact.image?.url, ...(exact.media_gallery || []).map(i => i.url)].filter(Boolean))];
    const normalModel = manufacturerModel.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const exactImages = images.filter(url => url.split('/').at(-1).replace(/[^a-z0-9]/gi, '').toLowerCase().includes(normalModel) && !/placeholder|no_image|_tech|dimension/i.test(url));
    let primaryImage = '', imageSourceUrl = '', imageMetadata = null, imageSourceOrganisation = SOURCE;
    for (const source of exactImages) {
      const fullResolution = source.replace(/\/cache\/[a-f0-9]+\//i, '/');
      const ext = /\.png(?:\?|$)/i.test(source) ? 'png' : /\.webp(?:\?|$)/i.test(source) ? 'webp' : 'jpg';
      const relative = `/images/catalogues/appliances/products/whirlpool/${slug(manufacturerModel)}.${ext}`;
      try { imageMetadata = await saveImage(fullResolution, path.join(ROOT, 'public', relative)); primaryImage = relative.replace(/\.[^.]+$/, `.${imageMetadata.fileExtension}`); imageSourceUrl = fullResolution; break; }
      catch { try { imageMetadata = await saveImage(source, path.join(ROOT, 'public', relative)); primaryImage = relative.replace(/\.[^.]+$/, `.${imageMetadata.fileExtension}`); imageSourceUrl = source; break; } catch {} }
    }
    if (!primaryImage && manufacturer?.images?.length) {
      const source = manufacturer.images.find(i => i.src.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalModel))?.src;
      if (source) try { const relative = `/images/catalogues/appliances/products/whirlpool/${slug(manufacturerModel)}.jpg`; imageMetadata = await saveImage(source, path.join(ROOT, 'public', relative)); primaryImage = relative.replace(/\.[^.]+$/, `.${imageMetadata.fileExtension}`); imageSourceUrl = source; imageSourceOrganisation = 'Whirlpool Australia'; } catch {}
    }
    if (!primaryImage) problems.push({ model: manufacturerModel, reason: 'No verified exact-model image downloaded', candidates: images });
    const archived = manufacturer?.product_type === 'Archive' || manufacturer?.tags?.includes('Archive');
    if (archived) manufacturerArchived.push({ model: manufacturerModel, hncUrl: productPageUrl, manufacturerUrl, status: 'HNC-listed; manufacturer labels Archive' });
    const specifications = { family: familyId, manufacturerModel, dimensions: exact.product_dimensions || null, ...size, capacity, finish: colour || null, installationType: installation, fuelOrEnergyType: fuel, welsRegistrationNo: exact.wels_reg_number || null, hncAttributes: attributes, features, manufacturerPublishedFields: manufacturerSpecs };
    const sourceRef = { status: 'source-verified', source: SOURCE, sourceUrl: productPageUrl, sourceCheckedAt: DATE };
    const manufacturerRef = { status: 'source-verified', source: 'Whirlpool Australia', sourceUrl: manufacturerUrl, sourceCheckedAt: DATE };
    const specificationSources = Object.fromEntries(Object.keys(specifications).filter(k => specifications[k] != null).map(k => [k, k === 'manufacturerPublishedFields' || (k.endsWith('Mm') && supplierSize[k] == null) || (k === 'capacity' && !capacityMatch && manufacturerCapacity) ? manufacturerRef : sourceRef]));
    const missing = ['widthMm', 'heightMm', 'depthMm', 'capacity', 'finish', 'fuelOrEnergyType'].filter(k => specifications[k] == null || specifications[k] === '');
    products.push({ productId: `product:appliances:${familyId}:whirlpool:${slug(manufacturerModel)}`, schemaVersion: 'product-library.appliance-catalogue.v1', categoryId: 'category:appliances', familyId, subfamilyId: '', productType: 'physical-product', brandId: 'brand:whirlpool', brandName: 'Whirlpool', manufacturer: 'Whirlpool', manufacturerModel, sku, productName: title, shortDescription: title, fullDescription: rawDescription || null, manufacturerDescription: manufacturer ? clean(manufacturer.body_html) || null : null, descriptionStatus: rawDescription ? 'source-verified' : 'not-published', specifications, specificationSources, specificationStatus: 'source-verified-published-fields', ...size, width: size.widthMm ? `${size.widthMm} mm` : null, height: size.heightMm ? `${size.heightMm} mm` : null, depth: size.depthMm ? `${size.depthMm} mm` : null, capacity, colour: colour || null, finish: colour || null, availableColours: attributes.colours || [], availableFinishes: attributes.colours || [], installationType: installation, fuelOrEnergyType: fuel, features, unit: 'EACH', hncPrice: price, rrp: price, currentRetailReference: price, currentRetailReferenceSourceUrl: productPageUrl, priceSourceUrl: productPageUrl, priceSourceOrganisation: SOURCE, priceCheckedAt: DATE, priceBasis: 'SRP inc GST', gstStatus: 'inclusive', currency: 'AUD', priceStatus: price == null ? 'quote_required' : 'current', supplierId: 'supplier:harvey-norman-commercial', supplierName: SOURCE, productPageUrl, supplierUrl: productPageUrl, manufacturerUrl, manufacturerRangeStatus: archived ? 'archived-on-manufacturer-site' : manufacturer ? 'listed' : 'not-verified', primaryImage, additionalImages: [], imageStatus: primaryImage ? imageSourceOrganisation === SOURCE ? 'verified-authorised-supplier-local' : 'verified-manufacturer-local' : 'missing', imageVerificationStatus: primaryImage ? 'verified-exact-model' : 'missing', imageSourceUrl, imageSourcePageUrl: imageSourceOrganisation === SOURCE ? productPageUrl : manufacturerUrl, imageSourceOrganisation, imageMetadata, imageCheckedAt: DATE, imageVerifiedAt: DATE, productPageStatus: 'verified', applicableRooms: ['washing-machines','dryers','washer-dryers'].includes(familyId) ? ['laundry'] : ['kitchen'], active: true, selectable: true, discontinued: false, discontinuedStatus: 'not-verified', source: { type: 'authorised-supplier-api', organisation: SOURCE, url: productPageUrl, listingUrl: `${BASE}/brands/whirlpool`, apiEndpoint: `${BASE}/api/magento-proxy`, brandId: BRAND }, research: { verificationStatus: 'source-verified', sourceOrganisation: SOURCE, checkedAt: DATE, missingPublishedFields: missing }, evidence: { sourceOrganisation: SOURCE, sourceCheckedAt: DATE, evidenceStatus: 'exact-model-source-verified', file: `artifacts/catalogue/whirlpool-hnc-20260916/details/${slug(sku)}.json`, sourceCategories: item.categories, manufacturerUrl }, sourceCheckedAt: DATE, manualReviewRequired: !primaryImage, manualReviewReason: !primaryImage ? 'Exact-model image unavailable' : '' });
    console.log(`${index + 1}/${listed.length} ${sku} ${familyId} ${price == null ? 'POA' : `$${price}`} ${primaryImage ? 'image verified' : 'IMAGE MISSING'}`);
  }
}));
products.sort((a, b) => a.familyId.localeCompare(b.familyId) || a.manufacturerModel.localeCompare(b.manufacturerModel));
products.forEach((product, index) => { products[index] = annotateSourceDiscrepancies(product); });
const logoUrl = 'https://whirlpool.com.au/cdn/shop/files/whirlpool_logo-black-01_200x@2x.png?v=1723438793';
const logoPath = '/images/catalogues/appliances/brands/whirlpool-official.png';
const logoMetadata = await saveImage(logoUrl, path.join(ROOT, 'public', logoPath));
const familyCounts = Object.fromEntries(REQUESTED_FAMILIES.map(f => [f, products.filter(p => p.familyId === f).length]));
const output = { schemaVersion: 'product-library.appliance-catalogue.v1', sourceCheckedAt: DATE, brand: 'Whirlpool', source: `${BASE}/brands/whirlpool`, products };
const report = { checkedAt: DATE, source: `${BASE}/brands/whirlpool`, complete: products.length === listed.length, expectedTotal: first.data.products.total_count, pageSize: 25, pages: listings.map((p, i) => ({ page: i + 1, declaredTotal: p.total_count, totalPages: p.page_info.total_pages, count: p.items.length, models: p.items.map(x => x.sku) })), brandPageAndUnfilteredBrandModelsMatch: true, sourceCategoryAggregations: first.data.products.aggregations.find(a => a.attribute_code === 'category_id')?.options || [], familyCounts, imageCount: products.filter(p => p.primaryImage).length, missingPrices: products.filter(p => p.hncPrice == null).map(p => p.manufacturerModel), manufacturerArchived, problems, logo: { path: logoPath, sourceUrl: logoUrl, sourcePageUrl: 'https://whirlpool.com.au/', sourceOrganisation: 'Whirlpool Australia', checkedAt: DATE, ...logoMetadata }, outputPath: path.relative(ROOT, OUT), notes: ['All HNC Whirlpool brand results enumerated without family filters; zero-count categories are verified absent from this HNC brand result set, not asserted absent globally.', 'HNC SRP inc GST is reference pricing; no cost, tenant price, or supplier trade price is inferred.', 'Manufacturer Archive flags are reported separately; HNC presence does not prove manufacturer current production.', 'Official manufacturer description may differ from HNC feature counts; both sources remain separate.'] };
Object.assign(report, discrepancyReport(products));
json(OUT, output); json(REPORT, report);
console.log(JSON.stringify({ output: OUT, report: REPORT, counts: familyCounts, images: report.imageCount, products: products.length, problems }, null, 2));
if (problems.length) process.exitCode = 2;
