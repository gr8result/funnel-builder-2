import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
import { createApplianceCatalogueSelectors } from "../lib/product-library/applianceCatalogueSelectorsCore.js";

dotenv.config({ path: ".env.local", quiet: true });

const productCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-CATALOGUE.json", "utf8"));
const packCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-PACKS.json", "utf8"));
const brandCatalogue = JSON.parse(fs.readFileSync("data/product-library/catalogues/appliances/AU-APPLIANCE-BRANDS.json", "utf8"));
const selectors = createApplianceCatalogueSelectors({ productCatalogue, packCatalogue, brandCatalogue });

const liveUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "product-library-appliance-visual-catalogue-live");
fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (/^\d\d-.*\.png$/i.test(file)) fs.rmSync(path.join(outDir, file), { force: true });
}

async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated live verification requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
  if (error) throw error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: verifyError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyError) throw verifyError;
  if (!data?.session?.access_token) throw new Error("Supabase did not return an authenticated session.");
  return data.session;
}

function url(query = "") {
  return `${liveUrl}${query ? `&${query}` : ""}`;
}

async function settle(page) {
  await page.waitForFunction(() => {
    const text = document.body?.innerText || "";
    return text.trim().length > 0 && !/^Loading\s*\.\.\.$/i.test(text.trim());
  }, { timeout: 45000 });
  await new Promise((resolve) => setTimeout(resolve, 850));
}

async function capture(page, name, selector, expectedText = "") {
  await page.waitForSelector(selector, { visible: true, timeout: 45000 });
  await settle(page);
  if (expectedText) {
    await page.waitForFunction((text) => (document.body?.innerText || "").includes(text), { timeout: 45000 }, expectedText);
  }
  await page.evaluate((targetSelector) => document.querySelector(targetSelector)?.scrollIntoView({ block: "start", inline: "nearest" }), selector);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const filePath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return path.relative(process.cwd(), filePath);
}

async function gotoStable(page, targetUrl, selector, expectedText = "") {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 45000 });
  } catch (selectorError) {
    const selectorFailureShot = path.join(outDir, "failure-missing-selector.png");
    await page.screenshot({ path: selectorFailureShot, fullPage: false });
    const body = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
    throw new Error(`Missing selector ${selector} at ${targetUrl}; current URL ${page.url()}; body excerpt: ${body.slice(0, 1500)}; ${selectorError.message}`);
  }
  await settle(page);
  const body = await page.evaluate(() => document.body?.innerText || "");
  if (page.url().includes("/login") || /sign in to your account/i.test(body)) throw new Error(`Authenticated route redirected to ${page.url()}`);
  if (expectedText && !body.toLowerCase().includes(String(expectedText).toLowerCase())) {
    const failureShot = path.join(outDir, "failure-current-page.png");
    await page.screenshot({ path: failureShot, fullPage: false });
    const sectionText = await page.evaluate((targetSelector) => document.querySelector(targetSelector)?.innerText || "", selector).catch(() => "");
    throw new Error(`Expected "${expectedText}" was not visible at ${targetUrl}; current URL ${page.url()}; section text: ${sectionText.slice(0, 1000)}; body excerpt: ${body.slice(0, 1000)}`);
  }
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
await page.setViewport({ width: 1920, height: 1080 });
await page.evaluateOnNewDocument(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: storageKey, value: session });

const consoleEntries = [];
const failedRequests = [];
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) consoleEntries.push({ type: message.type(), text: message.text() });
});
page.on("pageerror", (error) => consoleEntries.push({ type: "pageerror", text: error.message }));
page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "" }));

