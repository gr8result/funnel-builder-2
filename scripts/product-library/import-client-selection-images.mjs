// The five migrated Client Selections appliances that still render no photo live
// in a .js catalogue, not a JSON one, so they are handled separately from
// import-appliance-images.mjs. Each gets an `imageFields` options object matching
// the shape the rows above them already use.
//
//   node scripts/product-library/import-client-selection-images.mjs [--dry-run]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOGUE = path.join(ROOT, 'data/product-library/catalogues/client-selections/AU-CLIENT-SELECTIONS-MIGRATED-CATALOGUE.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DRY_RUN = process.argv.includes('--dry-run');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const TARGETS = [
  { model: 'WHG644SC', brand: 'Westinghouse', dir: 'westinghouse', archiveDomain: 'westinghouse.com.au', live: 'https://www.westinghouse.com.au/cooking/cooktops/whg644sc/' },
  { model: 'WRR604SB', brand: 'Westinghouse', dir: 'westinghouse', archiveDomain: 'westinghouse.com.au', live: 'https://www.westinghouse.com.au/cooking/rangehoods/wrr604sb/' },
  { model: 'PGA75', brand: 'Smeg', dir: 'smeg', archiveDomain: 'smeg.com.au', live: 'https://www.smeg.com/au/products/PGA75' },
  { model: 'PCR6A5B90A', brand: 'Bosch', dir: 'bosch', archiveDomain: 'bosch-home.com.au', live: 'https://www.bosch-home.com.au/en/mkt-product/PCR6A5B90A' },
  { model: 'DWP66BC50A', brand: 'Bosch', dir: 'bosch', archiveDomain: 'bosch-home.com.au', live: 'https://www.bosch-home.com.au/en/mkt-product/DWP66BC50A' },
];

async function get(url, binary = false) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: binary ? 'image/*' : 'text/html,application/json,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(45000) });
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
const extFor = (u, ct) => {
  const c = String(u).split('?')[0].toLowerCase();
  for (const e of ['.webp', '.jpeg', '.jpg', '.png']) if (c.endsWith(e)) return e === '.jpeg' ? '.jpg' : e;
  return ct.includes('webp') ? '.webp' : ct.includes('png') ? '.png' : '.jpg';
};
const CHROME = /logo|icon|sprite|banner|spacer|button|arrow|nav|favicon|apple-touch|pixel|placeholder/i;
const KNOWN_BRANDS = ['ilve', 'westinghouse', 'blanco', 'euromaid', 'omega', 'smeg', 'bosch', 'chef',
  'electrolux', 'fisherpaykel', 'haier', 'samsung', 'miele', 'asko', 'technika', 'delonghi', 'artusi', 'emilia',
  'baumatic', 'whirlpool', 'kleenmaid', 'venini', 'esatto', 'inalto', 'solt', 'teka', 'elica', 'simpson', 'beko'];

