// Targeted grab for the cooktops still showing a placeholder on
// /modules/estimate-builder?page=productLibrary&roomCategory=kitchen-cooktops
//
//   node scripts/product-library/grab-cooktops.mjs [--dry-run]
//
// Two things the earlier passes got wrong and this fixes:
//  1. WordPress serves resized derivatives (foo-300x159.png). Those failed the
//     minimum-size check and the original was never tried. Strip the -WxH suffix.
//  2. The whole-domain capture index was capped at 50k rows, so later captures
//     fell off the end. These are per-model prefix queries instead.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const DRY = process.argv.includes('--dry-run');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CHROME = /favicon|apple-touch|appletouch|sprite|logo|icon-|placeholder|spacer|pixel/i;

async function get(u, binary = false) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: binary ? 'image/*' : '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
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

// Strip a WordPress/derivative size suffix to reach the uploaded original.
function originalVariants(url) {
  const out = [url];
  const m = url.match(/^(.*?)-\d{2,4}x\d{2,4}(\.(?:jpe?g|png|webp))(\?.*)?$/i);
  if (m) out.unshift(`${m[1]}${m[2]}`);
  const scaled = url.replace(/-scaled(\.(?:jpe?g|png|webp))$/i, '$1');
  if (scaled !== url) out.push(scaled);
  return [...new Set(out)];
}

// Whole-host image capture index, cached per host.
const hostIndex = new Map();
async function imagesForHost(host) {
  if (hostIndex.has(host)) return hostIndex.get(host);
  const u = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}*&output=json`
    + '&fl=original,timestamp&filter=statuscode:200&filter=mimetype:image/.*&collapse=urlkey&limit=50000';
  // The CDX endpoint intermittently answers an empty body for a host that has
  // thousands of captures, which silently turns every lookup into a miss.
  let rows = [];
  for (let attempt = 0; attempt < 6 && !rows.length; attempt += 1) {
    const r = await get(u);
    if (r.ok && r.body) { try { rows = JSON.parse(r.body).slice(1); } catch { rows = []; } }
    if (!rows.length && attempt < 5) await new Promise((res) => setTimeout(res, 15000 * (attempt + 1)));
  }
  hostIndex.set(host, rows);
  console.error(`  [index] ${host}: ${rows.length} image captures`);
  return rows;
}

async function findCaptures(hosts, model) {
  const mc = norm(model);
  const rows = [];
  for (const host of hosts) rows.push(...(await imagesForHost(host)).filter(([u]) => norm(u).includes(mc)));
  return rows;
}

async function bestImage(candidates) {
  let best = null;
  for (const cand of candidates) {
    for (const variant of originalVariants(cand.url)) {
      const img = await get(variant, true);
      if (!img.ok || !img.ct.startsWith('image/')) continue;
      const s = imageSize(img.body);
      if (Math.max(s.w, s.h) < 380 || Math.min(s.w, s.h) < 140) continue;
      const area = s.w * s.h;
      if (!best || area > best.area) best = { src: cand.origin || variant, fetched: variant, buffer: img.body, ct: img.ct, size: s, area, via: cand.via };
      if (area >= 900 * 900) return best;
    }
  }
  return best;
}

// model -> which hosts to search, and the local folder
const TARGETS = [
  { model: 'BCG604WX', brand: 'Blanco', dir: 'blanco', hosts: ['blanco.com.au', 'harveynormancommercial.com.au', 'appliancesonline.com.au'] },
  { model: 'BCG905WX', brand: 'Blanco', dir: 'blanco', hosts: ['blanco.com.au', 'harveynormancommercial.com.au', 'appliancesonline.com.au'] },
  { model: 'ECCK900', brand: 'Euromaid', dir: 'euromaid', hosts: ['euromaid.com.au', 'harveynormancommercial.com.au', 'appliancesonline.com.au'] },
  { model: 'GC90S', brand: 'Euromaid', dir: 'euromaid', hosts: ['euromaid.com.au', 'harveynormancommercial.com.au'] },
  { model: 'OI90Z', brand: 'Omega', dir: 'omega', hosts: ['omegaappliances.com.au', 'harveynormancommercial.com.au', 'appliancesonline.com.au'] },
  { model: 'PCR6A5B90A', brand: 'Bosch', dir: 'bosch', hosts: ['bosch-home.com.au', 'harveynormancommercial.com.au'] },
];

const results = [];
for (const t of TARGETS) {
  const codes = [t.model, ...(t.alt || [])];
  let caps = [];
  for (const c of codes) {
    caps = await findCaptures(t.hosts, c);
    if (caps.length) break;
  }
  const usable = caps
    .filter(([u]) => /\.(jpe?g|png|webp)(\?|$)/i.test(u))
    .filter(([u]) => !CHROME.test(u))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 12)
    .map(([orig, ts]) => ({ url: `https://web.archive.org/web/${ts}im_/${orig}`, origin: orig, via: `archived ${ts}` }));

  const best = await bestImage(usable);
  if (!best) {
    results.push({ ...t, status: 'unresolved', captures: caps.length });
    console.error(`  unresolved   ${t.brand} ${t.model} (${caps.length} name matches, none usable)`);
    continue;
  }
  const rel = `/images/catalogues/appliances/products/${t.dir}/${t.model.toLowerCase().replace(/[^a-z0-9]+/g, '')}${extFor(best.fetched, best.ct)}`;
  if (!DRY) {
    fs.mkdirSync(path.join('public', path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join('public', rel), best.buffer);
  }
  results.push({ ...t, status: 'resolved', localPath: rel, size: `${best.size.w}x${best.size.h}`, src: best.src, via: best.via });
  console.error(`  RESOLVED     ${t.brand} ${t.model} -> ${rel} (${best.size.w}x${best.size.h}) ${best.via}`);
}

fs.writeFileSync('data/catalogue/reconciliation/COOKTOP_IMAGE_GRAB.json', `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ targets: TARGETS.length, resolved: results.filter((r) => r.status === 'resolved').length }, null, 2));
