const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((el) => (el.textContent || '').trim()).slice(0, 50));
    console.log(JSON.stringify(buttons, null, 2));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
