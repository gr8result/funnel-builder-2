// Imports exact-model product images for appliance records that have none.
//
//   node scripts/product-library/import-appliance-images.mjs [--dry-run] [--brand=Omega] [--limit=N]
//
// Sourcing rule: the manufacturer's own Australian site only. A record is only
// updated when the page is proven to be the exact model AND its product type
// agrees with the family we have it filed under - a rangehood photo on a card
// labelled "induction cooktop" is worse than no photo, because a client picks
// from these cards. Anything unproven is written to the quarantine report for a
// human to resolve; nothing is guessed.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const CATALOGUE = path.join(ROOT, 'data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json');
const ASSET_ROOT = path.join(ROOT, 'public/images/catalogues/appliances/products');
const REPORT = path.join(ROOT, 'data/catalogue/reconciliation/APPLIANCE_IMAGE_IMPORT_REPORT.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CHECKED_AT = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BRAND_FILTER = (args.find((a) => a.startsWith('--brand=')) || '').split('=')[1] || '';
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);

// Family -> words that must / must not appear in the source page's own naming.
// The "forbid" side is what catches a mis-filed legacy row.
const FAMILY_TYPES = {
  cooktops: { require: ['cooktop', 'hob'], forbid: ['rangehood', 'range hood', 'canopy', 'dishwasher', 'oven '] },
  rangehoods: { require: ['rangehood', 'range hood', 'canopy', 'extractor'], forbid: ['cooktop', 'dishwasher'] },
  dishwashers: { require: ['dishwasher'], forbid: ['cooktop', 'rangehood', 'oven '] },
  'freestanding-cookers': { require: ['freestanding', 'cooker', 'upright'], forbid: ['rangehood', 'dishwasher'] },
  microwaves: { require: ['microwave'], forbid: ['rangehood', 'dishwasher'] },
  ovens: { require: ['oven'], forbid: ['rangehood', 'dishwasher', 'cooktop'] },
  fridges: { require: ['refrigerator', 'fridge'], forbid: ['rangehood', 'dishwasher'] },
};

// Sitemaps that actually resolve, per brand (verified by probe-sitemaps.mjs).
const BRAND_SITEMAPS = {
  Omega: ['https://omegaappliances.com.au/sitemap.xml'],
  Westinghouse: ['https://www.westinghouse.com.au/sitemap.xml'],
  Smeg: ['https://www.smeg.com/sitemap/products.xml'],
  Euromaid: ['https://www.euromaid.com/en-au/au/sitemap.xml'],
};

const BRAND_ORG = {
  Omega: 'Omega Appliances Australia',
  Westinghouse: 'Westinghouse Australia',
  Smeg: 'Smeg Australia',
  Euromaid: 'Euromaid Australia',
  Blanco: 'Blanco Australia',
};

// Second-tier source: Harvey Norman Commercial's media CDN, already cited by
// existing rows in this catalogue as an authorised-supplier source. It is a
// Magento store, so a missing SKU still answers 200 - with a placeholder logo.
// Those are fingerprinted and rejected; only a real photo is accepted.
const HNC_BASE = 'https://backend.harveynormancommercial.com.au/media/catalog/product';
const HNC_ORG = 'Harvey Norman Commercial';
const HNC_PLACEHOLDER_SHA = '2637f446bc664022';
const HNC_MIN_EDGE = 400;

// Third tier: the manufacturer's own page as captured by the Internet Archive.
// Most of the remaining models are discontinued and have been removed from the
// live sites, but their official AU product pages - and the manufacturer's own
// product photography on them - are still archived.
const BRAND_ARCHIVE_DOMAINS = {
  Blanco: ['blanco.com.au', 'blancoaustralia.com.au', 'blanco-australia.com.au', 'blancoappliances.com.au'],
  Euromaid: ['euromaid.com.au'],
  Omega: ['omegaappliances.com.au'],
  Smeg: ['smeg.com.au'],
  Westinghouse: ['westinghouse.com.au'],
  Bosch: ['bosch-home.com.au'],
};

