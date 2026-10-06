import puppeteer from 'puppeteer';

const URL = process.argv[2] || 'https://www.harveynormancommercial.com.au/kitchen/ovens?page=1&category_id=22&sort=position&dir=ASC&brand=271';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36');
await page.setViewport({ width: 1600, height: 1400 });
page.on('pageerror', () => {});
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise((r) => setTimeout(r, 6000));

const out = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')]
    .map((i) => ({ src: i.currentSrc || i.src, alt: (i.alt || '').trim(), w: i.naturalWidth, h: i.naturalHeight }))
    .filter((i) => i.src && i.w > 80 && !/logo|icon|sprite|flag/i.test(i.src));
  const links = [...document.querySelectorAll('a[href]')]
    .map((a) => ({ href: a.href, text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 90) }))
    .filter((a) => a.text && /\/[a-z0-9-]+\/[a-z0-9-]+/.test(new URL(a.href).pathname));
  // Anything that looks like a product tile
  const tiles = [...document.querySelectorAll('[class*="product"],[data-product],li,article')]
    .map((el) => ({ cls: el.className && String(el.className).slice(0, 60), text: el.innerText.trim().replace(/\s+/g, ' ').slice(0, 140) }))
    .filter((t) => /\$|omega/i.test(t.text) && t.text.length > 20);
  return {
    title: document.title,
    bodyLen: document.body.innerText.length,
    imgCount: imgs.length,
    imgs: imgs.slice(0, 12),
    tiles: tiles.slice(0, 10),
    linkSample: links.slice(0, 12),
    bodyStart: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
