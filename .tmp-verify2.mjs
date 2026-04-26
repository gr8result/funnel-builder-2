import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.goto('http://localhost:3000/p/gr8-business-and-marketing-platform?step=2', { waitUntil: 'networkidle2', timeout: 60000 });
const info = await page.evaluate(() => {
  const shape = document.querySelector('[data-shape-block]');
  const parent = shape?.parentElement;
  const text = parent?.querySelector('h1, h2, p');
  const rect = (el) => el ? ({ left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }) : null;
  return {
    parentTag: parent?.tagName,
    parentId: parent?.id,
    shapeLeft: window.getComputedStyle(shape).left,
    shapeWidth: window.getComputedStyle(shape).width,
    shapeZ: window.getComputedStyle(shape).zIndex,
    transform: window.getComputedStyle(shape).transform,
    shapeRect: rect(shape),
    textRect: rect(text),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
