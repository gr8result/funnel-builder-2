const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Blank%20Website', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await page.screenshot({ path: 'D:/dev/funnel-builder-clean/tmp/studio-layout.png', fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