// Candidate image URLs whose own filename carries the exact model code.
function modelImages(html, model, base) {
  const dec = html.replace(/&amp;/g, '&').replace(/\\u002F/gi, '/');
  const urls = [...new Set([...dec.matchAll(/https?:\/\/[^"'\s)<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s)<>]*)?/gi)].map((m) => m[0]))];
  const stem = norm(model).replace(/a$/, '');
  return urls.filter((u) => !CHROME.test(u)).filter((u) => norm(u).includes(norm(model)) || norm(u).includes(stem));
}

async function archivedAssets(domain, model) {
  const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}*&output=json`
    + '&fl=original,timestamp&filter=statuscode:200&filter=mimetype:image/.*&collapse=urlkey&limit=50000';
  const r = await get(api);
  let rows = [];
  if (r.ok) { try { rows = JSON.parse(r.body).slice(1); } catch { rows = []; } }
  const mc = norm(model);
  return rows.filter(([u]) => norm(u).includes(mc)).filter(([u]) => !CHROME.test(u))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([original, timestamp]) => ({ url: `https://web.archive.org/web/${timestamp}im_/${original}`, original, timestamp }));
}

async function best(candidates) {
  let winner = null;
  for (const c of candidates.slice(0, 10)) {
    const img = await get(c.url || c, true);
    if (!img.ok || !img.ct.startsWith('image/')) continue;
    const size = imageSize(img.body);
    if (size.w < 300 || size.h < 300) continue;
    const area = size.w * size.h;
    if (!winner || area > winner.area) winner = { src: c.url || c, original: c.original || c, timestamp: c.timestamp, buffer: img.body, ct: img.ct, size, area };
    if (area >= 800 * 800) break;
  }
  return winner;
}

const results = [];
for (const t of TARGETS) {
  const localExisting = `/images/catalogues/appliances/products/${t.dir}/${t.model.toLowerCase()}.png`;
  if (fs.existsSync(path.join(ROOT, 'public', localExisting))) {
    results.push({ ...t, status: 'already-on-disk', localPath: localExisting });
    console.error(`  already     ${t.model} ${localExisting}`);
    continue;
  }

  let winner = null;
  let via = '';
  const live = await get(t.live);
  if (live.ok) {
    winner = await best(modelImages(live.body, t.model, live.url));
    if (winner) via = `official page ${t.live}`;
  }
  if (!winner) {
    const arch = await archivedAssets(t.archiveDomain, t.model);
    winner = await best(arch);
    if (winner) via = `archived ${t.archiveDomain} asset ${winner.timestamp}`;
  }
  if (!winner) {
    // Authorised AU resellers, via the archive. Reject any path naming a
    // different manufacturer - a short model code matches across brands.
    for (const domain of ['harveynormancommercial.com.au', 'appliancesonline.com.au']) {
      const arch = (await archivedAssets(domain, t.model))
        .filter((c) => {
          const n = norm(c.original);
          const own = norm(t.brand);
          const other = KNOWN_BRANDS.find((b) => b !== own && n.includes(b));
          return !other || n.includes(own);
        });
      winner = await best(arch);
      if (winner) { via = `archived ${domain} product image ${winner.timestamp}`; break; }
    }
  }
  if (!winner) {
    results.push({ ...t, status: 'unresolved' });
    console.error(`  unresolved  ${t.model} — no exact-model image on the live or archived manufacturer site`);
    continue;
  }

  const rel = `/images/catalogues/appliances/products/${t.dir}/${t.model.toLowerCase()}${extFor(winner.src, winner.ct)}`;
  if (!DRY_RUN) {
    const dest = path.join(ROOT, 'public', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, winner.buffer);
  }
  results.push({ ...t, status: 'resolved', localPath: rel, imageUrl: winner.original, via, size: `${winner.size.w}x${winner.size.h}` });
  console.error(`  resolved    ${t.model} ${rel} (${winner.size.w}x${winner.size.h}) via ${via}`);
}

// Attach an options object to each migratedOption(...) row that resolved.
if (!DRY_RUN) {
  let source = fs.readFileSync(CATALOGUE, 'utf8');
  let patched = 0;
  for (const r of results.filter((x) => x.localPath)) {
    const re = new RegExp(`(migratedOption\\("(?:cooktop|rangehood)", "${r.brand}",[^\\n]*?"${r.model}"[^\\n]*?ROOM_GROUPS\\.kitchen)\\)`, 'g');
    if (!re.test(source)) { console.error(`  ! could not locate row for ${r.model}`); continue; }
    re.lastIndex = 0;
    source = source.replace(re, (_m, head) => `${head}, {
    primaryImageUrl: "${r.localPath}",
    thumbnailUrl: "${r.localPath}",
    imageSourceUrl: "${r.imageUrl || ''}",
    imageSourceType: "official-australian-manufacturer-local",
    officialProductUrl: "${r.live}",
    imageAttribution: "Product image sourced from ${r.brand} Australia official ${r.model} product imagery${r.via && r.via.startsWith('archived') ? ' (archived capture)' : ''}.",
  })`);
    patched += 1;
  }
  fs.writeFileSync(CATALOGUE, source);
  console.error(`  patched ${patched} catalogue rows`);
}

console.log(JSON.stringify({ targets: TARGETS.length, resolved: results.filter((r) => r.status === 'resolved').length, results: results.map((r) => ({ model: r.model, status: r.status, localPath: r.localPath, via: r.via, size: r.size })) }, null, 2));
