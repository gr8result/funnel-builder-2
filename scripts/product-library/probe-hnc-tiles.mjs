import puppeteer from 'puppeteer';
const URL = process.argv[2];
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36');
await page.setViewport({ width: 1600, height: 1600 });
page.on('pageerror', () => {});
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise((r) => setTimeout(r, 6000));
// scroll to trigger lazy loading
await page.evaluate(async () => { for (let y = 0; y < 6000; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 300)); } });
await new Promise((r) => setTimeout(r, 3000));

const out = await page.evaluate(() => {
  // A product tile is the nearest anchor ancestor of each product image.
  const tiles = [];
  for (const img of document.querySelectorAll('img')) {
    const src = img.currentSrc || img.src;
    if (!src || !/backend\.harveynormancommercial/.test(decodeURIComponent(src))) continue;
    const a = img.closest('a[href]');
    const card = img.closest('li,article,div[class*="card"],div[class*="product"]') || (a && a.parentElement);
    tiles.push({
      alt: (img.alt || '').trim(),
      img: decodeURIComponent(src.replace(/^.*?url=/, '').split('&')[0]),
      href: a ? a.href : '',
      text: card ? card.innerText.trim().replace(/\s+/g, ' ').slice(0, 180) : '',
    });
  }
  const pager = [...document.querySelectorAll('a[href*="page="]')].map((a) => a.href);
  return { count: tiles.length, tiles, pager: [...new Set(pager)].slice(0, 12), bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
