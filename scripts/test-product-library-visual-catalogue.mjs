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
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  if (page.url().includes("/login")) {
    console.log("Product Library visual catalogue browser tests skipped: authenticated local session required.");
    process.exitCode = 0;
    await browser.close();
    process.exit();
  }
  await page.waitForSelector("[data-area-key]", { timeout: 30000 });

  const areaCards = await page.$$eval("[data-area-key]", (cards) => cards.map((card) => ({
    key: card.getAttribute("data-area-key"),
    title: card.querySelector("strong")?.textContent?.trim(),
    image: card.querySelector(".tile-image")?.style.backgroundImage || "",
    body: card.textContent || "",
  })));
  assert.deepEqual(areaCards.map((card) => card.title), [
    "Appliances",
    "Exterior",
    "Interior",
    "Kitchen",
    "Bathroom & Ensuite",
    "Laundry",
    "Bedrooms",
    "Living Areas",
    "Garage",
    "Outdoor Areas",
    "Pool",
  ], "Product Library must open with the approved area cards");
  areaCards.forEach((card) => {
    assert.match(card.image, /images\.unsplash\.com/, `${card.title} must render a visual image`);
    assert.match(card.body, /\d+ products?/, `${card.title} must show product count`);
    assert.match(card.body, /Ready|Needs products/, `${card.title} must show status`);
  });
  assert.equal(new Set(areaCards.map((card) => card.image)).size, areaCards.length, "area cards must not reuse the same image");

  await verifyCategoryFlow("exterior", "exterior-bricks", "bricks", "Bricks");
  await verifyCategoryFlow("kitchen", "kitchen-ovens", "ovens", "Ovens");
  await verifyCategoryFlow("interior", "interior-internal-doors", "internal-doors", "Internal Doors");

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (page.url().includes("/login")) {
    throw new Error("Product Library browser verification requires an authenticated local session; the route redirected to login.");
  }
  await page.waitForSelector('[data-area-key="bathroom-ensuite"]', { timeout: 30000 });
  await page.click('[data-area-key="bathroom-ensuite"]');
  await page.waitForSelector('[data-category-key="bathroom-ensuite-tapware"]', { timeout: 30000 });
  const tapwareImage = await page.$eval('[data-category-key="bathroom-ensuite-tapware"] .tile-image', (node) => node.style.backgroundImage);
  const tileImage = await page.$eval('[data-category-key="bathroom-ensuite-floor-tiles"] .tile-image', (node) => node.style.backgroundImage);
  assert.notEqual(tapwareImage, tileImage, "Tapware and Tiles must not reuse one unrelated image");

  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (page.url().includes("/login")) {
    throw new Error("Product Library browser verification requires an authenticated local session; the route redirected to login.");
  }
  await page.waitForSelector("[data-area-key]", { timeout: 30000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 2, `mobile layout must not clip horizontally; overflow was ${overflow}px`);

  console.log("Product Library visual catalogue browser tests passed.");
} finally {
  await browser.close();
}

async function verifyCategoryFlow(areaKey, categoryKey, familyKey, expectedTitle) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (page.url().includes("/login")) {
    throw new Error("Product Library browser verification requires an authenticated local session; the route redirected to login.");
  }
  await page.waitForSelector(`[data-area-key="${areaKey}"]`, { timeout: 30000 });
  await page.click(`[data-area-key="${areaKey}"]`);
  await page.waitForSelector(`[data-category-key="${categoryKey}"]`, { timeout: 30000 });

  const categoryCard = await page.$eval(`[data-category-key="${categoryKey}"]`, (card) => ({
    title: card.querySelector("strong")?.textContent?.trim(),
    image: card.querySelector(".tile-image")?.style.backgroundImage || "",
    body: card.textContent || "",
  }));
  assert.equal(categoryCard.title, expectedTitle, `${expectedTitle} category card must render`);
  assert.match(categoryCard.image, /images\.unsplash\.com/, `${expectedTitle} category must render an image`);
  assert.match(categoryCard.body, /\d+ products?/, `${expectedTitle} category must show product count`);
  assert.match(categoryCard.body, /Ready|Needs products/, `${expectedTitle} category must show status`);

  await page.click(`[data-category-key="${categoryKey}"]`);
  await page.waitForSelector(`[data-family-key="${familyKey}"], .empty-state`, { timeout: 30000 });
  const categoryTitle = await page.$eval(".banner-copy h1", (node) => node.textContent.trim());
  assert.equal(categoryTitle, expectedTitle, `${expectedTitle} route must keep the exact category title`);

  const familyButton = await page.$(`[data-family-key="${familyKey}"]`);
  if (familyButton) {
    await familyButton.click();
    await page.waitForSelector(".family-main", { timeout: 30000 });
    const emptyText = await page.evaluate(() => document.body.textContent);
    assert.match(emptyText, /No products have been added for this category yet\./, `${expectedTitle} empty state must be useful`);
    assert.match(emptyText, /Add Product/, `${expectedTitle} empty state must offer Add Product`);
    assert.match(emptyText, /Import Products/, `${expectedTitle} empty state must offer Import Products`);
    assert.match(emptyText, /Back/, `${expectedTitle} empty state must offer Back`);
    await page.click(".back-button");
    await page.waitForSelector(`[data-family-key="${familyKey}"]`, { timeout: 30000 });
  }

  await page.click(".back-button");
  await page.waitForSelector(`[data-category-key="${categoryKey}"]`, { timeout: 30000 });
  await page.click(".back-button");
  await page.waitForSelector(`[data-area-key="${areaKey}"]`, { timeout: 30000 });
}
