const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(r => setTimeout(r, 8000));
    const info = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      headingTexts: Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(el => (el.textContent || '').trim()).filter(Boolean).slice(0, 20),
      buttonTexts: Array.from(document.querySelectorAll('button')).map(el => (el.textContent || '').trim()).filter(Boolean).slice(0, 60),
      labelTexts: Array.from(document.querySelectorAll('label')).map(el => (el.textContent || '').trim()).filter(Boolean).slice(0, 40),
      text: (document.body.innerText || '').slice(0, 3000)
    }));
    console.log(JSON.stringify(info, null, 2));
  } catch (e) {
    console.error('VERIFY_ERROR=' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
