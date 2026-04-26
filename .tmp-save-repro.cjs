const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const logs = [];
  page.on("dialog", async d => { logs.push(`dialog:${d.message()}`); await d.accept(); });
  page.on("console", msg => logs.push(`console:${msg.type()}:${msg.text()}`));
  page.on("pageerror", err => logs.push(`pageerror:${err.message}`));
  await page.goto("http://localhost:3000/modules/funnels/edit/5abbf73a-32f2-46dc-a3b7-0f3b56fa53c0", { waitUntil: "networkidle2", timeout: 60000 });
  const body = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  console.log(body);
  const saveBtn = await page.$x("//button[contains(., 'Save Page') or contains(., 'Save')] ");
  console.log('saveButtons', saveBtn.length);
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