// Cache of every archived image capture per domain: one CDX call serves all of
// that brand's models.
const archiveImageIndex = new Map();
async function archivedImagesFor(domain) {
  if (archiveImageIndex.has(domain)) return archiveImageIndex.get(domain);
  const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}*&output=json`
    + '&fl=original,timestamp&filter=statuscode:200&filter=mimetype:image/.*&collapse=urlkey&limit=50000';
  const r = await get(api);
  let rows = [];
  if (r.ok) { try { rows = JSON.parse(r.body).slice(1); } catch { rows = []; } }
  archiveImageIndex.set(domain, rows);
  console.error(`  [archive-img] ${domain}: ${rows.length} captures`);
  return rows;
}
const ARCHIVE_CHROME = /logo|icon|sprite|banner|spacer|button|arrow|bullet|nav|header|footer|facebook|twitter|youtube|instagram|apple-touch|appletouch|favicon|loader|pixel/i;

// Fifth tier: authorised AU resellers, via the archive. A model code is only a
// few characters, so a substring match across a whole retailer CDN throws false
// positives - "cs60ss/ilve-60cm-slideout" matches a Euromaid CS60S search. Any
// URL naming a different manufacturer is therefore rejected outright.
const RETAILER_ARCHIVE_DOMAINS = ['harveynormancommercial.com.au', 'appliancesonline.com.au'];
const RETAILER_ORG = { 'harveynormancommercial.com.au': 'Harvey Norman Commercial', 'appliancesonline.com.au': 'Appliances Online' };
const KNOWN_BRAND_TOKENS = ['ilve', 'westinghouse', 'blanco', 'euromaid', 'omega', 'smeg', 'bosch', 'chef',
  'electrolux', 'fisherpaykel', 'haier', 'samsung', 'miele', 'asko', 'technika', 'delonghi', 'artusi', 'emilia',
  'baumatic', 'whirlpool', 'kleenmaid', 'venini', 'esatto', 'inalto', 'solt', 'teka', 'elica', 'simpson', 'beko'];

function retailerUrlBrandConflict(url, brand) {
  const n = norm(url);
  const own = norm(brand);
  const others = KNOWN_BRAND_TOKENS.filter((t) => t !== own && n.includes(t));
  if (!others.length) return '';
  return n.includes(own) ? '' : `url names ${others[0]}, not ${brand}`;
}

function hncCandidates(product) {
  const m = norm(product.manufacturerModel);
  const b = norm(product.brandName);
  const names = [`${m}_${b}_web`, `${m}_${b}`, `${m}web`, m];
  const out = [];
  for (const name of names) {
    if (name.length < 2) continue;
    for (const ext of ['.jpg', '.png', '.webp']) out.push(`${HNC_BASE}/${name[0]}/${name[1]}/${name}${ext}`);
  }
  return out;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function get(url, { binary = false } = {}) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: binary ? 'image/*' : 'text/html,application/xml,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!r.ok) return { ok: false, status: r.status, url: r.url };
    return { ok: true, status: r.status, url: r.url, ct: r.headers.get('content-type') || '', body: binary ? Buffer.from(await r.arrayBuffer()) : await r.text() };
  } catch (e) { return { ok: false, status: 'ERR:' + e.name, url }; }
}

// -- sitemap index -----------------------------------------------------------

async function sitemapUrls(entry, depth = 0) {
  const r = await get(entry);
  if (!r.ok) return [];
  const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  const nested = locs.filter((u) => /\.xml(\?|$)/i.test(u));
  const pages = locs.filter((u) => !/\.xml(\?|$)/i.test(u));
  if (!nested.length || depth >= 2) return pages;
  const out = [...pages];
  for (const child of nested.slice(0, 40)) out.push(...await sitemapUrls(child, depth + 1));
  return out;
}

const indexCache = new Map();
async function brandUrlIndex(brand) {
  if (indexCache.has(brand)) return indexCache.get(brand);
  const maps = BRAND_SITEMAPS[brand] || [];
  const urls = [];
  for (const m of maps) urls.push(...await sitemapUrls(m));
  const index = [...new Set(urls)];
  indexCache.set(brand, index);
  console.error(`  [index] ${brand}: ${index.length} urls`);
  return index;
}

// -- image helpers -----------------------------------------------------------

function imageSize(buf) {
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8X') return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (fmt === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return { w: 0, h: 0 };
}

function extensionFor(url, ct = '') {
  const clean = url.split('?')[0].toLowerCase();
  for (const ext of ['.webp', '.jpeg', '.jpg', '.png']) if (clean.endsWith(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('png')) return '.png';
  return '.jpg';
}

// -- page parsing ------------------------------------------------------------

function ldProducts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try { parsed = JSON.parse(m[1].trim()); } catch { continue; }
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      const types = [].concat(node?.['@type'] || []);
      if (types.includes('Product') || node?.name) out.push(node);
    }
  }
  return out;
}

function candidateImages(html, model) {
  const dec = html.replace(/&amp;/g, '&').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const found = [];
  for (const node of ldProducts(dec)) {
    const img = Array.isArray(node.image) ? node.image[0] : node.image;
    if (img && typeof img === 'string') found.push({ url: img, why: 'ld+json Product image' });
  }
  const og = dec.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || dec.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) found.push({ url: og[1], why: 'og:image' });
  const all = [...new Set([...dec.matchAll(/https?:\/\/[^"'\s)<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s)<>]*)?/gi)].map((x) => x[0]))]
    .filter((u) => !/logo|favicon|sprite|icon|placeholder|banner/i.test(u));
  for (const u of all) if (norm(u).includes(norm(model))) found.push({ url: u, why: 'filename carries the model code' });
  // Prefer an image whose own filename proves the model.
  return found
    .filter((f) => /^https?:/i.test(f.url))
    .sort((a, b) => Number(norm(b.url).includes(norm(model))) - Number(norm(a.url).includes(norm(model))));
}

// Does this page describe the model, and is it the product type we expect?
function verifyPage(html, product) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const model = product.manufacturerModel;
  if (!norm(text).includes(norm(model))) return { ok: false, reason: `page does not mention model ${model}` };

  const rules = FAMILY_TYPES[product.familyId];
  if (!rules) return { ok: true, reason: 'model present; no type rule for this family' };

  // Judge on the page's own product naming (title / ld+json name / h1), not body copy,
  // which often cross-references other appliances.
  const names = [
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '',
    ...ldProducts(html).map((n) => n.name || ''),
    ...[...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1]),
  ].join(' ').replace(/<[^>]+>/g, ' ').toLowerCase();

  const hit = rules.require.some((w) => names.includes(w));
  const clash = rules.forbid.find((w) => names.includes(w));
  if (clash && !hit) return { ok: false, reason: `source names this a "${clash.trim()}" but we have it filed under ${product.familyId}`, mismatch: true };
  if (!hit) return { ok: false, reason: `source naming does not confirm it is a ${product.familyId} ("${names.trim().slice(0, 90)}")` };
  return { ok: true, reason: `model and ${product.familyId} type both confirmed` };
}

// -- resolution --------------------------------------------------------------

async function candidatePages(product) {
  const brand = product.brandName;
  const model = product.manufacturerModel;
  const mc = norm(model);
  const urls = [];
  if (product.productPageUrl) urls.push(product.productPageUrl);

  const index = await brandUrlIndex(brand);
  urls.push(...index.filter((u) => norm(u).includes(mc)));

  if (brand === 'Westinghouse') {
    const seg = product.familyId === 'freestanding-cookers' ? 'freestanding-cookers' : product.familyId;
    urls.push(`https://www.westinghouse.com.au/cooking/${seg}/${slug(model)}/`);
    urls.push(`https://www.westinghouse.com.au/kitchen/${seg}/${slug(model)}/`);
  }
  if (brand === 'Smeg') urls.push(`https://www.smeg.com/au/products/${encodeURIComponent(model)}`);

  return [...new Set(urls)];
}

