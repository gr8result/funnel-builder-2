// Imports exact product images for internal-areas records that have none,
// from each brand's own official product page (Lockwood via lockweb.com.au,
// Porta via porta.com.au).
//
//   node scripts/product-library/import-internal-areas-images.mjs [--dry-run]
//
// Lockwood lists one page per leverset/knobset design; the Dummy / Passage /
// Privacy rows are the same physical hardware in different functions, so they
// legitimately share that design's image.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOGUE = path.join(ROOT, 'data/product-library/catalogues/internal/AU-INTERNAL-AREAS-CATALOGUE.json');
const ASSET_DIR = '/images/product-library/internal-areas';
const REPORT = path.join(ROOT, 'data/catalogue/reconciliation/INTERNAL_AREAS_IMAGE_IMPORT_REPORT.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CHECKED_AT = new Date().toISOString().slice(0, 10);
const DRY_RUN = process.argv.includes('--dry-run');

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function get(url, binary = false) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: binary ? 'image/*' : 'text/html,*/*', 'Accept-Language': 'en-AU,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, url: r.url, ct: r.headers.get('content-type') || '', body: binary ? Buffer.from(await r.arrayBuffer()) : await r.text() };
  } catch (e) { return { ok: false, status: 'ERR:' + e.name }; }
}

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
      const marker = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return { w: 0, h: 0 };
}

function extFor(url, ct) {
  const clean = String(url).split('?')[0].toLowerCase();
  for (const e of ['.webp', '.jpeg', '.jpg', '.png']) if (clean.endsWith(e)) return e === '.jpeg' ? '.jpg' : e;
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('png')) return '.png';
  return '.jpg';
}

function pageImage(html, pageUrl) {
  const dec = html.replace(/&amp;/g, '&');
  const og = dec.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || dec.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) return new URL(og[1], pageUrl).href;
  for (const m of dec.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      for (const n of Array.isArray(j) ? j : [j]) {
        const img = [].concat(n.image || [])[0];
        if (typeof img === 'string') return new URL(img, pageUrl).href;
      }
    } catch { /* ignore */ }
  }
  return '';
}

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
const rows = catalogue.products || catalogue.items || catalogue.records || catalogue;
const targets = rows.filter((r) => !r.primary_image_url);
console.error(`targets: ${targets.length}${DRY_RUN ? ' (dry run)' : ''}`);

const pageCache = new Map();
const results = [];
let imported = 0;

for (const record of targets) {
  const pageUrl = record.official_product_url || record.source_url || '';
  const row = { code: record.model || record.product_code, brand: record.brand, name: record.product_name, pageUrl };

  // Several rows already carry a resolved manufacturer asset URL that was never
  // downloaded; use it directly and only fall back to scraping the product page.
  let imageUrl = record.image_source_url || '';
  if (!imageUrl) {
    if (!pageUrl) { row.status = 'no-source'; row.reason = 'no official product URL on record'; results.push(row); continue; }
    if (!pageCache.has(pageUrl)) pageCache.set(pageUrl, await get(pageUrl));
    const page = pageCache.get(pageUrl);
    if (!page.ok) { row.status = 'unresolved'; row.reason = `page -> ${page.status}`; results.push(row); console.error(`  unresolved  ${row.code} ${row.reason}`); continue; }
    imageUrl = pageImage(page.body, page.url);
  }
  if (!imageUrl) { row.status = 'unresolved'; row.reason = 'no og:image or ld+json image on the product page'; results.push(row); console.error(`  unresolved  ${row.code} ${row.reason}`); continue; }

  const img = await get(imageUrl, true);
  if (!img.ok || !img.ct.startsWith('image/')) { row.status = 'unresolved'; row.reason = `image -> ${img.status || img.ct}`; results.push(row); console.error(`  unresolved  ${row.code} ${row.reason}`); continue; }
  const size = imageSize(img.body);
  if (size.w < 200 || size.h < 200) { row.status = 'unresolved'; row.reason = `image too small ${size.w}x${size.h}`; results.push(row); console.error(`  unresolved  ${row.code} ${row.reason}`); continue; }

  const rel = `${ASSET_DIR}/${slug(record.brand)}-${slug(record.model || record.product_code)}${extFor(imageUrl, img.ct)}`;
  row.status = 'resolved'; row.localPath = rel; row.imageUrl = imageUrl; row.size = `${size.w}x${size.h}`;
  if (!DRY_RUN) {
    const dest = path.join(ROOT, 'public', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, img.body);
    record.primary_image_url = rel;
    record.image_status = 'verified_exact';
    record.image_source_url = imageUrl;
    record.image_source_type = 'official-australian-product-page';
    record.image_verified_at = new Date().toISOString();
    record.image_attribution = `${record.brand} Australia`;
  }
  imported += 1;
  results.push(row);
  console.error(`  resolved    ${row.code} ${rel} (${row.size})`);
}

if (!DRY_RUN && imported) fs.writeFileSync(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`);
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${JSON.stringify({ checkedAt: CHECKED_AT, dryRun: DRY_RUN, targets: targets.length, imported, results }, null, 2)}\n`);
const tally = results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
console.log(JSON.stringify({ targets: targets.length, imported, tally }, null, 2));
