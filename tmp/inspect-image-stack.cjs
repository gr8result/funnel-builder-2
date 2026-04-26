const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Image Stack'));
      if (btn) btn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const info = await page.evaluate(() => ({
      layerCount: document.querySelectorAll('[data-image-layer]').length,
      resizeCount: document.querySelectorAll('[data-resize-handle]').length,
      body: document.body.innerText,
    }));
    console.log('LAYER_COUNT=' + info.layerCount);
    console.log('RESIZE_COUNT=' + info.resizeCount);
    console.log('HAS_IMAGE_STACK_TEXT=' + info.body.includes('Layered Image Stack') || info.body.includes('Free Layout Image Canvas'));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
