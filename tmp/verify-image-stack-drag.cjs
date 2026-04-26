const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:3001/modules/website-builder/visual-builder?mode=blank', { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('Website Page Builder'), { timeout: 120000 });

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Image Stack'));
      if (btn) btn.click();
    });

    await page.waitForSelector('[data-image-stack-canvas]', { timeout: 20000 });
    await page.waitForFunction(() => !!document.querySelector('[data-image-stack-canvas] > div'), { timeout: 20000 });

    const canvas = await page.$('[data-image-stack-canvas]');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Missing image stack canvas bounds');

    const before = await page.evaluate(() => {
      const layer = document.querySelector('[data-image-stack-canvas] > div');
      return {
        left: layer?.style.left || '',
        top: layer?.style.top || '',
        width: layer?.style.width || '',
        height: layer?.style.height || '',
      };
    });

    await page.mouse.move(box.x + 90, box.y + 90);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(box.x + 180, box.y + 150, { steps: 20 });
    await page.mouse.up({ button: 'left' });

    await page.mouse.move(box.x + 305, box.y + 225);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(box.x + 360, box.y + 285, { steps: 20 });
    await page.mouse.up({ button: 'left' });

    const after = await page.evaluate(() => {
      const layer = document.querySelector('[data-image-stack-canvas] > div');
      return {
        left: layer?.style.left || '',
        top: layer?.style.top || '',
        width: layer?.style.width || '',
        height: layer?.style.height || '',
        instructionsVisible: document.body.innerText.includes('Drag images to move')
      };
    });

    console.log('BEFORE=' + JSON.stringify(before));
    console.log('AFTER=' + JSON.stringify(after));
    console.log('MOVED=' + (before.left !== after.left || before.top !== after.top));
    console.log('RESIZED=' + (before.width !== after.width || before.height !== after.height));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
