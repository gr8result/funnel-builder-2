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

    const proof = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const editableCount = document.querySelectorAll('[contenteditable="true"]').length;
      const options = Array.from(document.querySelectorAll('select option')).map((o) => o.textContent || '');
      const has72 = options.includes('72px') || options.includes('Sub 72px');
      const sectionLabel = Array.from(document.querySelectorAll('label')).find((el) => (el.textContent || '').includes('Section Height'));
      const sectionInput = sectionLabel ? sectionLabel.parentElement.querySelector('input') : null;
      return {
        hasBuilder: text.includes('Website Page Builder'),
        editableCount,
        has72,
        parallaxStrengthVisible: text.includes('PARALLAX STRENGTH') || text.includes('Parallax Strength'),
        sectionInputPresent: !!sectionInput,
        hasParallaxBlock: text.includes('Parallax Section'),
      };
    });

    console.log('HAS_BUILDER=' + proof.hasBuilder);
    console.log('HAS_PARALLAX_BLOCK=' + proof.hasParallaxBlock);
    console.log('CONTENTEDITABLE_COUNT=' + proof.editableCount);
    console.log('HAS_72PX_OPTION=' + proof.has72);
    console.log('PARALLAX_STRENGTH_VISIBLE=' + proof.parallaxStrengthVisible);
    console.log('SECTION_INPUT_PRESENT=' + proof.sectionInputPresent);
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
