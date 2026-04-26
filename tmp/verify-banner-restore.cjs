const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const text = await page.evaluate(() => document.body.innerText || '');
    console.log('HAS_STUDIO_BANNER=' + /Website Studio|Back/.test(text));
    console.log('HAS_SHARED_LAYOUT=' + /Active account|GR8 RESULT|Digital Solutions/.test(text));
    console.log('HAS_RUNTIME_ERROR=' + /Application error|Hydration|ReferenceError|SyntaxError/i.test(text));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
