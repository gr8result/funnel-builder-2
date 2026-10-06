// Small curated accessory addition, using HNC's public API (the same source as our
// appliance/fixture importers). Run with node; --dry-run stages without catalogue
// or image changes. --refresh re-reads source evidence. At most two additions
// per requested type/brand; reruns update this batch instead of adding another batch.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { classifyBathroomAccessory, discoverBathroomAccessoryTypes } from '../../lib/product-library/bathroomAccessoryDiscovery.js';
import { createHncCatalogueClient, fetchHnc, writeJson, HNC_BASE, HNC_SOURCE, HNC_ENDPOINT } from './hncCatalogueClient.mjs';

const ROOT = process.cwd();
const EVIDENCE = 'data/product-library/source-evidence/hnc-bathroom-five-brands';
const OUTPUT = 'data/product-library/catalogues/plumbing/AU-HNC-PLUMBING-CATALOGUE.json';
const BRANDS = ['Caroma', 'Phoenix', 'Parisi', 'Astrawalker', 'Forme'];
const PER_BRAND_TYPE = 2;
const BATCH = 'hnc-bathroom-five-brands-v1';
const TARGETS = [
  { key: 'towel-rail', category: 'Towel Rails' },
  { key: 'toilet-roll-holder', category: 'Toilet Roll Holders' },
  { key: 'hand-towel', category: 'Towel Rings', accepts: name => /towel ring/i.test(name) },
  { key: 'heated-towel-rail', category: 'Heated Towel Rails' },
  { key: 'robe-hook', category: 'Robe Hooks' },
];
const DRY = process.argv.includes('--dry-run') || process.argv.includes('--list-candidates');
const REPORT = `${EVIDENCE}/${DRY ? 'dry-run-report' : 'import-report'}.json`;
const REFRESH = process.argv.includes('--refresh');
const DATE = new Date().toISOString().slice(0, 10);
const slug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (value) => String(value || '').trim().toUpperCase();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const clean = (value) => String(value || '').replace(/<br\s*\/?\s*>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).split('\n').map(s => s.trim()).filter(Boolean).join('\n');
const positive = (value) => Number(value) > 0 ? Number(value) : null;
// Persist only product/customer-facing fields; never internal supplier cost or stock data.
const attributeCodes = new Set(['brand', 'colours', 'supplier_colour', 'finish', 'material', 'range', 'product_dimensions', 'size_mm', 'warranty', 'specification', 'spec_sheet', 'specsheet', 'product_specification', 'gp_product_group', 'gp_product_type', 'vendorcode', 'status', 'visibility', 'supplier_finish']);
const client = createHncCatalogueClient({ evidenceDirectory: EVIDENCE, refresh: REFRESH, sanitize: (result) => {
  for (const item of result.data?.products?.items || []) {
    if (item.custom_attributesV2) item.custom_attributesV2.items = item.custom_attributesV2.items.filter(a => attributeCodes.has(a.code));
  }
  return result;
} });
const readCatalogue = () => JSON.parse(fs.readFileSync(OUTPUT, 'utf8').replace(/^\uFEFF/, ''));
const original = readCatalogue();
const before = discoverBathroomAccessoryTypes(original.products);
const existingByUrl = new Map(original.products.map(p => [key(p.attributes?.hncUrlKey || decodeURIComponent((p.official_product_url || '').split('/products/')[1] || '')), p]));
const codeIdentity = (brand, code) => `${key(brand)}|${key(code).replace(/[^A-Z0-9]/g, '')}`;
const existingByCode = new Map(original.products.map(p => [codeIdentity(p.brand, p.sku), p]));
const sourceAttributes = item => Object.fromEntries(item.custom_attributesV2.items.map(a => [a.code, a.selected_options?.map(o => o.label).join(' / ') || a.value || '']));
const classifySource = (row) => classifyBathroomAccessory({ productName: row.name, categories: row.categories, topLevelArea: 'bathroom' });
const fields = 'id sku vendorcode name categories{id name url_path}';
// Discover the root from the supplier taxonomy instead of maintaining category-id lists.
const tree = await client.query('{categories(filters:{name:{match:"Bathroom"}}){items{id name url_path children{id name url_path children{id name url_path}}}}}', {}, 'category-tree.json');
const accessories = tree.data.categories.items.find(c => c.name.trim().toLowerCase() === 'bathroom accessories');
if (!accessories) throw new Error('HNC Bathroom Accessories root not found');
const facets = await client.query(`{products(filter:{category_id:{eq:"${accessories.id}"}},pageSize:1){aggregations{attribute_code options{label value count}}}}`, {}, 'brand-facets.json');
const brandOptions = facets.data.products.aggregations.find(a => a.attribute_code === 'brand').options;
const report = { checkedAt: DATE, supplier: HNC_SOURCE, endpoint: HNC_ENDPOINT, batch: BATCH, requestedBrands: BRANDS, perBrandType: PER_BRAND_TYPE, coverage: [], dryRun: DRY, imported: 0, updated: 0, duplicateSupplierCodes: [], rejected: [], images: [], categories: [], brands: {}, finishes: {} };

