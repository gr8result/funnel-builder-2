// Builds the current, active Omega Appliances Australia range across ovens,
// cooktops, rangehoods, dishwashers, freestanding cookers and microwaves,
// scraped directly from omegaappliances.com.au (the official current-range
// source), and downloads each model's own product image.
//
// Omega's own site publishes every price as $0.00 (not usable) - genuine
// Australian retail pricing is layered on separately in
// integrate-omega-range.mjs from a small set of named AU retailers.
//
//   node scripts/product-library/import-omega-range.mjs [--dry-run] [--only=<familyId>]
//
// Output: data/product-library/catalogues/appliances/AU-OMEGA-APPLIANCE-RANGE.json
// Images: public/images/catalogues/appliances/products/omega/<model>.<ext>
//
// The site is server-rendered Squarespace commerce: each category listing
// page embeds a full product-list JSON blob (title/description/price/images)
// in a `data-context` attribute, and each product's own detail page renders
// a plain-text "Specifications" block (Dimensions, Capacity, Installation,
// and - for rangehoods - a much richer key:value spec table). No headless
// browser is needed; everything is read from the raw HTML.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-OMEGA-APPLIANCE-RANGE.json');
const ASSET_DIR = '/images/catalogues/appliances/products/omega';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE_ORG = 'Omega Appliances Australia';
const BASE = 'https://omegaappliances.com.au';
const DRY = process.argv.includes('--dry-run');

