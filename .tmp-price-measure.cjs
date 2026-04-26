const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/p/gr8-business-and-marketing-platform?step=2", { waitUntil: "networkidle2", timeout: 60000 });
  const ids = ['iz6j0i','iqwdja','ivfyha','in6gl6','icw0a3'];
  const info = await page.evaluate((ids) => {
    const rect = (el) => el ? ({ left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }) : null;
    const out = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      out[id] = { rect: rect(el), text: (el?.innerText || '').slice(0,120), style: el ? {
        position: getComputedStyle(el).position,
        transform: getComputedStyle(el).transform,
        zIndex: getComputedStyle(el).zIndex,
        left: getComputedStyle(el).left,
        top: getComputedStyle(el).top,
      } : null };
    });
    return out;
  }, ids);
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