const detailFields = `${fields} image{url} product_images{base first_gallery second_gallery} media_gallery{url} description{html} short_description{html} product_dimensions price_store price_promo price_trade custom_attributesV2{items{code ... on AttributeValue{value} ... on AttributeSelectedOptions{selected_options{label value}}}}`;
const detailed = [];
for (const target of TARGETS) {
  const category = accessories.children.find(c => c.name.trim() === target.category);
  if (!category) throw new Error(`Missing HNC category ${target.category}`);
  for (const brand of BRANDS) {
    const brandOption = brandOptions.find(b => b.label === brand);
    if (!brandOption) throw new Error(`Missing HNC brand ${brand}`);
    const candidates = new Map();
    let page = 1, totalPages = 1, total = 0;
    do {
      const result = await client.query(`query Picks($page:Int!){products(filter:{category_id:{eq:"${category.id}"},brand:{eq:"${brandOption.value}"}},pageSize:25,currentPage:$page){total_count page_info{total_pages}items{${detailFields}}}}`, { page }, `candidates/${target.key}/${slug(brand)}-${page}.json`);
      const range = result.data.products; totalPages = range.page_info.total_pages; total = range.total_count;
      for (const item of range.items) {
        const attrs = sourceAttributes(item), code = clean(item.vendorcode || item.sku);
        const identity = codeIdentity(brand, code);
        const existing = existingByUrl.get(key(item.sku)) || existingByCode.get(identity);
        if (existing && existing.attributes?.accessoryImportBatch !== BATCH) continue;
        if (classifySource(item)?.key !== target.key || (target.accepts && !target.accepts(item.name))) continue;
        if (attrs.brand !== brand || !positive(item.price_store) || !clean(item.description?.html) || !item.image?.url || /placeholder/i.test(item.image.url)) continue;
        if (!candidates.has(identity)) candidates.set(identity, item);
      }
      page++;
    } while (page <= totalPages && candidates.size < PER_BRAND_TYPE);
    const pool = [...candidates.values()].sort((a, b) => {
      const aExisting = existingByUrl.get(key(a.sku))?.attributes?.accessoryImportBatch === BATCH;
      const bExisting = existingByUrl.get(key(b.sku))?.attributes?.accessoryImportBatch === BATCH;
      return Number(bExisting) - Number(aExisting) || a.price_store - b.price_store || a.sku.localeCompare(b.sku);
    });
    const picks = [];
    while (picks.length < PER_BRAND_TYPE && pool.length) {
      if (picks.length) pool.sort((a, b) => {
        const score = item => (existingByUrl.get(key(item.sku))?.attributes?.accessoryImportBatch === BATCH ? 100 : 0)
          + (!picks.some(p => p.name === item.name) ? 4 : 0)
          + (!picks.some(p => sourceAttributes(p).supplier_colour === sourceAttributes(item).supplier_colour) ? 2 : 0);
        return score(b) - score(a) || a.price_store - b.price_store;
      });
      picks.push(pool.shift());
    }
    detailed.push(...picks);
    report.coverage.push({ type: target.key, brand, supplierCount: total, selected: picks.map(p => p.vendorcode || p.sku) });
    console.log(`${target.key} / ${brand}: ${picks.length} selected`);
  }
}
if (detailed.length > BRANDS.length * TARGETS.length * PER_BRAND_TYPE) throw new Error('Curated import cap exceeded');
report.before = { count: before.reduce((n, g) => n + g.products.length, 0), categories: before.map(g => ({ key: g.key, count: g.products.length })) };
const staged = [], seen = new Map();
// Prefer an existing supplier URL if HNC publishes multiple aliases for one real code.
detailed.sort((a, b) => Number(existingByUrl.has(key(b.sku))) - Number(existingByUrl.has(key(a.sku))) || a.sku.localeCompare(b.sku));
for (const item of detailed) {
  const attributes = sourceAttributes(item);
  const type = classifySource(item);
  const brand = clean(attributes.brand), code = clean(item.vendorcode || item.sku), identity = codeIdentity(brand, code);
  if (!type || !brand || !code || attributes.status === 'Disabled') {
    report.rejected.push({ sku: item.sku, name: item.name, reason: !type ? 'Not an accessory' : !brand || !code ? 'Missing supplier brand/code' : 'Disabled by supplier' });
    continue;
  }
  if (seen.has(identity)) {
    seen.get(identity).attributes.hncAliasSkus.push(item.sku);
    report.duplicateSupplierCodes.push({ brand, code, retained: seen.get(identity).attributes.hncUrlKey, alias: item.sku });
    continue;
  }
  const existing = existingByUrl.get(key(item.sku)) || existingByCode.get(identity);
  const sourceUrl = `${HNC_BASE}/products/${encodeURIComponent(item.sku)}`;
  const imageUrl = [item.product_images?.base, item.image?.url, ...item.media_gallery.map(image => image.url)].find(url => url && /\/media\/catalog\/product\//.test(url) && !/placeholder|_tech|_dim|_line|_spec/i.test(url)) || '';
  const rrp = positive(item.price_store), promo = positive(item.price_promo), price = promo || rrp;
  const colour = clean(attributes.supplier_colour || attributes.colours);
  const description = clean(item.description?.html || item.short_description?.html);
  const sourceLeaf = [...item.categories].sort((a, b) => b.url_path.split('/').length - a.url_path.split('/').length)[0];
  const family = existing?.family_key || 'bathroom-accessories';
  const row = {
    ...existing, product_code: existing?.product_code || `PLB-HNC-${slug(item.sku).toUpperCase()}`,
    family_key: family, requirement_keys: existing?.requirement_keys || family,
    category_key: existing?.category_key || 'Bathroom Accessories', categories: item.categories,
    subcategory: sourceLeaf?.name.trim() || '', product_type: type.label, top_level_area: 'bathroom',
    manufacturer: brand, brand, supplier: HNC_SOURCE, product_name: clean(item.name), model: code, sku: code,
    range: clean(attributes.range), colour, finish: clean(attributes.supplier_finish || attributes.finish || colour),
    material: clean(attributes.material), dimensions: clean(item.product_dimensions), description,
    primary_image_url: existing?.primary_image_url || '', image_source_url: imageUrl,
    image_source_type: 'authorised-supplier-media', image_source_organisation: HNC_SOURCE,
    official_product_url: sourceUrl, supplier_url: sourceUrl,
    rrp, client_price: price, price_status: price ? 'current' : 'quote_required', price_unit: 'each',
    price_source_url: sourceUrl, price_verified_at: DATE, currency: 'AUD', gst_included: true,
    regions: 'AU', active: existing?.active ?? true,
    source_type: 'authorised_supplier_listing', source_name: `${HNC_SOURCE} Bathroom catalogue`, source_url: sourceUrl, source_verified_at: DATE,
    attributes: { ...existing?.attributes, plumbingCategoryKey: existing?.attributes?.plumbingCategoryKey || family,
      clientSelectionRequirement: existing?.attributes?.clientSelectionRequirement || type.key,
      bathroomAccessoryType: type.key, hncProductCode: code, hncUrlKey: item.sku, hncAliasSkus: [], hncSubCategory: sourceLeaf?.name.trim() || '',
      sourceCategories: item.categories, supplierProductType: attributes.gp_product_type || '', supplierProductGroup: attributes.gp_product_group || '',
      supplierSpecifications: attributes, features: description.split(/\n|•/).map(s => s.trim()).filter(Boolean),
      warranty: clean(attributes.warranty) || null, priceBasis: 'Harvey Norman Commercial SRP inc GST',
      ...(promo ? { promotionalPrice: promo } : {}), ...(positive(item.price_trade) ? { supplierTradePrice: positive(item.price_trade) } : {}),
      accessoryImportBatch: BATCH, sourceEvidence: EVIDENCE,
    },
  };
  seen.set(identity, row); staged.push(row);
  report[existing ? 'updated' : 'imported']++;
}
if (new Set(staged.map(p => p.product_code)).size !== staged.length) throw new Error('Product code collision; catalogue not written');
report.stagedProducts = staged.length;
report.categories = discoverBathroomAccessoryTypes(staged).map(g => ({ key: g.key, label: g.label, count: g.products.length, brands: [...new Set(g.products.map(p => p.brand))].sort() }));
for (const row of staged) { report.brands[row.brand] = (report.brands[row.brand] || 0) + 1; report.finishes[row.finish || 'Not published'] = (report.finishes[row.finish || 'Not published'] || 0) + 1; }
const prices = staged.map(p => p.client_price).filter(p => p != null);
report.prices = { min: Math.min(...prices), max: Math.max(...prices), published: prices.length, quoteRequired: staged.length - prices.length };
writeJson(`${EVIDENCE}/staged-products.json`, staged);
writeJson(REPORT, report);
if (!DRY) {
  let next = 0, completed = 0;
  const failures = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < staged.length) {
      const row = staged[next++];
      try {
        if (!row.image_source_url) throw new Error('Supplier image missing');
        const imagePath = `/images/catalogues/plumbing/hnc-accessories/${slug(row.attributes.hncUrlKey)}.webp`;
        const target = path.join(ROOT, 'public', imagePath);
        const source = row.image_source_url.replace(/\/cache\/[a-f0-9]+\//, '/');
        if (REFRESH || !fs.existsSync(target)) {
          const response = await fetchHnc(source);
          if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('Supplier returned a non-image');
          const bytes = Buffer.from(await response.arrayBuffer());
          const metadata = await sharp(bytes).metadata();
          if (!metadata.width || !metadata.height || bytes.length < 500) throw new Error('Supplier image invalid');
          fs.mkdirSync(path.dirname(target), { recursive: true });
          await sharp(bytes).rotate().resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(target);
        }
        const bytes = fs.readFileSync(target), metadata = await sharp(bytes).metadata();
        row.primary_image_url = imagePath; row.image_status = 'verified_exact'; row.image_verified_at = DATE;
        row.attributes.imageSha256 = hash(bytes);
        report.images.push({ sku: row.sku, path: imagePath, source: row.image_source_url, width: metadata.width, height: metadata.height, sha256: row.attributes.imageSha256 });
      } catch (error) { failures.push({ sku: row.sku, source: row.image_source_url, error: error.message }); }
      completed++;
      if (completed % 50 === 0 || completed === staged.length) console.log(`Verified images ${completed}/${staged.length}`);
    }
  }));
  report.imageFailures = failures;
  writeJson(REPORT, report);
  if (failures.length) throw new Error(`${failures.length} image failures; catalogue not written. See ${REPORT}`);
  // Re-read immediately before merge so unrelated concurrent catalogue work survives.
  const catalogue = readCatalogue(), byProductCode = new Map(catalogue.products.map(p => [p.product_code, p]));
  for (const row of staged) byProductCode.set(row.product_code, row);
  catalogue.products = [...byProductCode.values()]; catalogue.generatedAt = DATE;
  catalogue.accessoryImportNote = 'Curated addition from five HNC brands (Caroma, Phoenix, Parisi, Astrawalker, Forme): at most two new towel rails, toilet roll holders, towel rings, heated towel rails and robe hooks per brand/type where available. Existing products preserved. Re-run scripts/product-library/import-hnc-bathroom-accessories.mjs to refresh this batch without growing it.';
  const groups = discoverBathroomAccessoryTypes(catalogue.products);
  report.after = { count: groups.reduce((n, g) => n + g.products.length, 0), categories: groups.map(g => ({ key: g.key, label: g.label, count: g.products.length })) };
  const temp = `${OUTPUT}.accessories.tmp`;
  writeJson(temp, catalogue); fs.renameSync(temp, OUTPUT);
  report.complete = true; writeJson(REPORT, report);
}
console.log(JSON.stringify({ imported: report.imported, updated: report.updated, staged: staged.length, brands: report.brands, categories: report.categories, duplicates: report.duplicateSupplierCodes, rejected: report.rejected, prices: report.prices, dryRun: DRY }, null, 2));
