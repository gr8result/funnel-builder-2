// Builds the Bosch cooktop + oven range from Harvey Norman Commercial's current
// listings and downloads each model's own product image.
//
//   node scripts/product-library/import-bosch-range.mjs [--dry-run]
//
// Output: data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json
// Images: public/images/catalogues/appliances/products/bosch/<model>.<ext>
//
// The listing grid is client-rendered, so it is walked with a headless browser.
// Each tile carries the model code, the SRP and the CDN image path; the product
// page is then read for description and features.

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-BOSCH-APPLIANCE-RANGE.json');
const REPORT = path.join(ROOT, 'data/catalogue/reconciliation/BOSCH_RANGE_IMPORT_REPORT.json');
const ASSET_DIR = '/images/catalogues/appliances/products/bosch';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TODAY = new Date().toISOString().slice(0, 10);
const SOURCE_ORG = 'Harvey Norman Commercial';
const DRY = process.argv.includes('--dry-run');

const ALL_LISTINGS = [
  { familyId: 'cooktops', url: 'https://www.harveynormancommercial.com.au/kitchen/cooktops?page=%P%&category_id=23&sort=position&dir=ASC&brand=82' },
  { familyId: 'ovens', url: 'https://www.harveynormancommercial.com.au/kitchen/ovens?page=%P%&category_id=22&sort=position&dir=ASC&brand=82' },
  { familyId: 'rangehoods', url: 'https://www.harveynormancommercial.com.au/kitchen/rangehoods?page=%P%&category_id=25&sort=position&dir=ASC&brand=82' },
  { familyId: 'dishwashers', url: 'https://www.harveynormancommercial.com.au/kitchen/dishwashers?page=%P%&category_id=28&sort=position&dir=ASC&brand=82' },
];

// --only=rangehoods scrapes one family and merges it into the existing catalogue.
// Without it every family is re-scraped, and a partial scrape would otherwise
// replace good rows with nothing.
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
const LISTINGS = ONLY ? ALL_LISTINGS.filter((l) => l.familyId === ONLY) : ALL_LISTINGS;
if (ONLY && !LISTINGS.length) { console.error(`Unknown --only family: ${ONLY}`); process.exit(1); }

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function fetchBin(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(45000) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, ct: r.headers.get('content-type') || '', body: Buffer.from(await r.arrayBuffer()) };
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
      const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
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

// -- classification ----------------------------------------------------------

function widthMm(text) {
  const t = String(text);
  if (/\b900\s*mm|\b90\s*cm/i.test(t)) return 900;
  if (/\b800\s*mm|\b80\s*cm/i.test(t)) return 800;
  if (/\b750\s*mm|\b75\s*cm/i.test(t)) return 750;
  if (/\b600\s*m{1,2}\b|\b60\s*cm/i.test(t)) return 600;
  if (/\b450\s*mm|\b45\s*cm/i.test(t)) return 450;
  return null;
}
function cooktopType(text) {
  const t = String(text).toLowerCase();
  if (/induction/.test(t)) return 'Induction';
  if (/\bgas\b/.test(t)) return 'Gas';
  if (/ceramic|radiant|electric/.test(t)) return 'Ceramic electric';
  return 'Not stated';
}
function ovenType(text) {
  const t = String(text).toLowerCase();
  if (/pyroly/.test(t)) return 'Pyrolytic';
  if (/steam|added steam/.test(t)) return 'Steam / added steam';
  if (/microwave/.test(t)) return 'Combination microwave';
  if (/double|twin/.test(t)) return 'Double oven';
  if (/multi.?function|built.?in|oven/.test(t)) return 'Multifunction built-in';
  return 'Not stated';
}
// Installation type is recorded only when the listing or product page states it.
// An unstated type stays empty rather than being guessed from the model code.
function rangehoodType(text) {
  const t = String(text).toLowerCase();
  if (/under\s*mount|undermount/.test(t)) return 'Undermount';
  if (/slide\s*out|slideout|retractable/.test(t)) return 'Slide-out';
  if (/integrated|built\s*-?\s*in/.test(t)) return 'Integrated';
  if (/island/.test(t)) return 'Island';
  if (/canopy/.test(t)) return 'Canopy';
  if (/wall\s*mount/.test(t)) return 'Wall-mounted';
  return '';
}
// Extraction, noise and ducting are only captured when the page publishes them.
function extractionM3H(text) {
  const m = String(text).match(/(\d{3,4})\s*m\s*3?\s*\/\s*h|(\d{3,4})\s*m³\/h/i);
  return m ? Number(m[1] || m[2]) : null;
}
function noiseDb(text) {
  const m = String(text).match(/(\d{2})\s*db/i);
  return m ? Number(m[1]) : null;
}
function ductingFrom(text) {
  const t = String(text).toLowerCase();
  const duct = /duct(ed|ing)?/.test(t);
  const recirc = /recircul|carbon filter|charcoal filter/.test(t);
  if (duct && recirc) return 'Ducted or recirculating';
  if (duct) return 'Ducted';
  if (recirc) return 'Recirculating';
  return '';
}

