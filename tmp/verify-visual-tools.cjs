const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:3001/modules/website-builder/visual-builder?mode=blank', { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('Website Page Builder'), { timeout: 120000 });

    const before = await page.evaluate(() => document.body.innerText);
    const hasGrid = before.includes('Grid On') || before.includes('Grid Off');
    const hasParallaxButton = before.includes('+ Parallax Section');
    const hasImageStackButton = before.includes('+ Image Stack');

    if (hasImageStackButton) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Image Stack'));
        if (btn) btn.click();
      });
      await page.waitForFunction(() => document.body.innerText.includes('Free Layout Image Canvas') || document.body.innerText.includes('Layered Image Stack'), { timeout: 20000 });
    }

    if (hasParallaxButton) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Parallax Section'));
        if (btn) btn.click();
      });
      await page.waitForFunction(() => document.body.innerText.includes('Parallax Section'), { timeout: 20000 });
    }

    const after = await page.evaluate(() => ({
      text: document.body.innerText,
      blockCount: document.querySelectorAll('button[title="Duplicate"]').length,
    }));

    console.log('HAS_GRID_BUTTON=' + hasGrid);
    console.log('HAS_PARALLAX_ADD=' + hasParallaxButton);
    console.log('HAS_IMAGE_STACK_ADD=' + hasImageStackButton);
    console.log('HAS_PARALLAX_BLOCK=' + after.text.includes('Parallax Section'));
    console.log('HAS_IMAGE_STACK_BLOCK=' + (after.text.includes('Free Layout Image Canvas') || after.text.includes('Layered Image Stack')));
    console.log('BLOCK_COUNT=' + after.blockCount);
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
