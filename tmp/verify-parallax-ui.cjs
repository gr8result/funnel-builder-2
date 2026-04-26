const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(r => setTimeout(r, 5000));
    const text = await page.evaluate(() => document.body.innerText || '');
    console.log('HAS_BUILDER=' + text.includes('Website Page Builder'));
    console.log('HAS_PARALLAX=' + text.includes('Parallax Section'));
    console.log('HAS_DRAG_IMAGE=' + text.includes('Drag Image'));
  } catch (e) {
    console.error('VERIFY_ERROR=' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