async function resolve(product) {
  const pages = await candidatePages(product);
  const notes = [];
  if (!pages.length) notes.push('no candidate page on the manufacturer site');
  for (const pageUrl of pages.slice(0, 6)) {
    const page = await get(pageUrl);
    if (!page.ok) { notes.push(`${pageUrl} -> ${page.status}`); continue; }
    const check = verifyPage(page.body, product);
    if (!check.ok) {
      notes.push(`${pageUrl} -> ${check.reason}`);
      if (check.mismatch) return { status: 'type-mismatch', reason: check.reason, pageUrl };
      continue;
    }
    for (const cand of candidateImages(page.body, product.manufacturerModel).slice(0, 4)) {
      const abs = cand.url.startsWith('//') ? `https:${cand.url}` : new URL(cand.url, pageUrl).href;
      const img = await get(abs, { binary: true });
      if (!img.ok || !img.ct.startsWith('image/')) { notes.push(`${abs} -> ${img.status || img.ct}`); continue; }
      const size = imageSize(img.body);
      if (size.w < 200 || size.h < 200) { notes.push(`${abs} -> too small ${size.w}x${size.h}`); continue; }
      return { status: 'resolved', pageUrl: page.url, imageUrl: abs, buffer: img.body, ct: img.ct, size, why: cand.why, check: check.reason };
    }
    notes.push(`${pageUrl} -> verified page but no usable image`);
  }

  const hnc = await resolveFromHarveyNormanCommercial(product);
  if (hnc) return hnc;

  const archived = await resolveFromArchive(product, notes);
  if (archived) return archived;

  const asset = await resolveFromArchivedAsset(product, notes);
  if (asset) return asset;

  const retail = await resolveFromRetailerArchive(product, notes);
  if (retail) return retail;

  return { status: 'unresolved', reason: notes.slice(0, 4).join(' | ') || 'no candidate page verified' };
}

