const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/p/gr8-business-and-marketing-platform?step=2", { waitUntil: "networkidle2", timeout: 60000 });
  const info = await page.evaluate(() => {
    const ids = ['iz6j0i','iqwdja','ivfyha','in6gl6'];
    const out = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      out[id] = el ? {
        z: getComputedStyle(el).zIndex,
        transform: getComputedStyle(el).transform,
        top: Math.round(el.getBoundingClientRect().top),
        height: Math.round(el.getBoundingClientRect().height),
      } : null;
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
