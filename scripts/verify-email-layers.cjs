const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const tmpDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const bgPath = path.join(tmpDir, 'email-layer-bg.svg');
  const logoPath = path.join(tmpDir, 'email-layer-logo.svg');
  const shotPath = path.join(tmpDir, 'email-layer-check.png');

  fs.writeFileSync(bgPath, `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1d4ed8" />
          <stop offset="100%" stop-color="#9333ea" />
        </linearGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#g)" />
      <circle cx="1000" cy="120" r="90" fill="rgba(255,255,255,0.18)" />
      <circle cx="180" cy="540" r="120" fill="rgba(255,255,255,0.12)" />
    </svg>
  `);

  fs.writeFileSync(logoPath, `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120">
      <rect x="5" y="5" width="290" height="110" rx="18" fill="#ffffff" opacity="0.96" />
      <text x="150" y="73" text-anchor="middle" font-size="38" font-family="Arial" font-weight="700" fill="#0f172a">LOGO</text>
    </svg>
  `);

  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1600, height: 1300 } });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  await page.goto('http://localhost:3000/modules/email/editor?preset=newsletter', { waitUntil: 'networkidle2' });

  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((el) => /Text On Image/i.test(el.textContent || ''));
    if (!btn) return false;
    btn.click();
    return true;
  });
  console.log('CLICKED_TEXT_ON_IMAGE=' + clicked);

  await page.waitForFunction(() => [...document.querySelectorAll('div')].some((el) => /Layer Options/i.test(el.textContent || '')));

  const fileInputs = await page.$$('input[type="file"]');
  console.log('FILE_INPUT_COUNT=' + fileInputs.length);
  if (fileInputs.length < 2) throw new Error('Expected at least 2 file inputs for the selected image section');

  await fileInputs[fileInputs.length - 2].uploadFile(bgPath);
  await page.waitForFunction(() => document.body.innerText.includes('Image uploaded!'));

  const refreshedInputs = await page.$$('input[type="file"]');
  await refreshedInputs[refreshedInputs.length - 1].uploadFile(logoPath);
  await page.waitForFunction(() => document.body.innerText.includes('Image uploaded!'));

  await page.evaluate(() => {
    const editables = [...document.querySelectorAll('[contenteditable="true"]')];
    const headline = editables.find((el) => /Text over your image|Click to edit headline/i.test(el.textContent || ''));
    const sub = editables.find((el) => /supporting copy|Click to edit supporting text/i.test(el.textContent || ''));
    if (headline) {
      headline.textContent = 'Layered image headline';
      headline.dispatchEvent(new Event('input', { bubbles: true }));
      headline.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    if (sub) {
      sub.textContent = 'Text layer over the image with a logo layer above it.';
      sub.dispatchEvent(new Event('input', { bubbles: true }));
      sub.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  });

  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('SCREENSHOT=' + shotPath);

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});