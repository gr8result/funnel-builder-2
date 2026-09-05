import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });

const actualLiveUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "product-library-checkpoint-a");
fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (/^\d\d-.*\.png$/i.test(file)) fs.rmSync(path.join(outDir, file), { force: true });
}

async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated visual verification requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
  if (error) throw error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: verifyError } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
  if (!data?.session?.access_token) throw new Error("Supabase did not return an authenticated session.");
  return data.session;
}

const session = await mintSession();
const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  timeout: 60000,
});

const page = await browser.newPage();
page.setDefaultTimeout(60000);
await page.evaluateOnNewDocument(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: storageKey, value: session });

async function capture(name, url, selector, expectedText = "", options = {}) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(selector, { visible: true, timeout: 45000 });
  if (options.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, { visible: true, timeout: 45000 });
  }
  if (expectedText) {
    await page.waitForFunction((text) => (document.body?.innerText || "").toLowerCase().includes(String(text || "").toLowerCase()), { timeout: 45000 }, expectedText);
  }
  await page.waitForFunction(() => {
    const text = (document.body?.innerText || "").trim();
    return text && text !== "Loading..." && !/^Loading\s*\.\.\.$/i.test(text);
  }, { timeout: 45000 });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const bodyText = await page.evaluate(() => document.body?.innerText || "");
  if (page.url().includes("/login") || /sign in to your account/i.test(bodyText)) {
    throw new Error(`Authenticated visual verification blocked: ${url} redirected to ${page.url()}`);
  }
  await page.evaluate((targetSelector) => {
    document.querySelector(targetSelector)?.scrollIntoView({ block: "start", inline: "nearest" });
  }, selector);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const filePath = path.join(outDir, `${name}.png`);
  if (options.elementScreenshot) {
    let captured = false;
    for (let attempt = 0; !captured && attempt < 6; attempt += 1) {
      await page.waitForSelector(selector, { visible: true, timeout: 45000 });
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { visible: true, timeout: 45000 });
      }
      await page.evaluate((targetSelector) => {
        document.querySelector(targetSelector)?.scrollIntoView({ block: "start", inline: "nearest" });
      }, selector);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const clip = await page.evaluate((targetSelector) => {
        const element = document.querySelector(targetSelector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: Math.max(0, rect.left + window.scrollX),
          y: Math.max(0, rect.top + window.scrollY),
          width: Math.max(1, Math.min(rect.width, window.innerWidth - Math.max(0, rect.left))),
          height: Math.max(1, Math.min(rect.height, window.innerHeight)),
        };
      }, selector);
      if (!clip) continue;
      await page.screenshot({ path: filePath, clip });
      captured = fs.statSync(filePath).size > 30000;
    }
    if (!captured) throw new Error(`Could not capture stable element screenshot for ${selector}`);
  } else {
    await page.screenshot({ path: filePath, fullPage: false });
  }
  return filePath;
}

try {
  await page.setViewport({ width: 1920, height: 1080 });
  const shots = [];
  const url = (query = "") => `${actualLiveUrl}${query ? `&${query}` : ""}`;
  shots.push(await capture("01-browse-by-room-landing", actualLiveUrl, "[data-testid='product-library-room-landing']", "Browse by Room", {
    waitForSelector: "[data-room-key='kitchen']",
    elementScreenshot: true,
  }));
  const landingText = await page.evaluate(() => document.body?.innerText || "");
  if (/20mm Stone Tops/i.test(landingText) || /rice/i.test(landingText)) {
    throw new Error("Old flat Product Library landing content is still visible.");
  }
  shots.push(await capture("02-kitchen-room-categories", url("room=kitchen"), "[data-room-category='kitchen-ovens']", "Kitchen"));
  shots.push(await capture("03-appliances-six-brand-logos", url("catalogue=appliances"), "[data-testid='appliance-brand-list']", "Browse Appliance Brands"));
  const brandText = await page.evaluate(() => document.body?.innerText || "");
  ["Ariston", "Blanco", "Euromaid", "Omega", "Smeg", "Westinghouse"].forEach((brand) => {
    if (!brandText.includes(brand)) throw new Error(`Missing appliance brand card: ${brand}`);
  });
  shots.push(await capture("04-westinghouse-brand-types-packages", url("catalogue=appliances&applianceBrand=Westinghouse"), "[data-testid='appliance-model-list']", "Westinghouse"));
  shots.push(await capture("05-oven-product-grid-models-prices", url("room=kitchen&roomCategory=kitchen-ovens"), "[data-room-product]", "WVE6314DD"));
  const productGridText = await page.evaluate(() => document.body?.innerText || "");
  if (!/WVE6314DD|Westinghouse/i.test(productGridText) || !/Quote required|\$/.test(productGridText)) {
    throw new Error("Oven product grid does not show actual models and pricing status.");
  }
  const badProductImages = await page.evaluate(() => Array.from(document.querySelectorAll("[data-room-product] img"))
    .map((image) => image.getAttribute("src") || image.src || "")
    .filter((source) => /unsplash|rice|fallback/i.test(source)));
  if (badProductImages.length) {
    throw new Error(`Room product grid still contains fallback/stock image URLs: ${badProductImages.join(", ")}`);
  }
  const detailProductId = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("[data-room-product]"));
    const preferred = cards.find((card) => /WVE6314DD/i.test(card.innerText || "")) || cards[0];
    return preferred?.getAttribute("data-room-product") || "";
  });
  if (!detailProductId) throw new Error("Could not resolve a live product card ID for product detail verification.");
  shots.push(await capture("06-product-details-page", url(`room=kitchen&roomCategory=kitchen-ovens&roomProduct=${encodeURIComponent(detailProductId)}`), "[data-testid='product-library-product-detail']", "Stable Product ID"));
  await page.goto(url("browse=all"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-testid='product-library-import-catalogue-input']", { timeout: 30000 });
  const sampleCsv = path.join(outDir, "sample-product-library-import.csv");
  fs.writeFileSync(sampleCsv, [
    "product_code,family_key,brand,product_name,model,description,price_status,price_unit,active,applicable_room_slugs,category_slugs",
    "VISUAL-IMPORT-TEST-001,ovens,Test Brand,Visual Import Test Oven,VIT-600,Preview-only browser verification row,quote_required,each,true,kitchen,kitchen-ovens",
  ].join("\n"));
  const input = await page.$("[data-testid='product-library-import-catalogue-input']");
  await input.uploadFile(sampleCsv);
  await page.waitForSelector("[data-testid='product-library-import-preview']", { visible: true, timeout: 45000 });
  await page.waitForFunction(() => (document.body?.innerText || "").includes("Import Preview"), { timeout: 45000 });
  await page.evaluate(() => {
    document.querySelector("[data-testid='product-library-import-preview']")?.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await new Promise((resolve) => setTimeout(resolve, 350));
  shots.push(path.join(outDir, "07-import-preview-screen.png"));
  await page.screenshot({ path: shots[shots.length - 1], fullPage: false });
  console.log(JSON.stringify({ screenshots: shots.map((shot) => path.relative(process.cwd(), shot)) }, null, 2));
} finally {
  await browser.close();
}