function finishFrom(text) {
  const t = String(text).toLowerCase();
  if (/black steel|black stainless/.test(t)) return 'Black steel';
  if (/stainless/.test(t)) return 'Stainless steel';
  if (/black glass|black/.test(t)) return 'Black';
  if (/white/.test(t)) return 'White';
  return '';
}

// Dishwasher installation type is read verbatim from HNC's own listing title
// ("Built-In" / "Freestanding" / "Semi Integrated" / "Fully Integrated") and
// mapped onto our catalogue's installation-type vocabulary. Never guessed.
function dishwasherType(text) {
  const t = String(text).toLowerCase();
  if (/fully\s*integrated/.test(t)) return 'Fully integrated';
  if (/semi\s*integrated/.test(t)) return 'Semi-integrated';
  if (/built-?in/.test(t)) return 'Built-under';
  if (/freestanding/.test(t)) return 'Freestanding';
  return '';
}

// Pulls the structured spec block HNC publishes on every dishwasher product
// page: "COLOUR: ...", "PRODUCT CODE: ...", "SIZE: WxxxxDxxxxHxxx mm",
// "WELS REG. NO: ...", then a FEATURES bullet list. Only fields the page
// actually states are returned; nothing here is inferred.
function parseDishwasherDetailBody(body) {
  const b = String(body || '');
  const colour = (b.match(/COLOUR:\s*([^\n]+)/i) || [])[1]?.trim() || '';
  const sizeMatch = b.match(/SIZE:\s*W\s*(\d+)\s*x\s*D\s*(\d+)\s*x\s*H\s*(\d+)\s*mm/i);
  const welsRegNo = (b.match(/WELS\s*REG\.?\s*NO:?\s*([^\n]+)/i) || [])[1]?.trim() || '';
  const featuresBlock = b.match(/FEATURES:\s*([\s\S]*?)(?:ADD TO SHORTLIST|DOWNLOAD SPECSHEET|COMPARE\s*\n|$)/i);
  const features = featuresBlock
    ? featuresBlock[1].split('\n').map((s) => s.trim()).filter((s) => s && s !== 'COMPARE')
    : [];
  return {
    colour,
    widthMm: sizeMatch ? Number(sizeMatch[1]) : null,
    depthMm: sizeMatch ? Number(sizeMatch[2]) : null,
    heightMm: sizeMatch ? Number(sizeMatch[3]) : null,
    welsRegNo,
    features,
  };
}

// -- scrape ------------------------------------------------------------------

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

async function renderTiles(url) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1600, height: 1600 });
  page.on('pageerror', () => {});
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    await new Promise((r) => setTimeout(r, 5000));
    await page.evaluate(async () => { for (let y = 0; y < 9000; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } });
    await new Promise((r) => setTimeout(r, 2500));
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

async function productDetail(url) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1400, height: 1400 });
  page.on('pageerror', () => {});
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 3500));
    return await page.evaluate(() => {
      const body = document.body.innerText.replace(/\r/g, '');
      const imgs = [...document.querySelectorAll('img')]
        .map((i) => decodeURIComponent((i.currentSrc || i.src || '').replace(/^.*?url=/, '').split('&')[0]))
        .filter((s) => /backend\.harveynormancommercial/.test(s));
      const bullets = [...document.querySelectorAll('li')]
        .map((li) => li.innerText.trim().replace(/\s+/g, ' '))
        .filter((t) => t.length > 12 && t.length < 160);
      return { body: body.slice(0, 4000), imgs: [...new Set(imgs)], bullets: bullets.slice(0, 40), h1: (document.querySelector('h1') || {}).innerText || '' };
    });
  } catch { return null; } finally { await page.close(); }
}