try {
  const shots = [];
  const brands = ["Ariston", "Blanco", "Euromaid", "Omega", "Smeg", "Westinghouse"];

  await gotoStable(page, url("catalogue=appliances"), "[data-testid='appliance-brand-list']", "Browse Appliance Brands");
  const brandText = await page.evaluate(() => document.body?.innerText || "");
  for (const brand of brands) {
    if (!brandText.includes(brand)) throw new Error(`Missing appliance brand: ${brand}`);
  }
  const visibleLogos = await page.$$eval("[data-testid='appliance-brand-list'] .appliance-brand-logo img", (images) => images.length);
  if (visibleLogos < 6) throw new Error(`Expected six appliance brand logos, found ${visibleLogos}`);
  shots.push(await capture(page, "01-appliance-brand-landing", "[data-testid='appliance-brand-list']", "Browse Brand"));

  await gotoStable(page, url("catalogue=appliances&applianceBrand=Omega&applianceFamily=ovens"), "[data-appliance-category='ovens']", "Omega");
  const omegaExpected = selectors.getApplianceModelsByFamilyAndBrand("ovens", "Omega").length;
  const omegaCards = await page.$$eval("[data-appliance-category='ovens'] [data-appliance-product]", (cards) => cards.length);
  if (omegaCards !== omegaExpected) throw new Error(`Omega ovens expected ${omegaExpected}, found ${omegaCards}`);
  shots.push(await capture(page, "02-omega-ovens-visual-grid", "[data-appliance-category='ovens']", "Ovens"));

  await gotoStable(page, url("catalogue=appliances&applianceBrand=Euromaid&applianceFamily=ovens"), "[data-appliance-category='ovens']", "Euromaid");
  const euromaidOvenImages = await page.$$eval("[data-appliance-category='ovens'] [data-appliance-product] img", (images) => images.map((image) => image.getAttribute("src") || ""));
  if (!euromaidOvenImages.some((source) => /eo605dtb|eo916astb/i.test(source))) throw new Error("Euromaid oven grid did not render the verified exact local images.");
  shots.push(await capture(page, "03-euromaid-ovens-verified-images", "[data-appliance-category='ovens']", "EO605DTB"));

  const pathChecks = [
    ["04-cooktops-row", "Euromaid", "cooktops", "Cooktops"],
    ["05-rangehoods-row", "Westinghouse", "rangehoods", "Rangehoods"],
    ["06-dishwashers-row", "Smeg", "dishwashers", "Dishwashers"],
    ["07-freestanding-row", "Omega", "freestanding-cookers", "Freestanding Cookers"],
  ];
  for (const [shot, brand, family, text] of pathChecks) {
    await gotoStable(page, url(`catalogue=appliances&applianceBrand=${encodeURIComponent(brand)}&applianceFamily=${family}`), `[data-appliance-category='${family}']`, text);
    const count = await page.$$eval(`[data-appliance-category='${family}'] [data-appliance-product]`, (cards) => cards.length);
    if (count < 1) throw new Error(`${brand} ${family} did not render product cards.`);
    shots.push(await capture(page, shot, `[data-appliance-category='${family}']`, text));
  }

  await gotoStable(page, url("catalogue=appliances&applianceBrand=Omega&applianceFamily=microwaves"), "[data-appliance-category='microwaves']", "No microwaves models");
  await gotoStable(page, url("catalogue=appliances&applianceBrand=Omega&applianceFamily=fridges"), "[data-appliance-category='fridges']", "No refrigerators models");

  await gotoStable(page, url("catalogue=appliances&applianceBrand=Westinghouse&applianceFamily=appliance-packs"), "[data-appliance-category='appliance-packs']", "Complete Appliance Packages");
  const packageComponents = await page.$$eval("[data-testid='appliance-package-card'] .visual-components button", (buttons) => buttons.length);
  if (packageComponents < 1) throw new Error("Package cards did not render visual component cards.");
  shots.push(await capture(page, "08-package-components", "[data-appliance-category='appliance-packs']", "Select Package"));

  await gotoStable(page, url("catalogue=appliances&applianceBrand=Euromaid&applianceFamily=ovens"), "[data-appliance-category='ovens']", "EO605DTB");
  await page.select(".appliance-filters select:last-of-type", "price-desc").catch(() => {});
  await page.waitForFunction(() => (document.body?.innerText || "").includes("EO916ASTB"), { timeout: 45000 });
  const detailProduct = selectors.getApplianceModelsByFamilyAndBrand("ovens", "Euromaid").find((record) => /EO605DTB/i.test(record.model)) || selectors.getApplianceModelsByFamilyAndBrand("ovens", "Euromaid")[0];
  await gotoStable(page, url(`catalogue=appliances&applianceBrand=Euromaid&applianceFamily=ovens&applianceProduct=${encodeURIComponent(detailProduct.productId)}`), ".appliance-detail-layout", detailProduct.model);
  const detailText = await page.evaluate(() => document.body?.innerText || "");
  for (const expected of [detailProduct.model, "Product Code", "Price / Status", "Image Attribution"]) {
    if (!detailText.toLowerCase().includes(String(expected).toLowerCase())) {
      const detailFailureShot = path.join(outDir, "failure-detail-page.png");
      await page.screenshot({ path: detailFailureShot, fullPage: false });
      const detailSectionText = await page.evaluate(() => document.querySelector(".appliance-detail-layout")?.innerText || "");
      throw new Error(`Detail page missing ${expected}; section text: ${detailSectionText.slice(0, 1500)}`);
    }
  }
  const detailImage = await page.$eval(".appliance-detail-layout .family-hero img", (image) => image.getAttribute("src") || "");
  if (!/eo605dtb|eo916astb/i.test(detailImage)) throw new Error(`Detail image was not an exact Euromaid product image: ${detailImage}`);
  shots.push(await capture(page, "09-600mm-detail-page", ".appliance-detail-layout", detailProduct.model));

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".appliance-detail-layout", { visible: true, timeout: 45000 });
  if (!page.url().includes("applianceProduct=")) throw new Error("Refresh did not preserve the product detail route.");
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("[data-appliance-category='ovens']", { visible: true, timeout: 45000 });

  const currentUrl = page.url();
  await new Promise((resolve) => setTimeout(resolve, 15000));
  if (page.url() !== currentUrl) throw new Error(`URL changed during 15 second stability check: ${currentUrl} -> ${page.url()}`);

  const acceptedConsole = consoleEntries.filter((entry) => !/img|Image|next lint/i.test(entry.text));
  if (acceptedConsole.some((entry) => /Maximum update depth|Minified React error|ReferenceError|TypeError|Unhandled Runtime|not defined/i.test(entry.text))) {
    throw new Error(`Console/runtime errors detected: ${JSON.stringify(acceptedConsole, null, 2)}`);
  }

  console.log(JSON.stringify({
    screenshots: shots,
    consoleWarnings: consoleEntries,
    failedRequests: failedRequests.slice(0, 20),
    stableUrl: currentUrl,
    counts: {
      brands: brands.length,
      products: productCatalogue.products.length,
      packages: packCatalogue.packs.length,
      relationships: packCatalogue.relationships.length,
      verifiedImages: productCatalogue.products.filter((record) => /^verified-/.test(record.imageStatus || "")).length,
      missingExactImages: productCatalogue.products.filter((record) => record.imageStatus === "exact-image-unavailable").length,
    },
  }, null, 2));
} finally {
  await browser.close();
}
