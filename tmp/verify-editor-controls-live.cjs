const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const url = 'http://localhost:3000/modules/website-builder/visual-builder?projectId=7940b32e-5589-4dc9-810f-a5ca04ed8eee&page=Home&name=Starter%20Website&mode=blank&type=website';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 4000));

    await page.evaluate(() => {
      const stackBtn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Image Stack'));
      if (stackBtn) stackBtn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const proof = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const editableCount = document.querySelectorAll('[contenteditable="true"]').length;
      const options = Array.from(document.querySelectorAll('select option')).map((o) => o.textContent || '');
      const has72 = options.includes('72px') || options.includes('Sub 72px');
      const hasResizeHandle = !!document.querySelector('[title="Drag to resize image"], [aria-label="Drag to resize image"], [data-image-stack-canvas]');
      const sectionInput = Array.from(document.querySelectorAll('input')).find((el) => (el.placeholder || '') === '420');
      return {
        hasBuilder: text.includes('Website Page Builder'),
        editableCount,
        has72,
        parallaxStrengthVisible: text.includes('PARALLAX STRENGTH') || text.includes('Parallax Strength'),
        hasResizeHandle,
        sectionInputPresent: !!sectionInput,
      };
    });

    console.log('HAS_BUILDER=' + proof.hasBuilder);
    console.log('CONTENTEDITABLE_COUNT=' + proof.editableCount);
    console.log('HAS_72PX_OPTION=' + proof.has72);
    console.log('PARALLAX_STRENGTH_VISIBLE=' + proof.parallaxStrengthVisible);
    console.log('HAS_RESIZE_HANDLE=' + proof.hasResizeHandle);
    console.log('SECTION_INPUT_PRESENT=' + proof.sectionInputPresent);
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
