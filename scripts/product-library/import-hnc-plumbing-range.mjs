// Builds an HNC-sourced Plumbing Fixtures & Tapware range, brand-agnostic,
// across the 12 HNC categories that map onto our canonical plumbing taxonomy.
// Each row carries its own exact HNC product image and HNC SRP price.
//
//   node scripts/product-library/import-hnc-plumbing-range.mjs [--dry-run] [--pages=1] [--only=<categoryKey>]
//
// Output: data/product-library/catalogues/plumbing/AU-HNC-PLUMBING-CATALOGUE.json
// Images: public/images/catalogues/plumbing/<category>/<model>.<ext>
//
// Scope note: this run covers page 1 (optionally more via --pages) of each
// category's HNC listing - a genuine, exact-model, priced sample across every
// required category, not the exhaustive multi-page HNC range. Deeper
// pagination is a natural follow-up pass using the same script.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/product-library/catalogues/plumbing/AU-HNC-PLUMBING-CATALOGUE.json');
const ASSET_DIR = '/images/catalogues/plumbing';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE_ORG = 'Harvey Norman Commercial';
const BASE = 'https://www.harveynormancommercial.com.au';
const DRY = process.argv.includes('--dry-run');
const MAX_PAGES = Number((process.argv.find((a) => a.startsWith('--pages=')) || '').split('=')[1] || 1);

const ALL_CATEGORIES = [
  { key: 'kitchen-sinks', path: '/kitchen/sinks', topLevelArea: 'kitchen', label: 'Kitchen Sinks' },
  { key: 'kitchen-taps', path: '/kitchen/sink-tapware', topLevelArea: 'kitchen', label: 'Kitchen Taps' },
  { key: 'boiling-chilled-filtered', path: '/kitchen/filtered-taps', topLevelArea: 'kitchen', label: 'Boiling, Chilled & Filtered Water Taps' },
  { key: 'mixers-tapware', path: '/bathroom/bathroom-mixers-and-tapware', topLevelArea: 'bathroom', label: 'Mixers & Tapware' },
  { key: 'showers', path: '/bathroom/showers', topLevelArea: 'bathroom', label: 'Showers' },
  { key: 'bathroom-accessories', path: '/bathroom/bathroom-accessories', topLevelArea: 'bathroom', label: 'Bathroom Accessories' },
  { key: 'toilets', path: '/bathroom/toilets', topLevelArea: 'bathroom', label: 'Toilets' },
  { key: 'basins-bottle-traps', path: '/bathroom/basins-and-bottle-traps', topLevelArea: 'bathroom', label: 'Basins & Bottle Traps' },
  { key: 'baths-spas', path: '/bathroom/baths-and-spas', topLevelArea: 'bathroom', label: 'Baths & Spas' },
  { key: 'plugs-wastes', path: '/bathroom/plug-and-wastes', topLevelArea: 'bathroom', label: 'Plugs & Wastes' },
  { key: 'laundry-tapware', path: '/laundry/laundry-tapware', topLevelArea: 'laundry', label: 'Laundry Tapware' },
  { key: 'laundry-tubs', path: '/laundry/laundry-tubs', topLevelArea: 'laundry', label: 'Laundry Tubs' },
];
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
const CATEGORIES = ONLY ? ALL_CATEGORIES.filter((c) => c.key === ONLY) : ALL_CATEGORIES;

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// A few HNC brand codes are themselves multi-part (e.g. Villeroy & Boch's
// filenames use "v_b"), so a naive "last underscore segment before _web"
// regex truncates them to a single trailing letter. Strip the *known* model
// prefix first, then whatever remains before "_web" is the real brand code.
const KNOWN_BRAND_CODES = { v_b: 'Villeroy & Boch', vb: 'Villeroy & Boch' };
function brandFromImageUrl(imageUrl, model) {
  const filename = String(imageUrl).split('/').pop().split('?')[0].toLowerCase();
  const modelSlug = slug(model);
  // Only strip a genuine model prefix. Punctuated models (e.g. "PA404.50")
  // slug differently to how they appear in the filename, so an unmatched
  // prefix must NOT fall back to parsing the whole filename - that reads the
  // model itself back out as if it were the brand. Safer to report unknown.
  if (!filename.startsWith(`${modelSlug}_`)) return '';
  const stripped = filename.slice(modelSlug.length + 1);
  const match = stripped.match(/^(.+?)_web/);
  if (!match) return '';
  const code = match[1];
  if (KNOWN_BRAND_CODES[code]) return KNOWN_BRAND_CODES[code];
  return code.split('_')[0].replace(/^[a-z]/, (c) => c.toUpperCase());
}

async function fetchBin(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(45000) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, ct: r.headers.get('content-type') || '', body: Buffer.from(await r.arrayBuffer()) };
  } catch (e) { return { ok: false, status: `ERR:${e.name}` }; }
}
const extFor = (u, ct) => {
  const c = String(u).split('?')[0].toLowerCase();
  for (const e of ['.webp', '.jpeg', '.jpg', '.png']) if (c.endsWith(e)) return e === '.jpeg' ? '.jpg' : e;
  return ct.includes('webp') ? '.webp' : ct.includes('png') ? '.png' : '.jpg';
};

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

