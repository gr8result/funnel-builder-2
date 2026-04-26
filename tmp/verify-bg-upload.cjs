const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    localStorage.setItem(
      'gr8:website-builder-assets:v1',
      JSON.stringify({ logo: null, images: [] })
    );

    localStorage.setItem(
      'gr8:website-projects:v1',
      JSON.stringify([
        {
          id: 'bg-upload-test',
          name: 'BG Upload Test',
          mode: 'blank',
          buildType: 'website',
          stylePack: 'executive',
          status: 'saved',
          brief: {},
          pages: [{ name: 'Home', objective: 'Test page' }],
          pageBlocks: {
            Home: [
              {
                id: 'hero-1',
                type: 'hero',
                props: {
                  headline: 'Hero title',
                  subheadline: 'Sub copy',
                  ctaText: 'Go',
                  ctaLink: '#',
                  backgroundStyle: 'image',
                  backgroundColor: '#0f172a',
                  textColor: '#ffffff',
                  backgroundImage: '',
                },
              },
            ],
          },
          pagesContent: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    );
  });

  await page.goto(
    'http://localhost:3000/modules/website-builder/visual-builder?projectId=bg-upload-test&page=Home&name=BG%20Upload%20Test&mode=blank&type=website',
    { waitUntil: 'networkidle2' }
  );

  await page.waitForSelector('main');
  const before = await page.evaluate(() => document.body.innerText || '');

  const hero = await page.$('section');
  if (hero) {
    await hero.click();
  }

  const fileInput = await page.$('input[type=file]');
  if (fileInput) {
    await fileInput.setInputFiles('D:/dev/funnel-builder-clean/public/logo.png');
    await new Promise((resolve) => setTimeout(resolve, 1800));
  }

  const after = await page.evaluate(() => document.body.innerText || '');

  console.log('HAS_HERO_BEFORE=' + /Hero title/.test(before));
  console.log('HAS_CANVAS_AFTER=' + /Website Page Builder|Save Page/.test(after));
  console.log('HAS_HERO_AFTER=' + /Hero title|Sub copy|Go/.test(after));
  console.log('HAS_RUNTIME_ERROR=' + /Application error|Recoverable Error|Hydration/i.test(after));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
