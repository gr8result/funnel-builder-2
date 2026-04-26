import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await page.goto('http://localhost:3000/modules/funnels/edit/5abbf73a-32f2-46dc-a3b7-0f3b56fa53c0', {
  waitUntil: 'networkidle2',
  timeout: 60000,
});

await page.waitForSelector('#gjs iframe', { timeout: 60000 });
const frameHandle = await page.$('#gjs iframe');
const frame = await frameHandle.contentFrame();
await frame.waitForSelector('body *', { timeout: 60000 });

const candidate = await frame.$('img, h1, h2, h3, p, div, section');
if (candidate) {
  await candidate.click({ delay: 40 });
}

await page.waitForFunction(
  () => document.body.innerText.includes('Arrange & Group'),
  { timeout: 15000 }
).catch(() => null);

const result = await page.evaluate(() => {
  const text = document.body.innerText || '';
  return text.includes('Arrange & Group') ? 'ARRANGE_UI_OK' : 'ARRANGE_UI_STILL_HIDDEN';
});

console.log(result);
await browser.close();
