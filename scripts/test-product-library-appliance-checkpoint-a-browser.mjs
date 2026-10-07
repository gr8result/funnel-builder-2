import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/builders/product-library";
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  timeout: 60000,
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);

try {
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(`${baseUrl}?catalogue=appliances&applianceFamily=ovens`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await Promise.race([
    page.waitForSelector('[data-testid="appliance-brand-list"]', { timeout: 10000 }).catch(() => null),
    page.waitForFunction(() => window.location.pathname.includes("/login"), { timeout: 10000 }).catch(() => null),
  ]);
  if (page.url().includes("/login")) {
    console.log("Product Library appliance Checkpoint A browser test skipped: authenticated local session required.");
    process.exitCode = 0;
    await browser.close();
    process.exit();
  }
  await page.waitForSelector('[data-testid="appliance-brand-list"]', { timeout: 30000 });
  const brands = await page.$$eval("[data-appliance-brand]", (cards) => cards.map((card) => ({
    brand: card.getAttribute("data-appliance-brand"),
    body: card.textContent || "",
    logoSrc: card.querySelector(".appliance-brand-logo img")?.getAttribute("src") || "",
  })));
  assert.deepEqual(brands.map((item) => item.brand).sort(), ["Ariston", "Blanco", "Euromaid", "Omega", "Smeg", "Westinghouse"], "all six brand cards render for ovens");
  brands.forEach((brand) => {
    assert.ok(brand.logoSrc, `${brand.brand} must render a Product Library-owned logo reference`);
    assert.match(brand.body, /model/, `${brand.brand} card must show model count`);
    assert.match(brand.body, /official-source-referenced/, `${brand.brand} card must show logo source status`);
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 2, `desktop appliance brand layout must not clip horizontally; overflow was ${overflow}px`);

  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${baseUrl}?catalogue=appliances&applianceFamily=ovens`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await page.waitForSelector('[data-testid="appliance-brand-list"]', { timeout: 30000 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(mobileOverflow <= 2, `mobile appliance brand layout must not clip horizontally; overflow was ${mobileOverflow}px`);

  console.log("Product Library appliance Checkpoint A browser test passed.");
} finally {
  await browser.close();
}
