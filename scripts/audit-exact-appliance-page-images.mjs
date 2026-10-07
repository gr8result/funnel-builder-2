import puppeteer from "puppeteer";

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error("Usage: node scripts/audit-exact-appliance-page-images.mjs <url> [url...]");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  timeout: 60000,
});

try {
  for (const sourceUrl of urls) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    const result = { sourceUrl, title: "", finalUrl: "", bodyExcerpt: "", images: [], matchingUrls: [], error: "" };
    try {
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await new Promise((resolve) => setTimeout(resolve, 4500));
      Object.assign(result, await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        const modelPattern = /(FA5834HIXAAUS|FI9\s*891\s*SP\s*IX\s*A\s*AUS|BOSE65XM|BOSE90X|OBO660X|OBO960X1|SF64M3TVX|SFPA9395X1|WVE916SC)/gi;
        const urlPattern = /https?:[^"' )<>]+/gi;
        const matchingUrls = [];
        for (const match of html.matchAll(urlPattern)) {
          if (modelPattern.test(match[0])) matchingUrls.push(match[0]);
          modelPattern.lastIndex = 0;
        }
        return {
          title: document.title,
          finalUrl: location.href,
          bodyExcerpt: (document.body?.innerText || "").slice(0, 900),
          matchingUrls: Array.from(new Set(matchingUrls)).slice(0, 80),
          images: Array.from(document.images)
            .map((image) => ({
              src: image.currentSrc || image.src,
              alt: image.alt,
              width: image.naturalWidth,
              height: image.naturalHeight,
            }))
            .filter((image) => image.src && image.width > 80 && image.height > 80)
            .slice(0, 60),
        };
      }));
    } catch (error) {
      result.error = error.message;
    } finally {
      await page.close();
    }
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await browser.close();
}