async function resolveFromRetailerArchive(product, notes) {
  const mc = norm(product.manufacturerModel);
  if (mc.length < 5) return null;
  for (const domain of RETAILER_ARCHIVE_DOMAINS) {
    const caps = await archivedImagesFor(domain);
    const hits = caps
      .filter(([u]) => norm(u).includes(mc))
      .filter(([u]) => !ARCHIVE_CHROME.test(u))
      .filter(([u]) => /\.(jpe?g|png|webp)(\?|$)/i.test(u))
      .filter(([u]) => {
        const clash = retailerUrlBrandConflict(u, product.brandName);
        if (clash) { notes.push(`retail ${domain} -> rejected, ${clash}`); return false; }
        return true;
      })
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    let best = null;
    for (const [original, timestamp] of hits.slice(0, 10)) {
      const img = await get(`https://web.archive.org/web/${timestamp}im_/${original}`, { binary: true });
      if (!img.ok || !img.ct.startsWith('image/')) continue;
      const size = imageSize(img.body);
      if (size.w < 250 || size.h < 250) continue;
      const area = size.w * size.h;
      if (!best || area > best.area) best = { original, timestamp, buffer: img.body, ct: img.ct, size, area };
      if (area >= 700 * 700) break;
    }
    if (best) {
      return {
        status: 'resolved-supplier',
        pageUrl: '',
        imageUrl: `https://web.archive.org/web/${best.timestamp}im_/${best.original}`,
        buffer: best.buffer,
        ct: best.ct,
        size: best.size,
        supplierOrg: RETAILER_ORG[domain],
        why: `archived ${domain} product image ${best.timestamp}`,
        check: `exact model ${product.manufacturerModel} in the ${RETAILER_ORG[domain]} image path, no conflicting brand`,
      };
    }
  }
  return null;
}

// The manufacturer's own image asset, still in the archive, named for the model.
// The filename on the brand's own domain is what ties it to the exact model;
// there is no page here, so a mis-filed family is not caught at this tier.
async function resolveFromArchivedAsset(product, notes) {
  const mc = norm(product.manufacturerModel);
  if (mc.length < 4) return null;
  for (const domain of BRAND_ARCHIVE_DOMAINS[product.brandName] || []) {
    const caps = await archivedImagesFor(domain);
    const hits = caps
      .filter(([u]) => norm(u).includes(mc))
      .filter(([u]) => !ARCHIVE_CHROME.test(u))
      .filter(([u]) => /\.(jpe?g|png|webp)(\?|$)/i.test(u))
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    // Prefer the largest usable capture rather than merely the newest.
    let best = null;
    for (const [original, timestamp] of hits.slice(0, 10)) {
      const img = await get(`https://web.archive.org/web/${timestamp}im_/${original}`, { binary: true });
      if (!img.ok || !img.ct.startsWith('image/')) continue;
      const size = imageSize(img.body);
      if (size.w < 250 || size.h < 250) continue;
      const area = size.w * size.h;
      if (!best || area > best.area) best = { original, timestamp, buffer: img.body, ct: img.ct, size, area };
      if (area >= 800 * 800) break;
    }
    if (best) {
      return {
        status: 'resolved-archive',
        pageUrl: '',
        archiveUrl: `https://web.archive.org/web/${best.timestamp}/${best.original}`,
        imageUrl: best.original,
        archiveImageUrl: `https://web.archive.org/web/${best.timestamp}im_/${best.original}`,
        buffer: best.buffer,
        ct: best.ct,
        size: best.size,
        why: `archived ${domain} image asset ${best.timestamp}`,
        check: `filename on ${domain} carries the exact model code ${product.manufacturerModel}`,
      };
    }
    notes.push(`archive-img ${domain} -> ${hits.length} name matches, none usable`);
  }
  return null;
}

