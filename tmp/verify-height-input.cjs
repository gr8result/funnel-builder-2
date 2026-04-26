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
      const parallaxBtn = Array.from(document.querySelectorAll('button')).find((el) => (el.textContent || '').includes('+ Parallax Section'));
      if (parallaxBtn) parallaxBtn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const result = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label')).find((el) => (el.textContent || '').includes('Section Height'));
      const input = label ? label.parentElement.querySelector('input') : null;
      if (!input) return { found: false };
      input.focus();
      input.value = '650';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.blur();
      return { found: true, value: input.value };
    });

    console.log('HEIGHT_INPUT_FOUND=' + result.found);
    console.log('HEIGHT_INPUT_VALUE=' + (result.value || ''));
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