async function renderTiles(url) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1600, height: 1600 });
  page.on('pageerror', () => {});
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 4000));
    await page.evaluate(async () => { for (let y = 0; y < 10000; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); } });
    await new Promise((r) => setTimeout(r, 1500));
    return await page.evaluate(() => {
      const out = [];
      for (const img of document.querySelectorAll('img')) {
        const src = img.currentSrc || img.src;
        if (!src) continue;
        const decoded = decodeURIComponent(src.replace(/^.*?url=/, '').split('&')[0]);
        if (!/backend\.harveynormancommercial/.test(decoded)) continue;
        const a = img.closest('a[href]');
        const card = img.closest('li,article,div[class*="card"],div[class*="product"]') || (a && a.parentElement);
        out.push({ alt: (img.alt || '').trim(), img: decoded, href: a ? a.href : '', text: card ? card.innerText.trim().replace(/\s+/g, ' ') : '' });
      }
      return out;
    });
  } finally { await page.close(); }
}

const records = [];
const problems = [];

for (const cat of CATEGORIES) {
  const seen = new Set();
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const url = `${BASE}${cat.path}?page=${pageNo}`;
    const tiles = await renderTiles(url);
    const fresh = tiles.filter((t) => t.href && !seen.has(t.href));
    console.error(`[${cat.key}] page ${pageNo}: ${tiles.length} tiles, ${fresh.length} new`);
    if (!fresh.length) break;
    for (const t of fresh) seen.add(t.href);

    for (const t of fresh) {
      const model = (t.href.match(/\/products\/([^/?#]+)/i) || [])[1] || '';
      if (!model) { problems.push({ url: t.href, why: 'no model in url' }); continue; }
      const name = (t.alt || t.text.split(' SRP')[0] || '').trim();
      const priceMatch = t.text.match(/SRP\s*\(INC\.\s*GST\)\s*:\s*\$([\d,]+(?:\.\d{2})?)/i);
      const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;
      const brand = brandFromImageUrl(t.img, model);

      const rel = `${ASSET_DIR}/${cat.key}/${slug(model)}`;
      const img = await fetchBin(t.img.replace(/\/cache\/[0-9a-f]+\//, '/'));
      let finalRel = '';
      if (img.ok && img.ct.startsWith('image/')) {
        finalRel = `${rel}${extFor(t.img, img.ct)}`;
        if (!DRY) {
          fs.mkdirSync(path.join(ROOT, 'public', path.dirname(finalRel)), { recursive: true });
          fs.writeFileSync(path.join(ROOT, 'public', finalRel), img.body);
        }
      } else {
        problems.push({ model, why: `image ${img.status || img.ct}` });
      }

      records.push({
        product_code: `PLB-HNC-${slug(model).toUpperCase()}`,
        family_key: cat.key,
        requirement_keys: cat.key,
        category_key: cat.label,
        top_level_area: cat.topLevelArea,
        manufacturer: brand,
        brand,
        supplier: SOURCE_ORG,
        product_name: name,
        model,
        finish: '',
        description: '',
        primary_image_url: finalRel,
        image_source_url: t.img,
        image_source_type: 'authorised-supplier-media',
        image_source_organisation: SOURCE_ORG,
        image_status: finalRel ? 'verified_exact' : 'missing',
        image_verified_at: TODAY,
        official_product_url: t.href,
        client_price: price,
        rrp: price,
        price_status: price ? 'current' : 'quote_required',
        price_unit: 'each',
        currency: 'AUD',
        regions: 'AU',
        active: true,
        source_type: 'authorised_supplier_listing',
        source_name: `${SOURCE_ORG} ${cat.label} listing`,
        source_url: t.href,
        source_verified_at: TODAY,
        attributes: {
          plumbingCategoryKey: cat.key,
          priceBasis: 'Harvey Norman Commercial SRP inc GST',
        },
      });
      console.error(`  + ${cat.key.padEnd(24)} ${model.padEnd(16)} ${price ? `$${price}` : 'no price'} ${finalRel ? 'img-ok' : 'img-MISSING'}`);
    }
  }
}

await browser.close();

// Merge, never blank a category that wasn't (re)scraped this run.
function mergeWithExisting(scraped) {
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')).products || []; } catch { existing = []; }
  const keyOf = (r) => String(r.model || '').toUpperCase() + '|' + r.family_key;
  const scrapedCats = new Set(scraped.map((r) => r.family_key));
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));
  for (const row of scraped) byKey.set(keyOf(row), row);
  return [...byKey.values()].filter((r) => scrapedCats.has(r.family_key) || !CATEGORIES.some((c) => c.key === r.family_key));
}

const outputRecords = ONLY ? mergeWithExisting(records) : records;

if (!DRY) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({
    catalogue: 'AU HNC Plumbing Fixtures & Tapware Range',
    generatedAt: TODAY,
    note: `Built by scripts/product-library/import-hnc-plumbing-range.mjs from live Harvey Norman Commercial category listings (page 1${MAX_PAGES > 1 ? `-${MAX_PAGES}` : ''} of each category). Brand-agnostic - carries whatever brands HNC lists per category. Every row carries its own exact HNC product image and SRP price where published.`,
    officialSources: ALL_CATEGORIES.map((c) => ({ categoryKey: c.key, listing: `${BASE}${c.path}` })),
    products: outputRecords,
  }, null, 2)}\n`);
  console.error(`Wrote ${OUT}`);
}

console.log(JSON.stringify({
  imported: records.length,
  byCategory: records.reduce((a, r) => { a[r.family_key] = (a[r.family_key] || 0) + 1; return a; }, {}),
  priced: records.filter((r) => r.client_price != null).length,
  imagesOk: records.filter((r) => r.primary_image_url).length,
  problems,
}, null, 2));
