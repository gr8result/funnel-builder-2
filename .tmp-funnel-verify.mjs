import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.goto('http://localhost:3000/p/gr8-business-and-marketing-platform?step=2', { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('[data-shape-block]', { timeout: 30000 });
const info = await page.evaluate(() => {
  const shape = document.querySelector('[data-shape-block]');
  const parent = shape?.parentElement;
  const wrap = parent?.querySelector('h2, h1, p');
  const shapeRect = shape?.getBoundingClientRect();
  const textRect = wrap?.getBoundingClientRect();
  return {
    shapeFound: !!shape,
    zIndex: window.getComputedStyle(shape).zIndex,
    parentPosition: parent ? window.getComputedStyle(parent).position : null,
    pointerEvents: window.getComputedStyle(shape).pointerEvents,
    shapeRect,
    textRect
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
