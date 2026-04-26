const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await new Promise((resolve) => setTimeout(resolve, 4000));

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Image Stack'));
      if (btn) btn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const layer = await page.$('[data-image-layer="0"]');
    const moveHandle = await page.$('[data-image-layer="0"]');
    const resizeHandle = await page.$('[data-image-layer="0"] [data-resize-handle="se"]');
    const layerBox = await layer.boundingBox();
    const resizeBox = await resizeHandle.boundingBox();
    if (!layerBox || !resizeBox) throw new Error('Missing layer or resize handle');

    const before = await page.evaluate(() => {
      const el = document.querySelector('[data-image-layer="0"]');
      return {
        left: el?.style.left || '',
        top: el?.style.top || '',
        width: el?.style.width || '',
        height: el?.style.height || '',
      };
    });

    await page.mouse.move(layerBox.x + 60, layerBox.y + 60);
    await page.mouse.down();
    await page.mouse.move(layerBox.x + 150, layerBox.y + 150, { steps: 15 });
    await page.mouse.up();

    await page.mouse.move(resizeBox.x + 6, resizeBox.y + 6);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + 50, resizeBox.y + 40, { steps: 15 });
    await page.mouse.up();

    const after = await page.evaluate(() => {
      const el = document.querySelector('[data-image-layer="0"]');
      const text = document.body.innerText || '';
      return {
        left: el?.style.left || '',
        top: el?.style.top || '',
        width: el?.style.width || '',
        height: el?.style.height || '',
        snapText: text.includes('snapping follows the grid'),
      };
    });

    console.log('BEFORE=' + JSON.stringify(before));
    console.log('AFTER=' + JSON.stringify(after));
    console.log('MOVED=' + (before.left !== after.left || before.top !== after.top));
    console.log('RESIZED=' + (before.width !== after.width || before.height !== after.height));
    console.log('GRID_SNAP_HINT=' + after.snapText);
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
