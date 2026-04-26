const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(r => setTimeout(r, 3500));

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(el => (el.textContent || '').includes('+ Image Stack'));
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 1200));

    const before = await page.evaluate(() => ({
      body: document.body.innerText,
      layers: document.querySelectorAll('[data-image-layer]').length,
      blocks: Array.from(document.querySelectorAll('span,div,h3')).map(el => el.textContent || '').filter(Boolean).slice(0, 80)
    }));

    await page.evaluate(() => {
      const text = Array.from(document.querySelectorAll('button')).find(el => (el.textContent || '').includes('+ Add Text Layer'));
      if (text) text.click();
    });

    await new Promise(r => setTimeout(r, 1200));

    const after = await page.evaluate(() => ({
      textLayerButtons: Array.from(document.querySelectorAll('button')).map(el => el.textContent || '').filter(t => t.includes('Text') || t.includes('Layer')),
      textPresent: (document.body.innerText || '').includes('Headline Text'),
      htmlPresent: !!Array.from(document.querySelectorAll('[data-image-layer]')).find(el => (el.innerText || '').includes('Headline Text')),
      layerCount: document.querySelectorAll('[data-image-layer]').length,
      editTitle: Array.from(document.querySelectorAll('h3')).map(el => el.textContent || '').find(t => t.includes('Layered Image Stack')) || ''
    }));

    console.log('BEFORE_LAYERS=' + before.layers);
    console.log('AFTER=' + JSON.stringify(after));
  } catch (e) {
    console.error('VERIFY_ERROR=' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