const records = [];
const problems = [];

for (const listing of LISTINGS) {
  const seen = new Set();
  for (let pageNo = 1; pageNo <= 8; pageNo += 1) {
    const url = listing.url.replace('%P%', String(pageNo));
    const tiles = await renderTiles(url);
    const fresh = tiles.filter((t) => t.href && !seen.has(t.href));
    console.error(`[${listing.familyId}] page ${pageNo}: ${tiles.length} tiles, ${fresh.length} new`);
    if (!fresh.length) break;
    for (const t of fresh) seen.add(t.href);

    for (const t of fresh) {
      const model = (t.href.match(/\/products\/([^/?#]+)/i) || [])[1] || '';
      if (!model) { problems.push({ url: t.href, why: 'no model in url' }); continue; }
      const name = (t.alt || t.text.split(' SRP')[0] || '').trim();
      const priceMatch = t.text.match(/SRP\s*\(INC\.\s*GST\)\s*:\s*\$([\d,]+(?:\.\d{2})?)/i);
      const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;

      const detail = await productDetail(t.href);
      // Prefer an image whose filename carries this model code; never fall back
      // to another model's shot.
      const candidates = [t.img, ...(detail?.imgs || [])]
        .map((u) => u.replace(/\/cache\/[0-9a-f]+\//, '/'))
        .filter((u, i, a) => a.indexOf(u) === i);
      const exact = candidates.filter((u) => u.toLowerCase().includes(model.toLowerCase()));
      const chosen = exact[0] || (candidates.length === 1 ? candidates[0] : '');
      if (!chosen) { problems.push({ model, why: 'no image whose filename matches the model', candidates: candidates.slice(0, 3) }); continue; }

      const img = await fetchBin(chosen);
      if (!img.ok || !img.ct.startsWith('image/')) { problems.push({ model, why: `image ${img.status || img.ct}` }); continue; }
      const size = imageSize(img.body);
      if (size.w < 300 || size.h < 250) { problems.push({ model, why: `image too small ${size.w}x${size.h}` }); continue; }

      const rel = `${ASSET_DIR}/${slug(model)}${extFor(chosen, img.ct)}`;
      if (!DRY) {
        fs.mkdirSync(path.join(ROOT, 'public', path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'public', rel), img.body);
      }

      // HNC's dishwasher product pages carry no free-text marketing paragraph
      // at all (only the structured COLOUR/SIZE/FEATURES block), so any line
      // long enough to pass a generic length filter is site footer/legal
      // boilerplate, not product copy. Dishwasher descriptions are built from
      // the genuine feature bullets during catalogue integration instead.
      const blurb = listing.familyId === 'dishwashers' ? '' : (detail?.body || '').split('\n').map((l) => l.trim())
        .filter((l) => l.length > 60 && !/SRP|COMPARE|cookie|newsletter|EXCLUDING GST|STOCK LINES|PRICES MAY VARY|reserve the right/i.test(l))[0] || '';
      const features = (detail?.bullets || []).filter((b) => !/showroom|contact|delivery|warranty policy|privacy|terms/i.test(b)).slice(0, 8);
      const w = widthMm(`${name} ${t.text}`);

      const isRangehood = listing.familyId === 'rangehoods';
      const isDishwasher = listing.familyId === 'dishwashers';
      const rhText = `${name} ${t.text} ${blurb} ${features.join(' ')}`;
      const rhType = isRangehood ? rangehoodType(rhText) : '';
      const rhExtraction = isRangehood ? extractionM3H(rhText) : null;
      const rhNoise = isRangehood ? noiseDb(rhText) : null;
      const rhDucting = isRangehood ? ductingFrom(rhText) : '';

      // Dishwasher spec block: read verbatim from the product page's own
      // COLOUR / SIZE / WELS REG. NO / FEATURES fields. Nothing guessed.
      const dw = isDishwasher ? parseDishwasherDetailBody(detail?.body) : null;
      const dwType = isDishwasher ? dishwasherType(`${name} ${t.text}`) : '';
      const dwFeatures = isDishwasher ? dw.features.filter((f) => f && f.length < 160) : [];
      const dwFeatureText = dwFeatures.join(' ');
      const dwWaterLPerWash = isDishwasher
        ? Number((dwFeatureText.match(/(\d+(?:\.\d+)?)\s*L\s*\/\s*wash/i) || [])[1]) || null
        : null;
      const dwNoiseDb = isDishwasher ? Number((dwFeatureText.match(/(\d{2})\s*dB/i) || [])[1]) || null : null;
      const dwPlaceSettings = isDishwasher
        ? Number((dwFeatureText.match(/(\d+)\s*place\s*setting/i) || [])[1]) || null
        : null;
      const dwWashPrograms = isDishwasher
        ? Number((dwFeatureText.match(/(\d+)\s*wash\s*program/i) || [])[1]) || null
        : null;
      const dwHomeConnect = isDishwasher ? dwFeatures.some((f) => /home connect/i.test(f)) : false;
      const dwAquaStop = isDishwasher ? /aquastop/i.test(`${dwFeatures.join(' ')} ${detail?.body || ''}`) : false;
      const dwDrying = isDishwasher ? (dwFeatures.find((f) => /dry/i.test(f)) || '') : '';
      const dwWidth = isDishwasher ? (dw.widthMm || w) : w;
      const dwDepth = isDishwasher ? dw.depthMm : null;
      const dwHeight = isDishwasher ? dw.heightMm : null;
      const dwCompact = isDishwasher && dwWidth ? dwWidth < 600 : false;

      records.push({
        product_code: `APP-BOSCH-${slug(model).toUpperCase()}`,
        manufacturerModel: model,
        family_key: listing.familyId,
        requirement_keys: isRangehood ? 'rangehood' : isDishwasher ? 'dishwasher' : listing.familyId === 'cooktops' ? 'cooktop' : 'oven',
        category_key: isRangehood ? 'Rangehood' : isDishwasher ? 'Dishwasher' : listing.familyId === 'cooktops' ? 'Cooktop' : 'Oven',
        top_level_area: 'kitchen',
        manufacturer: 'Bosch',
        brand: 'Bosch',
        supplier: SOURCE_ORG,
        range: (name.match(/Series\s*\d+/i) || [''])[0] || '',
        product_name: `Bosch ${name}`.replace(/\s+/g, ' ').trim(),
        model,
        width: dwWidth ? `${dwWidth} mm` : '',
        widthMm: dwWidth,
        configuration: isRangehood ? rhType : isDishwasher ? dwType : listing.familyId === 'cooktops' ? cooktopType(`${name} ${t.text}`) : ovenType(`${name} ${t.text} ${blurb}`),
        fuelOrEnergyType: isRangehood ? 'Electric' : isDishwasher ? 'Electric' : listing.familyId === 'cooktops' ? cooktopType(`${name} ${t.text}`) : 'Electric',
        installationType: isDishwasher ? dwType : rhType,
        material: '',
        finish: isDishwasher ? (dw.colour || finishFrom(`${name} ${blurb}`)) : finishFrom(`${name} ${blurb}`),
        description: blurb,
        features: isDishwasher ? dwFeatures : features,
        primary_image_url: rel,
        image_source_url: chosen,
        image_source_type: 'authorised-supplier-media',
        image_source_organisation: SOURCE_ORG,
        image_status: 'verified-authorised-supplier-local',
        image_verified_at: TODAY,
        official_product_url: t.href,
        client_price: price,
        rrp: price,
        price_status: price ? 'current' : 'quote_required',
        price_unit: 'each',
        currency: 'AUD',
        regions: 'AU',
        active: 'true',
        source_type: 'authorised_supplier_listing',
        source_name: `${SOURCE_ORG} Bosch ${listing.familyId} listing`,
        source_url: t.href,
        source_verified_at: TODAY,
        attributes: {
          seriesName: (name.match(/Series\s*\d+/i) || [''])[0] || '',
          cooktopType: listing.familyId === 'cooktops' ? cooktopType(`${name} ${t.text}`) : '',
          ovenType: listing.familyId === 'ovens' ? ovenType(`${name} ${t.text} ${blurb}`) : '',
          // Rangehood specs are written only when the source published them.
          rangehoodType: rhType,
          extractionM3PerHour: rhExtraction,
          noiseDb: isDishwasher ? dwNoiseDb : rhNoise,
          ducting: rhDucting,
          widthMm: dwWidth,
          priceBasis: 'Harvey Norman Commercial SRP inc GST',
          // Dishwasher-only fields. placeSettings / washPrograms / energy &
          // water star ratings are NOT published on the HNC listing or
          // product page and are left unset rather than guessed.
          installationType: isDishwasher ? dwType : undefined,
          compact: isDishwasher ? dwCompact : undefined,
          depthMm: isDishwasher ? dwDepth : undefined,
          heightMm: isDishwasher ? dwHeight : undefined,
          colour: isDishwasher ? dw.colour : undefined,
          welsRegistrationNo: isDishwasher ? dw.welsRegNo : undefined,
          waterConsumptionLPerWash: isDishwasher ? dwWaterLPerWash : undefined,
          homeConnect: isDishwasher ? dwHomeConnect : undefined,
          aquaStop: isDishwasher ? dwAquaStop : undefined,
          dryingSystem: isDishwasher ? dwDrying : undefined,
          // Place settings / wash programs are captured only when a feature
          // bullet states them; energy & water star ratings are never
          // published on HNC's dishwasher pages (only a WELS registration
          // number), so those two stay null rather than guessed.
          placeSettings: isDishwasher ? dwPlaceSettings : undefined,
          washPrograms: isDishwasher ? dwWashPrograms : undefined,
          energyRating: isDishwasher ? null : undefined,
          waterRating: isDishwasher ? null : undefined,
        },
      });
      console.error(`  + ${listing.familyId.padEnd(9)} ${model.padEnd(14)} ${dwWidth ? `${dwWidth}mm` : '   '} ${price ? `$${price}` : 'no price'}  ${size.w}x${size.h}`);
    }
  }
}

await browser.close();

records.sort((a, b) => a.family_key.localeCompare(b.family_key) || (a.widthMm || 0) - (b.widthMm || 0) || (a.client_price ?? 1e9) - (b.client_price ?? 1e9));

// Merge, never blank. A scrape that returns nothing for a family must leave that
// family's existing rows alone; a scraped row replaces its own match by model.
function mergeWithExisting(scraped) {
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')).products || []; } catch { existing = []; }
  const keyOf = (r) => String(r.manufacturerModel || r.model || r.product_code || '').toUpperCase();
  const scrapedFamilies = new Set(scraped.map((r) => r.family_key));
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));
  for (const row of scraped) byKey.set(keyOf(row), row);
  const merged = [...byKey.values()];
  const kept = merged.filter((r) => !scrapedFamilies.has(r.family_key)).length;
  console.error(`merge: ${scraped.length} scraped, ${kept} rows kept from families not scraped, ${merged.length} total`);
  return merged;
}

const outputRecords = mergeWithExisting(records);
outputRecords.sort((a, b) => String(a.family_key).localeCompare(String(b.family_key)) || (a.widthMm || 0) - (b.widthMm || 0) || (a.client_price ?? 1e9) - (b.client_price ?? 1e9));

if (!DRY) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({
    catalogue: 'AU Bosch Appliance Range',
    generatedAt: TODAY,
    note: 'Built by scripts/product-library/import-bosch-range.mjs from the current Harvey Norman Commercial Bosch cooktop, oven and rangehood listings. Every row carries that exact model\'s own product image.',
    officialSources: ALL_LISTINGS.map((l) => ({ familyId: l.familyId, listing: l.url.replace('%P%', '1') })),
    products: outputRecords,
  }, null, 2)}\n`);
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, `${JSON.stringify({ generatedAt: TODAY, imported: records.length, problems }, null, 2)}\n`);
}

const byFamily = {};
const byType = {};
for (const r of records) {
  byFamily[r.family_key] = (byFamily[r.family_key] || 0) + 1;
  const k = `${r.family_key}:${r.configuration}:${r.widthMm || '?'}mm`;
  byType[k] = (byType[k] || 0) + 1;
}
console.log(JSON.stringify({
  imported: records.length, byFamily, byType,
  priced: records.filter((r) => r.client_price != null).length,
  unpriced: records.filter((r) => r.client_price == null).map((r) => r.model),
  problems: problems.length,
}, null, 2));
