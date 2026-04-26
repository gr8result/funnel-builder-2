const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const text = await page.evaluate(() => document.body.innerText || '');
    console.log('HAS_ONSCREEN_HINT=' + text.includes('On-Screen Editing'));
    console.log('HAS_HEIGHT_HINT=' + text.includes('Type the height in pixels'));
    console.log('HAS_WIDTH_HINT=' + text.includes('Expands section background edge-to-edge'));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
