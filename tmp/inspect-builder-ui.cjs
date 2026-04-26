const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await new Promise(r => setTimeout(r, 5000));
    const info = await page.evaluate(() => ({
      title: document.title,
      h3s: Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(el => el.textContent || '').slice(0, 30),
      buttons: Array.from(document.querySelectorAll('button')).map(el => (el.textContent || '').trim()).filter(Boolean).slice(0, 100),
      text: (document.body.innerText || '').slice(0, 2000)
    }));
    console.log(JSON.stringify(info, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
