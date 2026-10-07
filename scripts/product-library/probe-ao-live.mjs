const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function get(u) {
  try { const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(60000) }); return { status: r.status, text: r.ok ? await r.text() : '' }; } catch (e) { return { status: 'ERR:' + e.name, text: '' }; }
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const idx = await get('https://www.appliancesonline.com.au/public/sitemaps/sitemap-index.xml');
const maps = [...idx.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].trim());
console.log('sitemaps:', maps.length, maps.map((m) => m.split('/').pop()));

const all = [];
for (const m of maps) {
  const r = await get(m);
  const locs = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((x) => x[1].trim());
  all.push(...locs);
  console.log('  ', m.split('/').pop().padEnd(34), r.status, locs.length);
}
console.log('total urls:', all.length);

const MODELS = ['BCG604WX', 'BCG905WX', 'BIC90X', 'BRC60X', 'BRC90X', 'BRU60X', 'BRU90X', 'BRU90UX',
  'ARHC60X', 'ARHC90X', 'ARHS90X', 'ARU60X', 'ARU90X',
  'ECCK900', 'GC90S', 'CS60S', 'FS90S', 'OI90Z', 'ORC60X', 'ORC90X', 'WRI930SB', 'PGA75',
  'PCR6A5B90A', 'DWP66BC50A'];
let hits = 0;
for (const mdl of MODELS) {
  const found = all.filter((u) => norm(u).includes(norm(mdl)));
  if (found.length) { hits += 1; console.log('  HIT', mdl.padEnd(12), found[0].slice(0, 100)); }
}
console.log('models found live at AO:', hits, '/', MODELS.length);
