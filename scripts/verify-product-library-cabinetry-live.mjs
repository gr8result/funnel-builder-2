import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "product-library-cabinetry-live");
fs.mkdirSync(outDir, { recursive: true });

async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated Product Library verification requires Supabase URL, service role key and anon key.");
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
  return { session: data.session, supabaseUrl };
}

function url(query = "") {
  return `${baseUrl}${query ? `&${query}` : ""}`;
}

async function waitForSettledPage(page, selector, text = "") {
  await page.waitForSelector(selector, { visible: true, timeout: 90000 });
  if (text) {
    await page.waitForFunction((expected) => (document.body?.innerText || "").includes(expected), { timeout: 90000 }, text);
  }
  await page.waitForFunction(() => {
    const textContent = (document.body?.innerText || "").trim();
    return textContent && !/^Loading\s*\.\.\.$/i.test(textContent);
  }, { timeout: 90000 });
  await new Promise((resolve) => setTimeout(resolve, 750));
}

async function assertStable(page, label, runtimeErrors, durationMs = 15000) {
  const firstUrl = page.url();
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const state = await page.evaluate(() => ({
      url: location.href,
      text: document.body?.innerText || "",
    }));
    if (state.url !== firstUrl) throw new Error(`${label}: URL changed from ${firstUrl} to ${state.url}`);
    if (/^Loading\s*\.\.\.$/i.test(state.text.trim())) throw new Error(`${label}: page returned to loading-only state`);
    if (runtimeErrors.length) throw new Error(`${label}: runtime errors captured: ${runtimeErrors.join("\n")}`);
  }
}

function imageUrlFromCss(value = "") {
  return String(value || "").replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
}

const { session, supabaseUrl } = await mintSession();
const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl).hostname.split(".")[0]}-auth-token`;
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  defaultViewport: { width: 1920, height: 1080 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
page.setDefaultTimeout(90000);
const runtimeErrors = [];
const consoleWarnings = [];
const failedRequests = [];
const urlSamples = [];

page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error" && /Maximum update depth|ReferenceError|is not defined|Cannot read|Cannot access|Unhandled Runtime Error/i.test(text)) {
    runtimeErrors.push(text);
  }
  if (message.type() === "warning") consoleWarnings.push(text);
});
page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`));
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) urlSamples.push(page.url());
});

