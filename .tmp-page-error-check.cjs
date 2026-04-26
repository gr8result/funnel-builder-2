const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  for (const url of [
    "http://localhost:3000/p/gr8-business-and-marketing-platform?step=2",
    "http://localhost:3000/modules/website-builder"
  ]) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    const text = await page.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => "<no body text>");
    console.log("URL:", url);
    console.log(text);
    await page.close();
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
