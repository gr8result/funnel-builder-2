// Targeted per-model CDX prefix queries. Appliances Online stores every product
// shot under /images/product/<model>/, so the model code alone addresses the
// folder - far cheaper than pulling a whole-domain capture index.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function get(u) {
  try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); return { status: r.status, text: r.ok ? await r.text() : '' }; } catch (e) { return { status: 'ERR:' + e.name, text: '' }; }
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

async function prefix(pattern) {
  const u = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(pattern)}&matchType=prefix&output=json&fl=original,timestamp&filter=statuscode:200&collapse=urlkey&limit=60`;
  const r = await get(u);
  if (!r.text) return [];
  try { return JSON.parse(r.text).slice(1); } catch { return []; }
}

const MODELS = ['BCG604WX', 'BCG905WX', 'BIC90X', 'BRC60X', 'BRC90X', 'BRU60X', 'BRU90X', 'BRU90UX',
  'ARHC60X', 'ARHC90X', 'ARHS90X', 'ARU60X', 'ARU90X',
  'ECCK900', 'GC90S', 'CS60S', 'FS90S', 'OI90Z', 'ORC60X', 'ORC90X', 'WRI930SB', 'PGA75',
  'PCR6A5B90A', 'DWP66BC50A', 'NIO844DOBAUS', 'PKQ755DGHAUS'];

for (const m of MODELS) {
  const rows = await prefix(`appliancesonline.com.au/images/product/${m.toLowerCase()}/`);
  const imgs = rows.filter(([u]) => /\.(jpe?g|png|webp)(\?|$)/i.test(u) && !/icon|thumb|small/i.test(u));
  console.log(String(m).padEnd(14), String(rows.length).padEnd(4), imgs.length ? imgs[0][0].slice(-78) + '  @' + imgs[0][1] : '-');
}