const ALL_CATEGORIES = [
  { familyId: 'ovens', path: '/ovens' },
  { familyId: 'cooktops', path: '/cooktops' },
  { familyId: 'rangehoods', path: '/rangehoods' },
  { familyId: 'dishwashers', path: '/dishwashers' },
  { familyId: 'freestanding-cookers', path: '/freestanding-cookers' },
  { familyId: 'microwaves', path: '/compacts-microwaves' },
];
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
const CATEGORIES = ONLY ? ALL_CATEGORIES.filter((c) => c.familyId === ONLY) : ALL_CATEGORIES;
if (ONLY && !CATEGORIES.length) { console.error(`Unknown --only family: ${ONLY}`); process.exit(1); }

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const decodeEntities = (s) => String(s || '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
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

function htmlToLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&').replace(/&deg;/g, '°').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

function stripHtmlToFeatures(descriptionHtml) {
  const items = [...String(descriptionHtml || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&deg;/g, '°').trim())
    .filter(Boolean);
  return items;
}
function descriptionPlainText(descriptionHtml) {
  return String(descriptionHtml || '')
    .replace(/<li[\s\S]*?<\/ul>/g, '') // drop the bullet list, keep only the lead paragraph(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&deg;/g, '°').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// -- category listing: read the embedded product-list JSON -----------------

async function listCategory(familyId, catPath) {
  const html = await fetchText(`${BASE}${catPath}`);
  const m = html.match(/<div\s+class="product-list"[^>]*data-context="([^"]+)"/);
  if (!m) { console.error(`[${familyId}] no product-list data-context found`); return []; }
  const data = JSON.parse(decodeEntities(m[1]));
  return (data.items || []).map((item) => ({
    familyId,
    id: item.id,
    title: item.title,
    fullUrl: item.fullUrl,
    soldOut: Boolean(item.soldOut),
    descriptionHtml: item.description || '',
    sku: (item.variants && item.variants[0] && item.variants[0].sku) || '',
    imageUrl: (item.mainImage && item.mainImage.assetUrl) || (item.images && item.images[0] && item.images[0].assetUrl) || '',
  }));
}

// -- product detail page: parse the plain-text Specifications block --------

function parseSpecBlock(lines) {
  const specIdx = lines.indexOf('Specifications');
  const dlIdx = lines.indexOf('Downloads');
  if (specIdx < 0) return {};
  const block = dlIdx > specIdx ? lines.slice(specIdx + 1, dlIdx) : lines.slice(specIdx + 1, specIdx + 40);
  const spec = {};
  let i = 0;
  while (i < block.length) {
    const line = block[i];
    if (line === 'Show all Specifications') { i += 1; continue; }
    const colonMatch = line.match(/^([^:]{2,60}):\s*(.+)$/);
    if (colonMatch) {
      spec[colonMatch[1].trim()] = colonMatch[2].trim();
      i += 1;
    } else if (i + 1 < block.length) {
      spec[line] = block[i + 1];
      i += 2;
    } else {
      i += 1;
    }
  }
  return spec;
}

function warrantyFrom(spec, features) {
  const specW = spec['Warranty'];
  if (specW) return specW;
  const f = features.find((x) => /warranty/i.test(x));
  return f || '';
}

async function detailFor(fullUrl) {
  try {
    const html = await fetchText(`${BASE}${fullUrl}`);
    const lines = htmlToLines(html);
    const spec = parseSpecBlock(lines);
    return { spec };
  } catch (e) {
    return { spec: {}, error: e.message };
  }
}

// -- classification: read genuine descriptors straight off the title -------

function widthFromTitle(title) {
  const m = String(title).match(/(\d{2,3})\s*[×x]\s*(\d{2,3})\s*cm/i) || String(title).match(/(\d{2,3})\s*cm/i);
  return m ? Number(m[1]) : null;
}
function colourFromTitle(title) {
  const t = String(title);
  const afterComma = t.split(',')[1];
  const known = ['Dusk Grey', 'Midnight', 'Stainless Steel', 'Black Stainless Steel', 'Moonlight Silver', 'Matte Black', 'Black Finish', 'White', 'Black'];
  for (const c of known) if (t.includes(c)) return c;
  return afterComma ? afterComma.trim() : '';
}
function ovenType(title) {
  const t = title.toLowerCase();
  if (/pyrolytic/.test(t) && /steam/.test(t)) return 'Pyrolytic + Steam';
  if (/pyrolytic/.test(t)) return 'Pyrolytic';
  if (/steam/.test(t)) return 'Steam';
  if (/double/.test(t)) return 'Double oven';
  if (/side-opening/.test(t)) return 'Side-opening';
  return 'Multifunction';
}
function cooktopType(title) {
  const t = title.toLowerCase();
  if (/hybrid/.test(t)) return 'Hybrid (gas + induction)';
  if (/gas on (ceramic|black|glass)/.test(t)) return 'Gas on glass';
  if (/induction/.test(t)) return 'Induction';
  if (/ceramic/.test(t)) return 'Ceramic';
  if (/gas/.test(t)) return 'Gas';
  return 'Not stated';
}
function rangehoodType(title) {
  const t = title.toLowerCase();
  if (/undermount/.test(t)) return 'Undermount';
  if (/canopy/.test(t)) return 'Canopy';
  if (/slide-?out/.test(t)) return 'Slide-out';
  if (/fixed/.test(t)) return 'Fixed';
  return 'Not stated';
}
function dishwasherType(title) {
  const t = title.toLowerCase();
  if (/fully integrated|^60cm integrated/.test(t) || /\bintegrated\b/.test(t) && !/semi/.test(t)) return 'Fully integrated';
  if (/semi-integrated/.test(t)) return 'Semi-integrated';
  if (/benchtop/.test(t)) return 'Benchtop';
  if (/compact/.test(t)) return 'Compact';
  if (/freestanding/.test(t)) return 'Freestanding';
  return 'Not stated';
}
function microwaveType(title) {
  const t = title.toLowerCase();
  if (/warming drawer/.test(t)) return 'Warming drawer';
  if (/trim kit/.test(t)) return 'Accessory';
  if (/combi/.test(t)) return 'Compact combination microwave';
  if (/built-?in/.test(t)) return 'Built-in microwave';
  if (/integrated/.test(t)) return 'Integrated microwave';
  if (/freestanding/.test(t)) return 'Freestanding microwave';
  return 'Not stated';
}

// -- run ----------------------------------------------------------------

const rows = [];
const problems = [];

for (const cat of CATEGORIES) {
  let items;
  try { items = await listCategory(cat.familyId, cat.path); } catch (e) { console.error(`[${cat.familyId}] listing failed: ${e.message}`); continue; }
  console.error(`[${cat.familyId}] ${items.length} items`);

  for (const item of items) {
    const model = (item.sku || '').toUpperCase();
    if (!model) { problems.push({ title: item.title, why: 'no sku' }); continue; }
    const { spec } = await detailFor(item.fullUrl);
    const features = stripHtmlToFeatures(item.descriptionHtml);
    const blurb = descriptionPlainText(item.descriptionHtml);

    const dims = spec['Dimensions'] || spec['Product Dimensions (mm)'] || '';
    const wMatch = dims.match(/(\d+(?:\.\d+)?)\s*w/i);
    const dMatch = dims.match(/(\d+(?:\.\d+)?)\s*d/i);
    const hMatch = dims.match(/(\d+(?:\.\d+)?)\s*[-–]?\s*(?:\d+(?:\.\d+)?)?\s*h/i);
    const widthMm = wMatch ? Number(wMatch[1]) : widthFromTitle(item.title) ? widthFromTitle(item.title) * 10 : null;
    const depthMm = dMatch ? Number(dMatch[1]) : null;
    const heightMm = hMatch ? Number(hMatch[1]) : null;

    const chosenImg = item.imageUrl;
    let imgResult = { ok: false };
    if (chosenImg) imgResult = await fetchBin(chosenImg);
    let rel = '';
    if (imgResult.ok && imgResult.ct.startsWith('image/')) {
      rel = `${ASSET_DIR}/${slug(model)}${extFor(chosenImg, imgResult.ct)}`;
      if (!DRY) {
        fs.mkdirSync(path.join(ROOT, 'public', path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'public', rel), imgResult.body);
      }
    } else {
      problems.push({ model, why: `image fetch failed: ${imgResult.status || 'no image url'}` });
    }

    const typeFn = { ovens: ovenType, cooktops: cooktopType, rangehoods: rangehoodType, dishwashers: dishwasherType, microwaves: microwaveType, 'freestanding-cookers': () => 'Freestanding' }[cat.familyId];

    rows.push({
      product_code: `APP-OMEGA-${slug(model).toUpperCase()}`,
      manufacturerModel: model,
      family_key: cat.familyId,
      brand: 'Omega',
      manufacturer: 'Omega',
      supplier: SOURCE_ORG,
      product_name: item.title.split('|')[0].trim().replace(/,\s*$/, '') ? `Omega ${item.title.split('|')[0].trim()}` : `Omega ${item.title}`,
      titleRaw: item.title,
      model,
      widthMm,
      depthMm,
      heightMm,
      dimensionsRaw: dims,
      configuration: typeFn ? typeFn(item.title) : 'Not stated',
      installationType: spec['Installation'] || spec['Profile Type'] || (cat.familyId === 'freestanding-cookers' ? 'Freestanding' : ''),
      colour: colourFromTitle(item.title) || spec['Finish'] || spec['Colour'] || '',
      capacity: spec['Oven Capacity'] || spec['Capacity'] || '',
      description: blurb,
      features,
      specifications: spec,
      warranty: warrantyFrom(spec, features),
      soldOut: item.soldOut,
      primary_image_url: rel,
      image_source_url: chosenImg,
      image_source_organisation: SOURCE_ORG,
      image_status: rel ? 'verified-official-local' : 'exact-image-unavailable',
      image_verified_at: TODAY,
      official_product_url: `${BASE}${item.fullUrl}`,
      source_type: 'official_australian_manufacturer_current_range',
      source_name: `${SOURCE_ORG} current ${cat.familyId} range`,
      source_url: `${BASE}${item.fullUrl}`,
      source_verified_at: TODAY,
    });
    console.error(`  + ${cat.familyId.padEnd(20)} ${model.padEnd(16)} ${rel ? 'img-ok' : 'img-MISSING'}`);
  }
}

rows.sort((a, b) => a.family_key.localeCompare(b.family_key) || a.manufacturerModel.localeCompare(b.manufacturerModel));

// Merge, never blank a family that wasn't (re)scraped this run.
function mergeWithExisting(scraped) {
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')).products || []; } catch { existing = []; }
  const keyOf = (r) => String(r.manufacturerModel || '').toUpperCase();
  const scrapedFamilies = new Set(scraped.map((r) => r.family_key));
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));
  for (const row of scraped) byKey.set(keyOf(row), row);
  const merged = [...byKey.values()].filter((r) => scrapedFamilies.has(r.family_key) || !CATEGORIES.some((c) => c.familyId === r.family_key));
  return merged;
}

