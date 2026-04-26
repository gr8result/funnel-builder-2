const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3001/modules/website-builder/visual-builder?mode=blank', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await page.waitForFunction(() => document.body && document.body.innerText.includes('Website Page Builder'), { timeout: 60000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Image Stack'));
      if (btn) btn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.waitForSelector('[data-image-stack-canvas]', { timeout: 20000 });
    const layer = await page.$('[data-image-stack-canvas] > div');
    const box = await layer.boundingBox();
    if (!box) throw new Error('No layer box');
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 100, { steps: 12 });
    await page.mouse.up();
    const debug = await page.evaluate(() => window.__imageStackDebug || null);
    const style = await page.evaluate(() => {
      const el = document.querySelector('[data-image-stack-canvas] > div');
      return { left: el?.style.left, top: el?.style.top };
    });
    console.log('DEBUG=' + JSON.stringify(debug));
    console.log('STYLE=' + JSON.stringify(style));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
