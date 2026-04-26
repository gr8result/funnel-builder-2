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

    const proof = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const editableCount = document.querySelectorAll('[contenteditable="true"]').length;
      const options = Array.from(document.querySelectorAll('select option')).map((o) => o.textContent || '');
      const has72 = options.includes('72px') || options.includes('Sub 72px');
      const hasResizeHandle = !!document.querySelector('[title="Drag to resize image"], [aria-label="Drag to resize image"]');
      return {
        hasBuilder: text.includes('Website Page Builder'),
        editableCount,
        has72,
        parallaxStrengthVisible: text.includes('Parallax Strength'),
        hasResizeHandle,
      };
    });

    console.log('HAS_BUILDER=' + proof.hasBuilder);
    console.log('CONTENTEDITABLE_COUNT=' + proof.editableCount);
    console.log('HAS_72PX_OPTION=' + proof.has72);
    console.log('PARALLAX_STRENGTH_VISIBLE=' + proof.parallaxStrengthVisible);
    console.log('HAS_RESIZE_HANDLE=' + proof.hasResizeHandle);
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