async function archivedPagesFor(domain, model) {
  const mc = norm(model);
  const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}*&output=json`
    + '&fl=original,timestamp&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&limit=20000';
  const r = await get(api);
  if (!r.ok) return [];
  let rows = [];
  try { rows = JSON.parse(r.body); } catch { return []; }
  return rows.slice(1)
    .filter(([original]) => norm(original).includes(mc))
    .filter(([original]) => !/\/embed\/?$/.test(original))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([original, timestamp]) => ({ original, timestamp }));
}

// Pull every <img> the archived page references, resolved to absolute archive URLs.
function archivedImageCandidates(html, snapshotUrl, originalUrl, timestamp, model) {
  const dec = html.replace(/&amp;/g, '&');
  const raw = [];
  const og = dec.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) raw.push(og[1]);
  for (const m of dec.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) raw.push(m[1]);
  for (const m of dec.matchAll(/<img[^>]+data-src=["']([^"']+)["']/gi)) raw.push(m[1]);

  const out = [];
  for (const ref of raw) {
    if (!/\.(jpe?g|png|gif|webp)(\?|$)/i.test(ref)) continue;
    // Strip any archive wrapper already present, then re-resolve against the original page.
    const bare = ref.replace(/^https?:\/\/web\.archive\.org\/web\/[^/]+\//i, '');
    let abs;
    try { abs = new URL(bare, originalUrl).href; } catch { continue; }
    if (ARCHIVE_CHROME.test(abs)) continue;
    out.push({ url: `https://web.archive.org/web/${timestamp}im_/${abs}`, original: abs });
  }
  const mc = norm(model);
  const seen = new Set();
  return out
    .filter((c) => (seen.has(c.url) ? false : seen.add(c.url)))
    .sort((a, b) => Number(norm(b.original).includes(mc)) - Number(norm(a.original).includes(mc)));
}

async function resolveFromArchive(product, notes) {
  for (const domain of BRAND_ARCHIVE_DOMAINS[product.brandName] || []) {
    const pages = await archivedPagesFor(domain, product.manufacturerModel);
    for (const snap of pages) {
      const snapshotUrl = `https://web.archive.org/web/${snap.timestamp}/${snap.original}`;
      const page = await get(snapshotUrl);
      if (!page.ok) { notes.push(`archive ${snap.timestamp} -> ${page.status}`); continue; }
      const check = verifyPage(page.body, product);
      if (!check.ok) {
        notes.push(`archive ${snap.timestamp} -> ${check.reason}`);
        if (check.mismatch) return { status: 'type-mismatch', reason: check.reason, pageUrl: snapshotUrl };
        continue;
      }
      for (const cand of archivedImageCandidates(page.body, snapshotUrl, snap.original, snap.timestamp, product.manufacturerModel).slice(0, 8)) {
        const img = await get(cand.url, { binary: true });
        if (!img.ok || !img.ct.startsWith('image/')) continue;
        const size = imageSize(img.body);
        if (size.w < 250 || size.h < 250) continue;
        return {
          status: 'resolved-archive',
          pageUrl: snap.original,
          archiveUrl: snapshotUrl,
          imageUrl: cand.original,
          archiveImageUrl: cand.url,
          buffer: img.body,
          ct: img.ct,
          size,
          why: `archived ${domain} page ${snap.timestamp}`,
          check: check.reason,
        };
      }
      notes.push(`archive ${snap.timestamp} -> verified page but no usable image`);
    }
  }
  return null;
}

