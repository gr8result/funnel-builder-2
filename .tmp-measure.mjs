import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.goto('http://localhost:3000/p/gr8-business-and-marketing-platform?step=2', { waitUntil: 'networkidle2', timeout: 60000 });
const info = await page.evaluate(() => {
  const shape = document.querySelector('[data-shape-block]');
  const parent = shape?.parentElement;
  const wrapper = parent?.querySelector(':scope > div:last-child') || parent?.children?.[1] || null;
  const text = parent?.querySelector('h2, h1, p');
  const rect = (el) => el ? ({ left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }) : null;
  return {
    parentTag: parent?.tagName,
    parentId: parent?.id,
    wrapperId: wrapper?.id || null,
    shapeStyleLeft: shape?.style.left || null,
    shapeStyleTop: shape?.style.top || null,
    shapeStyleWidth: shape?.style.width || null,
    shapeRect: rect(shape),
    parentRect: rect(parent),
    wrapperRect: rect(wrapper),
    textRect: rect(text),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
