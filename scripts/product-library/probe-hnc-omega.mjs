const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function get(u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*', 'Accept-Language': 'en-AU,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(40000) });
    return { status: r.status, url: r.url, text: r.ok ? await r.text() : '' };
  } catch (e) { return { status: 'ERR:' + e.name, url: u, text: '' }; }
}

const url = 'https://www.harveynormancommercial.com.au/kitchen/ovens?page=1&category_id=22&sort=position&dir=ASC&brand=271';
const r = await get(url);
console.log('status', r.status, '| len', r.text.length, '| final', r.url);

const t = r.text;
console.log('\n--- product links ---');
const links = [...new Set([...t.matchAll(/href="([^"]*\/(?:product|p)\/[^"]*)"/gi)].map((m) => m[1]))];
console.log(links.length, links.slice(0, 6));

console.log('\n--- media CDN image refs ---');
const imgs = [...new Set([...t.replace(/&amp;/g, '&').matchAll(/https?:\/\/[^"'\s)<>]*harveynormancommercial[^"'\s)<>]*?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s)<>]*)?/gi)].map((m) => m[0]))];
console.log(imgs.length);
for (const i of imgs.slice(0, 10)) console.log('   ', i.slice(0, 120));

console.log('\n--- model-code-looking tokens in text ---');
const plain = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log([...new Set((plain.match(/\bO[A-Z]{1,3}\d{2,4}[A-Z0-9]*\b/g) || []))].slice(0, 30));

console.log('\n--- any JSON blobs ---');
for (const m of [...t.matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]{0,400})/gi)].slice(0, 3)) {
  console.log('   ', m[1].replace(/\s+/g, ' ').slice(0, 250));
}
console.log('\n--- snippet ---');
console.log(plain.slice(0, 500));