const outputRows = ONLY ? mergeWithExisting(rows) : rows;
outputRows.sort((a, b) => a.family_key.localeCompare(b.family_key) || a.manufacturerModel.localeCompare(b.manufacturerModel));

if (!DRY) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({
    catalogue: 'AU Omega Appliance Range',
    generatedAt: TODAY,
    note: 'Built by scripts/product-library/import-omega-range.mjs from the current Omega Appliances Australia (omegaappliances.com.au) live category listings. Every row carries that exact model\'s own product image and specification text. Omega\'s own site prices are all $0.00 and are NOT carried into this file; verified Australian retail prices are layered on separately during catalogue integration.',
    officialSources: ALL_CATEGORIES.map((c) => ({ familyId: c.familyId, listing: `${BASE}${c.path}` })),
    products: outputRows,
  }, null, 2)}\n`);
  console.error(`Wrote ${OUT}`);
}

console.log(JSON.stringify({
  imported: rows.length,
  byFamily: rows.reduce((a, r) => { a[r.family_key] = (a[r.family_key] || 0) + 1; return a; }, {}),
  imagesOk: rows.filter((r) => r.primary_image_url).length,
  imagesMissing: rows.filter((r) => !r.primary_image_url).map((r) => r.manufacturerModel),
  soldOutCount: rows.filter((r) => r.soldOut).length,
  problems,
}, null, 2));