await page.evaluateOnNewDocument(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: storageKey, value: session });

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForSettledPage(page, "[data-testid='product-library-room-landing']", "Browse by Room");
  await assertStable(page, "room landing", runtimeErrors, 15000);

  const roomAudit = await page.evaluate(() => Array.from(document.querySelectorAll("[data-room-key]")).map((card) => {
    const image = card.querySelector(".tile-image");
    return {
      key: card.getAttribute("data-room-key"),
      text: card.innerText,
      backgroundImage: getComputedStyle(image).backgroundImage,
    };
  }));
  const expectedRooms = ["kitchen", "butlers-pantry", "bathroom", "ensuite", "powder-room", "laundry", "living-areas", "bedrooms", "internal-areas", "exterior", "garage", "alfresco-outdoor"];
  for (const room of expectedRooms) {
    const match = roomAudit.find((item) => item.key === room);
    if (!match) throw new Error(`Missing room card: ${room}`);
    if (!match.backgroundImage || match.backgroundImage === "none") throw new Error(`Missing room image: ${room}`);
  }
  const uniqueRoomImages = new Set(roomAudit.map((item) => imageUrlFromCss(item.backgroundImage)));
  if (uniqueRoomImages.size !== roomAudit.length) throw new Error(`Room cards do not have unique images: ${JSON.stringify(roomAudit, null, 2)}`);
  const landingShot = path.join(outDir, "01-room-landing.png");
  await page.screenshot({ path: landingShot, fullPage: true });

  await page.click("[data-room-key='kitchen']");
  await waitForSettledPage(page, "[data-room-category='cabinet-doors-panels']", "Kitchen");
  const cabinetDoorTileImage = await page.$eval("[data-room-category='cabinet-doors-panels'] .tile-image", (element) => getComputedStyle(element).backgroundImage);
  if (!cabinetDoorTileImage.includes("cabinet-doors-panels-standard-base-cupboards")) {
    throw new Error(`Cabinet Doors & Panels category asset was not used: ${cabinetDoorTileImage}`);
  }
  await page.click("[data-room-category='cabinet-doors-panels']");
  await waitForSettledPage(page, "[data-testid='cabinetry-brand-page']", "Cabinet Doors & Panels");
  await assertStable(page, "cabinetry brand page", runtimeErrors, 5000);

  const cabinetryShot = path.join(outDir, "02-cabinetry-doors-panels.png");
  await page.screenshot({ path: cabinetryShot, fullPage: true });
  const brandText = await page.evaluate(() => document.body?.innerText || "");
  if (!brandText.includes("Laminex") || !brandText.includes("Polytec")) throw new Error("Cabinet Doors & Panels brand page must show Laminex and Polytec.");
  const cabinetImageAudit = await page.evaluate(() => ({
    body: document.body?.innerText || "",
    backgrounds: Array.from(document.querySelectorAll(".tile-image")).map((element) => getComputedStyle(element).backgroundImage),
    images: Array.from(document.querySelectorAll("img")).map((image) => image.getAttribute("src") || image.src || ""),
  }));
  const allImagesText = JSON.stringify(cabinetImageAudit).toLowerCase();
  if (allImagesText.includes("1556228720") || allImagesText.includes("curology")) throw new Error("Rejected cosmetics image is still visible on the cabinetry page.");

  await page.click("[data-cabinetry-brand='Laminex']");
  await waitForSettledPage(page, "[data-testid='cabinetry-range-page']", "Laminex");
  const rangeCount = await page.$$eval("[data-cabinetry-range]", (items) => items.length);
  if (rangeCount < 1) throw new Error("Laminex range page did not render any ranges.");
  await page.click("[data-cabinetry-range]");
  await waitForSettledPage(page, "[data-testid='cabinetry-colour-grid']", "Colour Details");
  const laminexColourCount = await page.$$eval("[data-cabinetry-colour-id]", (items) => items.length);
  if (laminexColourCount < 1) throw new Error("Laminex colour grid did not render any swatches.");

  await page.goBack({ waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForSettledPage(page, "[data-testid='cabinetry-range-page']", "Laminex");
  await assertStable(page, "browser back to range", runtimeErrors, 5000);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForSettledPage(page, "[data-testid='cabinetry-range-page']", "Laminex");
  await assertStable(page, "refresh range", runtimeErrors, 5000);

  await page.goto(url("room=kitchen&roomCategory=cabinet-handles"), { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForSettledPage(page, "[data-room-product]", "Cabinet Handles");
  const handleAudit = await page.evaluate(() => JSON.stringify(Array.from(document.querySelectorAll("[data-room-product] img")).map((image) => image.getAttribute("src") || image.src || "")));
  if (!handleAudit.includes("cabinet-handles-handle-house-c3") && !handleAudit.includes("handlehouse.com.au")) {
    throw new Error("Cabinet Handles page did not render actual Handle House imagery.");
  }

  const brokenImages = await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(images.map((image) => image.complete ? null : new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
    return images
      .filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => image.getAttribute("src") || image.src || "");
  });
  if (brokenImages.length) throw new Error(`Broken Product Library images after refresh/navigation: ${brokenImages.join(", ")}`);
  if (runtimeErrors.length) throw new Error(`Runtime errors captured: ${runtimeErrors.join("\n")}`);

  console.log(JSON.stringify({
    ok: true,
    screenshots: [landingShot, cabinetryShot].map((shot) => path.relative(process.cwd(), shot)),
    roomCards: roomAudit.length,
    uniqueRoomImages: uniqueRoomImages.size,
    laminexRangeCount: rangeCount,
    laminexVisibleColours: laminexColourCount,
    consoleWarnings: consoleWarnings.slice(0, 10),
    failedRequests: failedRequests.slice(0, 10),
    urlSamples,
  }, null, 2));
} finally {
  await browser.close();
}
