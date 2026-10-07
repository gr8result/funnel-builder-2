// Builds AU-KITCHEN-SINK-CATALOGUE.json from the sink manufacturers' own
// product sitemaps, downloading each product's own photo.
//
//   node scripts/product-library/import-kitchen-sinks.mjs [--dry-run] [--limit=N] [--brand=Abey]
//
// The four brands span the price range the selection module needs: Everhard and
// Oliveri at the value end, Seima and Abey through mid and premium. Only pages
// that yield an exact product image are kept - the existing sink rows carried a
// generic Unsplash kitchen scene as their "image", which is what this replaces.

import fs from 'node:fs';
import path from 'node:path';
import { getMasterProducts } from '../../lib/product-library/catalogueService.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/product-library/catalogues/kitchen/AU-KITCHEN-SINK-CATALOGUE.json');
const ASSET_DIR = '/images/catalogues/kitchen/sinks';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TODAY = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const BRAND_ONLY = (args.find((a) => a.startsWith('--brand=')) || '').split('=')[1] || '';

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function get(url, binary = false) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: binary ? 'image/*' : 'text/html,application/xml,*/*', 'Accept-Language': 'en-AU,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(40000) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, url: r.url, ct: r.headers.get('content-type') || '', body: binary ? Buffer.from(await r.arrayBuffer()) : await r.text() };
  } catch (e) { return { ok: false, status: 'ERR:' + e.name }; }
}

