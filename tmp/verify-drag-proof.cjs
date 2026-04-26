const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3001/modules/website-builder/visual-builder?mode=blank', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('Website Page Builder'), { timeout: 60000 });

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Image Stack'));
      if (btn) btn.click();
    });

    await page.waitForSelector('[data-image-stack-canvas]', { timeout: 20000 });
    const layerHandle = await page.$('[data-image-stack-canvas] > div');
    const layerBox = await layerHandle.boundingBox();
    if (!layerBox) throw new Error('Missing layer bounds');

    const before = await page.evaluate(() => {
      const layer = document.querySelector('[data-image-stack-canvas] > div');
      return {
        left: layer?.style.left || '',
        top: layer?.style.top || '',
        width: layer?.style.width || '',
        height: layer?.style.height || '',
      };
    });

    await page.mouse.move(layerBox.x + 40, layerBox.y + 40);
    await page.mouse.down();
    await page.mouse.move(layerBox.x + 120, layerBox.y + 100, { steps: 12 });
    await page.mouse.up();

    const afterMove = await page.evaluate(() => {
      const layer = document.querySelector('[data-image-stack-canvas] > div');
      return {
        left: layer?.style.left || '',
        top: layer?.style.top || '',
        width: layer?.style.width || '',
        height: layer?.style.height || '',
      };
    });

    console.log('BEFORE=' + JSON.stringify(before));
    console.log('AFTER_MOVE=' + JSON.stringify(afterMove));
    console.log('MOVED=' + (before.left !== afterMove.left || before.top !== afterMove.top));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