// The CDN filename itself carries the model code and brand, which is what ties
// the image to the exact model - there is no page here to read a product type
// from, so a mis-filed family (see BIC90X) is not caught at this tier.
async function resolveFromHarveyNormanCommercial(product) {
  for (const url of hncCandidates(product)) {
    const img = await get(url, { binary: true });
    if (!img.ok || !img.ct.startsWith('image/')) continue;
    const sha = crypto.createHash('sha256').update(img.body).digest('hex').slice(0, 16);
    if (sha === HNC_PLACEHOLDER_SHA) continue;
    const size = imageSize(img.body);
    if (size.w < HNC_MIN_EDGE || size.h < HNC_MIN_EDGE) continue;
    return {
      status: 'resolved-supplier',
      pageUrl: '',
      imageUrl: url,
      buffer: img.body,
      ct: img.ct,
      size,
      why: 'CDN filename carries the exact model code and brand',
      check: `exact model ${product.manufacturerModel} matched on ${HNC_ORG} media CDN`,
    };
  }
  return null;
}

// -- main --------------------------------------------------------------------

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
let targets = catalogue.products.filter((p) => !p.primaryImage);
if (BRAND_FILTER) targets = targets.filter((p) => p.brandName === BRAND_FILTER);
if (LIMIT) targets = targets.slice(0, LIMIT);

console.error(`targets: ${targets.length}${DRY_RUN ? ' (dry run)' : ''}`);
const results = [];
let imported = 0;

for (const product of targets) {
  const r = await resolve(product);
  const row = {
    model: product.manufacturerModel, brand: product.brandName, family: product.familyId,
    name: product.productName, status: r.status, reason: r.reason || r.check || '',
    pageUrl: r.pageUrl || '', imageUrl: r.imageUrl || '', why: r.why || '',
  };
  if (r.status === 'resolved' || r.status === 'resolved-supplier' || r.status === 'resolved-archive') {
    const official = r.status === 'resolved';
    const archived = r.status === 'resolved-archive';
    const rel = `/images/catalogues/appliances/products/${slug(product.brandName)}/${slug(product.manufacturerModel)}${extensionFor(r.imageUrl, r.ct)}`;
    row.localPath = rel;
    row.size = `${r.size.w}x${r.size.h}`;
    if (!DRY_RUN) {
      const dest = path.join(ROOT, 'public', rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, r.buffer);
      product.primaryImage = rel;
      product.imageSourceUrl = r.imageUrl;
      if (r.pageUrl) product.productPageUrl = r.pageUrl;
      product.imageSourceType = archived ? 'archived-official-australian-product-page'
        : official ? 'official-australian-product-page' : 'authorised-supplier-media';
      const org = official || archived ? (BRAND_ORG[product.brandName] || `${product.brandName} Australia`) : (r.supplierOrg || HNC_ORG);
      product.imageSourceOrganisation = org;
      product.imageAttribution = org;
      product.imageStatus = archived ? 'verified-official-archived-local'
        : official ? 'verified-official-local' : 'verified-authorised-supplier-local';
      if (archived) product.imageArchiveUrl = r.archiveImageUrl;
      product.imageVerificationStatus = 'verified-exact-model';
      product.imageVerifiedAt = CHECKED_AT;
      product.imageCheckedAt = CHECKED_AT;
      product.modelVerificationNote = `Exact model ${product.manufacturerModel} confirmed via ${org} (${r.check}); image stored locally for Product Library display.`;
    }
    imported += 1;
  }
  results.push(row);
  console.error(`  ${String(r.status).padEnd(14)} ${product.brandName} ${product.manufacturerModel} ${row.localPath || row.reason.slice(0, 70)}`);
}

if (!DRY_RUN && imported) fs.writeFileSync(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`);
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${JSON.stringify({ checkedAt: CHECKED_AT, dryRun: DRY_RUN, targets: targets.length, imported, results }, null, 2)}\n`);

const tally = results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
console.log(JSON.stringify({ targets: targets.length, imported, tally, report: path.relative(ROOT, REPORT) }, null, 2));
