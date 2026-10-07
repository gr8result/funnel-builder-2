const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function get(u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,*/*', 'Accept-Language': 'en-AU,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(35000) });
    return { status: r.status, url: r.url, text: r.ok ? await r.text() : '' };
  } catch (e) { return { status: 'ERR:' + e.name, url: u, text: '' }; }
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const HOSTS = [
  'https://cbfappliances.com.au',
  'https://www.statewideapp.com.au',
  'https://www.appliancesonline.com.au',
  'https://www.binglee.com.au',
  'https://www.thegoodguys.com.au',
  'https://www.appliancecentral.com.au',
  'https://www.designerappliances.com.au',
  'https://www.spartanelectrical.com.au',
];
for (const host of HOSTS) {
  const robots = await get(`${host}/robots.txt`);
  const declared = [...new Set([...robots.text.matchAll(/Sitemap:\s*(\S+)/gi)].map((m) => m[1]))];
  const maps = declared.length ? declared : [`${host}/sitemap.xml`, `${host}/sitemap_index.xml`];
  let best = null;
  for (const sm of maps.slice(0, 3)) {
    const r = await get(sm);
    const locs = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].trim());
    if (locs.length) { best = { sm, status: r.status, locs }; break; }
  }
  console.log(String(host.replace('https://', '')).padEnd(34), 'robots', String(robots.status).padEnd(9),
    best ? `${best.locs.length} locs from ${best.sm.replace(host, '').slice(0, 34)}` : 'no sitemap');
}