function imageSize(buf) {
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const f = buf.toString('ascii', 12, 16);
    if (f === 'VP8X') return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (f === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (f === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return { w: 0, h: 0 };
}
const extFor = (u, ct) => {
  const c = String(u).split('?')[0].toLowerCase();
  for (const e of ['.webp', '.jpeg', '.jpg', '.png']) if (c.endsWith(e)) return e === '.jpeg' ? '.jpg' : e;
  return ct.includes('webp') ? '.webp' : ct.includes('png') ? '.png' : '.jpg';
};

const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

function ldProducts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = Array.isArray(j) ? j : (j['@graph'] ? j['@graph'] : [j]);
    for (const n of nodes) if ([].concat(n['@type'] || []).includes('Product')) out.push(n);
  }
  return out;
}
const h1 = (html) => ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const ogImage = (html) => (html.replace(/&amp;/g, '&').match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';

// -- per-brand extraction ----------------------------------------------------

const BRANDS = {
  Abey: {
    sitemap: 'https://www.abey.com.au/product-sitemap.xml',
    keep: (u) => /\/product\/sinks\/kitchen-sinks\//i.test(u),
    parse(html, url) {
      const p = ldProducts(html)[0];
      if (!p) return null;
      const price = Number(p.offers?.price ?? [].concat(p.offers || [])[0]?.price ?? 0) || null;
      return { name: p.name || h1(html), model: p.sku || '', price, image: [].concat(p.image || [])[0] || ogImage(html) };
    },
  },
  Oliveri: {
    sitemap: 'https://www.oliveri.com.au/sitemap.xml/sitemap/SilverStripe-CMS-Model-SiteTree/1',
    keep: (u) => /\/products\//i.test(u) && /sink/i.test(u) && !/laundry|basin|tub|care|clearance/i.test(u),
    parse(html, url) {
      const name = h1(html);
      // Oliveri hosts each shot at /assets/Products/<CODE>__*.png
      const assets = [...new Set([...html.matchAll(/\/assets\/Products\/([A-Z0-9-]+)__[^"']+\.(?:png|jpg|jpeg|webp)/gi)].map((m) => m[0]))];
      if (!assets.length) return null;
      const model = (assets[0].match(/\/assets\/Products\/([A-Z0-9-]+)__/i) || [])[1] || '';
      // The page carries one GA4 dataLayer entry for the product itself. Prices
      // scraped out of the visible copy pick up related items and accessories,
      // so this is the only figure trusted here.
      const category = (html.match(/"item_category"\s*:\s*"([^"]+)"/i) || [])[1] || '';
      if (category && !/kitchen sink/i.test(category)) return null;
      const priceRaw = (html.match(/"item_category"\s*:\s*"[^"]*"\s*,\s*"price"\s*:\s*([\d.]+)/i)
        || html.match(/"item_name"[\s\S]{0,200}?"price"\s*:\s*([\d.]+)/i) || [])[1];
      const price = priceRaw ? Number(priceRaw) : null;
      return { name, model, price: price && price > 40 ? price : null, image: new URL(assets[0], url).href };
    },
  },
  Everhard: {
    sitemap: 'https://www.everhard.com.au/product-sitemap.xml',
    keep: (u) => /sink|bowl|drainer/i.test(u) && !/laundry|tub|basin/i.test(u),
    parse(html, url) {
      const img = ogImage(html);
      if (!img) return null;
      const t = plain(html);
      const model = (t.match(/\b(?:Product Code|Code|SKU)\s*:?\s*([A-Z0-9][A-Z0-9-]{3,})\b/i) || [])[1] || '';
      return { name: h1(html), model, price: null, image: img };
    },
  },
  Seima: {
    sitemap: 'https://seima.com.au/product-sitemap.xml',
    keep: (u) => /sink/i.test(u) && !/laundry|basin|tub/i.test(u),
    parse(html, url) {
      const img = ogImage(html);
      if (!img) return null;
      const t = plain(html);
      const model = (t.match(/\b(SKS?-[A-Z0-9-]{2,})\b/i) || [])[1] || '';
      return { name: h1(html), model, price: null, image: img };
    },
  },
};

// -- classification ----------------------------------------------------------

function bowlConfiguration(name) {
  const n = name.toLowerCase();
  if (/1\s*&\s*3\/4|1\.75|1 3\/4|one and three quarter/.test(n)) return '1 & 3/4 bowl';
  if (/1\s*&\s*1\/2|1\.5|1 1\/2|one and a half/.test(n)) return '1 & 1/2 bowl';
  if (/double bowl|2 bowl|twin bowl/.test(n)) return 'Double bowl';
  if (/triple/.test(n)) return 'Triple bowl';
  if (/single bowl|1 bowl/.test(n)) return 'Single bowl';
  return 'Single bowl';
}
function installationType(name) {
  const n = name.toLowerCase();
  if (/undermount|under mount/.test(n)) return 'Undermount';
  if (/flushmount|flush mount/.test(n)) return 'Flushmount';
  if (/topmount|top mount|inset|drop.?in|abovemount/.test(n)) return 'Inset';
  if (/farmhouse|apron|butler/.test(n)) return 'Farmhouse / apron';
  return 'Inset or undermount';
}
function material(name) {
  const n = name.toLowerCase();
  if (/granite|quartz|composite/.test(n)) return 'Granite composite';
  if (/fireclay|ceramic|porcelain/.test(n)) return 'Fireclay / ceramic';
  if (/copper/.test(n)) return 'Copper';
  if (/brass/.test(n)) return 'Brass';
  return 'Stainless steel';
}
const hasDrainer = (name) => /drainer|drain(?:ing)? (?:board|tray)/i.test(name);

// -- crawl -------------------------------------------------------------------

async function sitemapLocs(url) {
  const r = await get(url);
  if (!r.ok) return [];
  return [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
}

const EXISTING_CODES = new Set(getMasterProducts().map((p) => p.productCode).filter(Boolean));
const records = [];
const skipped = [];
let downloaded = 0;

for (const [brand, cfg] of Object.entries(BRANDS)) {
  if (BRAND_ONLY && brand !== BRAND_ONLY) continue;
  let locs = (await sitemapLocs(cfg.sitemap)).filter(cfg.keep);
  if (LIMIT) locs = locs.slice(0, LIMIT);
  console.error(`[${brand}] ${locs.length} candidate sink pages`);

  for (const url of locs) {
    const page = await get(url);
    if (!page.ok) { skipped.push({ brand, url, why: `page ${page.status}` }); continue; }
    let info;
    try { info = cfg.parse(page.body, page.url); } catch { info = null; }
    if (!info || !info.name || !info.image) { skipped.push({ brand, url, why: 'no name/image on page' }); continue; }
    if (!/sink|bowl/i.test(info.name)) { skipped.push({ brand, url, why: `name is not a sink: ${info.name}` }); continue; }

    const img = await get(info.image, true);
    if (!img.ok || !img.ct.startsWith('image/')) { skipped.push({ brand, url, why: `image ${img.status || img.ct}` }); continue; }
    const size = imageSize(img.body);
    if (size.w < 250 || size.h < 250) { skipped.push({ brand, url, why: `image too small ${size.w}x${size.h}` }); continue; }

    const code = info.model || slug(info.name).toUpperCase().slice(0, 24);
    const productCode = `SINK-${slug(brand).toUpperCase()}-${slug(code).toUpperCase()}`;
    if (records.some((r) => r.product_code === productCode)) { skipped.push({ brand, url, why: 'duplicate code' }); continue; }
    // A code already in the master catalogue would give two rows the same identity,
    // which silently drops one on package import.
    if (EXISTING_CODES.has(productCode)) { skipped.push({ brand, url, why: `product_code ${productCode} already in the master catalogue` }); continue; }

    const rel = `${ASSET_DIR}/${slug(brand)}-${slug(code)}${extFor(info.image, img.ct)}`;
    if (!DRY_RUN) {
      const dest = path.join(ROOT, 'public', rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, img.body);
    }
    downloaded += 1;

    const config = bowlConfiguration(info.name);
    records.push({
      product_code: productCode,
      family_key: 'kitchen-sinks',
      requirement_keys: 'sink',
      category_key: 'Sink',
      top_level_area: 'kitchen',
      manufacturer: brand,
      brand,
      supplier: brand,
      range: info.name.split(/\s+/).slice(0, 2).join(' '),
      product_name: `${brand} ${info.name}`.replace(new RegExp(`^${brand}\\s+${brand}\\s+`, 'i'), `${brand} `),
      model: info.model || code,
      configuration: `${config}${hasDrainer(info.name) ? ' / drainer' : ''}`,
      material: material(info.name),
      finish: material(info.name),
      primary_image_url: rel,
      image_source_url: info.image,
      image_source_type: 'official_manufacturer_page',
      image_status: 'verified_exact',
      image_verified_at: TODAY,
      official_product_url: url,
      client_price: info.price ?? null,
      rrp: info.price ?? null,
      price_status: info.price ? 'current' : 'quote_required',
      price_unit: 'each',
      currency: 'AUD',
      regions: 'AU',
      active: 'true',
      source_type: 'official_manufacturer_page',
      source_name: `${brand} ${info.model || info.name} product page`,
      source_url: url,
      source_verified_at: TODAY,
      attributes: {
        installationType: installationType(info.name),
        bowlConfiguration: config,
        hasDrainer: hasDrainer(info.name),
      },
    });
    if (records.length % 25 === 0) console.error(`  … ${records.length} sinks so far`);
  }
}

records.sort((a, b) => (a.client_price ?? 1e9) - (b.client_price ?? 1e9) || a.product_name.localeCompare(b.product_name));

if (!DRY_RUN) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({
    catalogue: 'AU Kitchen Sink Catalogue',
    generatedAt: TODAY,
    note: 'Built by scripts/product-library/import-kitchen-sinks.mjs from each manufacturer\'s own product pages. Every row carries that product\'s own photo.',
    officialSources: Object.entries(BRANDS).map(([b, c]) => ({ brand: b, sitemap: c.sitemap })),
    products: records,
  }, null, 2)}\n`);
}

const byBrand = {};
const priced = records.filter((r) => r.client_price != null).map((r) => r.client_price).sort((a, b) => a - b);
for (const r of records) byBrand[r.brand] = (byBrand[r.brand] || 0) + 1;
console.log(JSON.stringify({
  sinks: records.length, imagesDownloaded: downloaded, byBrand,
  priced: priced.length,
  priceRange: priced.length ? { min: priced[0], median: priced[Math.floor(priced.length / 2)], max: priced.at(-1) } : null,
  skipped: skipped.length,
  out: path.relative(ROOT, OUT),
}, null, 2));
fs.writeFileSync(path.join(ROOT, 'data/catalogue/reconciliation/KITCHEN_SINK_IMPORT_SKIPPED.json'), `${JSON.stringify(skipped, null, 2)}\n`);
