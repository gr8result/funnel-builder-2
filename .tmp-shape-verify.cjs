const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/p/gr8-business-and-marketing-platform?step=2", { waitUntil: "networkidle2", timeout: 60000 });
  const info = await page.evaluate(() => {
    const shape = document.querySelector("[data-shape-block]");
    const parent = shape?.parentElement;
    const rect = (el) => el ? ({ left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }) : null;
    return {
      shapeStyleWidth: shape?.style.width || null,
      shapeStyleLeft: shape?.style.left || null,
      shapeTransform: shape?.style.transform || null,
      shapeRect: rect(shape),
      parentRect: rect(parent),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
