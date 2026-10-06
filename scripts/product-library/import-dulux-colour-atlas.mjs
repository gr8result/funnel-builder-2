import fs from 'node:fs/promises';

// Completes the Dulux colour library from dulux.com.au. The consumer family pages
// (import-residential-services.mjs) list about 1,100 colours; the full Dulux range is published
// one page per colour under /specifier/colour/<atlas page>/<colour>/ and listed in the sitemap.
// Every stored value is read from a Dulux page. Nothing is invented, and a colour whose page
// cannot be read is reported in IMPORT-FAILURES-dulux-atlas.json and left out.
//
// Usage: node scripts/product-library/import-dulux-colour-atlas.mjs [--limit=N]
// Resumable: progress is kept in tmp/residential-catalogue/dulux-atlas-progress.json.
const dir = 'data/product-library/catalogues/residential';
const progressFile = 'tmp/residential-catalogue/dulux-atlas-progress.json';
const origin = 'https://www.dulux.com.au';
const families = ['whites-and-neutrals', 'greys', 'browns', 'blues', 'greens', 'yellows', 'oranges', 'reds', 'purples'];
const limit = Number(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || Infinity);
const now = new Date().toISOString();
const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
await fs.mkdir('tmp/residential-catalogue', { recursive: true });

async function get(url, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }
}
function walk(value, visit) { if (!value || typeof value !== 'object') return; visit(value); for (const child of Object.values(value)) walk(child, visit); }
function nextObjects(html) {
  let stream = '';
  for (const match of html.matchAll(/self\.__next_f.push\((.*?)\);?<\/script>/gs)) { try { const chunk = JSON.parse(match[1]); if (typeof chunk[1] === 'string') stream += chunk[1]; } catch {} }
  const out = [];
  for (const match of stream.matchAll(/[0-9a-f]+:([\[{])/g)) {
    const start = match.index + match[0].length - 1;
    let depth = 0, quoted = false, escaped = false;
    for (let index = start; index < stream.length; index++) {
      const char = stream[index];
      if (escaped) { escaped = false; continue; }
      if (quoted && char === '\\') { escaped = true; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (quoted) continue;
      if (char === '[' || char === '{') depth++;
      if (char === ']' || char === '}') depth--;
      if (!depth) { try { out.push(JSON.parse(stream.slice(start, index + 1))); } catch {} break; }
    }
  }
  return out;
}
const slugPath = slug => String(slug || '').replace(/\/+$/, '');
// Every colour record a Dulux page carries: the page's own colour and the colours it links to.
function coloursIn(html) {
  const found = [];
  for (const root of nextObjects(html)) walk(root, item => {
    if (!item.title || !item.colourCode || !item.colour || !item.slug || !/^#[0-9a-f]{6}$/i.test(item.hex || '')) return;
    found.push({ externalProductId: item.colourCode, name: item.title, code: item.colour.specifierNumber || '', hex: item.hex.toLowerCase(),
      lrv: item.colour.lrv ?? null, description: item.colour.description || '', path: slugPath(item.slug) });
  });
  return found;
}

const catalogue = JSON.parse(await fs.readFile(`${dir}/AU-DULUX-COLOURS.json`, 'utf8'));
const byId = new Map(catalogue.colours.map(colour => [colour.externalProductId, colour]));
const failures = [];

// 1. Family membership. A colour can sit in two Dulux families (98 whites, 32 of them also greys or
//    browns); the first import kept only the last family it met.
const membership = new Map();
for (const family of families) {
  try {
    const html = await get(`${origin}/colour/${family}/`);
    for (const colour of coloursIn(html)) {
      if (!colour.path.startsWith(`/colour/${family}/`) && !byId.has(colour.externalProductId)) continue;
      if (!membership.has(colour.externalProductId)) membership.set(colour.externalProductId, new Set());
      membership.get(colour.externalProductId).add(family);
    }
    console.log('family', family, [...membership.values()].filter(set => set.has(family)).length);
  } catch (error) { failures.push({ source: `/colour/${family}/`, error: error.message }); }
}

// 2. Dulux's own "Australia's favourite white paint colours" page. Popular = the whites that page
//    links to; the page names them, so nothing here is a judgement made by this import.
const popularUrl = `${origin}/colour/whites-and-neutrals/popular-whites/`;
const popularSlugs = new Set();
try { for (const match of (await get(popularUrl)).matchAll(/\/colour\/whites-and-neutrals\/([a-z0-9-]+)/g)) if (match[1] !== 'popular-whites') popularSlugs.add(match[1]); }
catch (error) { failures.push({ source: 'popular-whites', error: error.message }); }
const slugOf = colour => String(colour.sourceUrl || '').replace(/\/+$/, '').split('/').pop();
const popular = new Set(catalogue.colours.filter(colour => popularSlugs.has(slugOf(colour)) && membership.get(colour.externalProductId)?.has('whites-and-neutrals')).map(colour => colour.externalProductId));
console.log('popular whites', popular.size, 'of', popularSlugs.size, 'linked');

// 3. The full range, one page per colour.
const sitemap = await get(`${origin}/sitemap.xml`);
const atlasUrls = [...sitemap.matchAll(/<loc>(https:\/\/www\.dulux\.com\.au\/specifier\/colour\/([a-z0-9-]+)\/[a-z0-9-]+\/)<\/loc>/g)].map(match => ({ url: match[1], collection: match[2], path: slugPath(new URL(match[1]).pathname) }));
console.log('atlas colour pages listed', atlasUrls.length);
let progress = {};
try { progress = JSON.parse(await fs.readFile(progressFile, 'utf8')); } catch {}
const atlas = new Map(Object.entries(progress.atlas || {}));   // path -> record
const fetched = new Set(progress.fetched || []);
const pending = atlasUrls.filter(item => !atlas.has(item.path) && !fetched.has(item.path)).slice(0, limit);
console.log('already known', atlas.size, 'to fetch (at most)', pending.length);
let done = 0;
async function worker() {
  for (;;) {
    const item = pending.shift();
    if (!item) return;
    // A page already read may have carried this colour as a linked colour.
    if (atlas.has(item.path)) continue;
    try {
      const colours = coloursIn(await get(item.url));
      for (const colour of colours) if (colour.path.startsWith('/specifier/colour/') && !atlas.has(colour.path)) atlas.set(colour.path, colour);
      if (!atlas.has(item.path)) failures.push({ source: item.url, error: 'No colour record on the page' });
    } catch (error) { failures.push({ source: item.url, error: error.message }); }
    fetched.add(item.path);
    if (++done % 50 === 0) {
      console.log('fetched', done, 'known', atlas.size, 'remaining', pending.length);
      await fs.writeFile(progressFile, JSON.stringify({ atlas: Object.fromEntries(atlas), fetched: [...fetched] }));
    }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
await fs.writeFile(progressFile, JSON.stringify({ atlas: Object.fromEntries(atlas), fetched: [...fetched] }));

// 4. Merge. Existing records keep their id and fields; atlas data only adds to them.
const listed = new Map(atlasUrls.map(item => [item.path, item]));
let added = 0;
for (const [path, colour] of atlas) {
  const source = listed.get(path);
  if (!source) continue;   // linked colour that Dulux does not list as a current page
  const existing = byId.get(colour.externalProductId);
  if (existing) { existing.collection = source.collection; existing.specifierUrl = source.url; if (!existing.code) existing.code = colour.code; continue; }
  if (!colour.code) { failures.push({ source: source.url, error: 'No Dulux colour code published' }); continue; }
  const record = { id: `dulux-${colour.externalProductId}`, manufacturer: 'Dulux', name: colour.name, code: colour.code, externalProductId: colour.externalProductId,
    family: '', families: [], collection: source.collection, hex: colour.hex, lrv: colour.lrv, description: colour.description,
    sourceUrl: source.url, specifierUrl: source.url, sourceCategoryUrl: `${origin}/specifier/colour/${source.collection}/`,
    lastImportedAt: now, lastCheckedAt: now, isPopular: false, isBuilderStandard: false, displayPriority: 100 };
  byId.set(record.externalProductId, record); catalogue.colours.push(record); added++;
}
for (const colour of catalogue.colours) {
  const sourced = membership.get(colour.externalProductId);
  if (sourced?.size) colour.families = families.filter(family => sourced.has(family));
  else if (!colour.families) colour.families = colour.family ? [colour.family] : [];
  if (popular.size) { colour.isPopular = popular.has(colour.externalProductId); if (colour.isPopular) colour.popularSourceUrl = popularUrl; else delete colour.popularSourceUrl; }
}
catalogue.atlasImportedAt = now;
await fs.writeFile(`${dir}/AU-DULUX-COLOURS.json`, JSON.stringify(catalogue, null, 2) + '\n');
await fs.writeFile(`${dir}/IMPORT-FAILURES-dulux-atlas.json`, JSON.stringify({ at: now, listed: atlasUrls.length, failures }, null, 2) + '\n');
console.log(JSON.stringify({ total: catalogue.colours.length, added, popular: catalogue.colours.filter(colour => colour.isPopular).length,
  listedAtlasPages: atlasUrls.length, atlasKnown: atlas.size, notYetFetched: atlasUrls.filter(item => !atlas.has(item.path)).length, failures: failures.length }));
