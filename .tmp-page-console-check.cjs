const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  for (const url of [
    "http://localhost:3000/p/gr8-business-and-marketing-platform?step=2",
    "http://localhost:3000/modules/website-builder"
  ]) {
    const page = await browser.newPage();
    const logs = [];
    page.on("console", msg => logs.push(`console:${msg.type()}: ${msg.text()}`));
    page.on("pageerror", err => logs.push(`pageerror: ${err.message}`));
    page.on("requestfailed", req => logs.push(`requestfailed: ${req.url()} :: ${req.failure()?.errorText}`));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(err => logs.push(`gotoerror: ${err.message}`));
    await new Promise(r => setTimeout(r, 3000));
    console.log("URL:", url);
    console.log(logs.join("\n") || "<no console errors>");
    await page.close();
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
