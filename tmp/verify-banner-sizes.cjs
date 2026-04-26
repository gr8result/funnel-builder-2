const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://localhost:3000/modules/website-builder/visual-builder?mode=blank&type=website&name=Starter%20Website', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const result = await page.evaluate(() => {
      const titleEl = Array.from(document.querySelectorAll('strong')).find((el) => (el.textContent || '').includes('Website Studio'));
      const subtitleEl = Array.from(document.querySelectorAll('span')).find((el) => (el.textContent || '').includes('page builder'));
      const backEl = Array.from(document.querySelectorAll('a')).find((el) => (el.textContent || '').trim() === 'Back');
      const iconEl = Array.from(document.querySelectorAll('div')).find((el) => (el.textContent || '').trim() === '??');
      return {
        titleSize: titleEl ? getComputedStyle(titleEl).fontSize : '',
        titleWeight: titleEl ? getComputedStyle(titleEl).fontWeight : '',
        subtitleSize: subtitleEl ? getComputedStyle(subtitleEl).fontSize : '',
        backSize: backEl ? getComputedStyle(backEl).fontSize : '',
        iconWidth: iconEl ? getComputedStyle(iconEl).width : '',
        iconHeight: iconEl ? getComputedStyle(iconEl).height : '',
      };
    });
    console.log('TITLE_SIZE=' + result.titleSize);
    console.log('TITLE_WEIGHT=' + result.titleWeight);
    console.log('SUBTITLE_SIZE=' + result.subtitleSize);
    console.log('BACK_SIZE=' + result.backSize);
    console.log('ICON_WIDTH=' + result.iconWidth);
    console.log('ICON_HEIGHT=' + result.iconHeight);
  } catch (error) {
    console.error('VERIFY_ERROR=' + error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
