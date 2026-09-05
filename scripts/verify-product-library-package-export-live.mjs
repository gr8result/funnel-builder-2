import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import puppeteer from "puppeteer";
import { rowsFromCsv } from "../lib/product-library/productLibraryExchange.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "product-library-package-export-live");
fs.mkdirSync(outDir, { recursive: true });

async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated Product Library export verification requires Supabase URL, service role key and anon key.");
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

const { session, supabaseUrl } = await mintSession();
const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl).hostname.split(".")[0]}-auth-token`;
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  defaultViewport: { width: 1600, height: 1000 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
page.setDefaultTimeout(90000);
const runtimeErrors = [];
const failedRequests = [];
page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
page.on("console", (message) => {
  if (message.type() === "error" && /ReferenceError|is not defined|Cannot read|Unhandled Runtime|Maximum update depth/i.test(message.text())) {
    runtimeErrors.push(message.text());
  }
});
page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`));

await page.evaluateOnNewDocument(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: storageKey, value: session });

const client = await page.target().createCDPSession();
await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: outDir });

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='product-library-room-landing']", { visible: true });
  await page.screenshot({ path: path.join(outDir, "product-library-before-export.png"), fullPage: false });
  await openMasterCatalogue();

  const appliancesZip = await downloadPackage({ sectionId: "appliances", categoryId: "", label: "appliances" });
  const tapwareZip = await downloadPackage({ sectionId: "plumbing-fixtures-fittings", categoryId: "tapware", label: "tapware" });
  const appliances = await verifyZip(appliancesZip, "appliances");
  const tapware = await verifyZip(tapwareZip, "tapware");

  await uploadForPreview(appliancesZip);
  await page.screenshot({ path: path.join(outDir, "package-import-preview.png"), fullPage: false });
  await page.waitForSelector("[data-testid='product-library-package-import-preview']", { visible: true });

  if (runtimeErrors.length) throw new Error(`Runtime errors captured:\n${runtimeErrors.join("\n")}`);

  console.log(JSON.stringify({
    ok: true,
    screenshots: [
      path.relative(process.cwd(), path.join(outDir, "product-library-before-export.png")),
      path.relative(process.cwd(), path.join(outDir, "package-import-preview.png")),
    ],
    downloads: {
      appliances,
      tapware,
    },
    failedRequests: failedRequests.filter((entry) => !/hot-update|webpack-hmr/i.test(entry)).slice(0, 10),
  }, null, 2));
} finally {
  await browser.close();
}

async function openMasterCatalogue() {
  const masterOpen = await page.$("[data-admin-surface='master-catalogue'] .master-body");
  if (!masterOpen) {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => /Master Catalogue/i.test(item.textContent || ""));
      button?.click();
    });
  }
  await page.waitForSelector("[data-admin-surface='master-catalogue'] .master-body", { visible: true });
  const dialogOpen = await page.$("[data-testid='product-library-export-dialog']");
  if (!dialogOpen) {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => /Export Package/i.test(item.textContent || ""));
      button?.click();
    });
  }
  await page.waitForSelector("[data-testid='product-library-export-dialog']", { visible: true });
}

async function downloadPackage({ sectionId, categoryId, label }) {
  await page.select("[data-testid='product-library-export-dialog'] select:nth-of-type(1)", "all");
  await page.select("[data-testid='product-library-export-dialog'] select:nth-of-type(2)", sectionId);
  await page.select("[data-testid='product-library-export-dialog'] select:nth-of-type(3)", categoryId);
  await page.select("[data-testid='product-library-export-dialog'] select:nth-of-type(6)", "zip");
  const before = new Set(fs.readdirSync(outDir));
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-testid='product-library-export-dialog'] button")].find((item) => /Download/i.test(item.textContent || ""));
    button?.click();
  });
  const file = await waitForDownload(before, label);
  await openMasterCatalogue();
  return file;
}

async function waitForDownload(before, label) {
  const started = Date.now();
  while (Date.now() - started < 120000) {
    const files = fs.readdirSync(outDir)
      .filter((file) => file.endsWith(".zip") && !file.endsWith(".crdownload") && !before.has(file))
      .map((file) => path.join(outDir, file));
    if (files.length) return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label} ZIP download.`);
}

async function verifyZip(zipPath, label) {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(zipPath));
  const csvFile = zip.file("catalogue.csv");
  const manifestFile = zip.file("manifest.json");
  assert.ok(csvFile, `${label} ZIP must contain catalogue.csv`);
  assert.ok(manifestFile, `${label} ZIP must contain manifest.json`);
  const manifest = JSON.parse(await manifestFile.async("string"));
  const rows = rowsFromCsv(await csvFile.async("string"));
  assert.equal(rows.length, manifest.totals.products, `${label} manifest product total must match CSV rows`);
  for (const row of rows) {
    if (!row.image_path) continue;
    const image = zip.file(row.image_path);
    assert.ok(image, `${label} CSV image path ${row.image_path} must exist in ZIP`);
    const bytes = await image.async("uint8array");
    assert.ok(bytes.length > 0, `${label} CSV image path ${row.image_path} must be non-empty`);
  }
  return {
    file: path.relative(process.cwd(), zipPath),
    products: rows.length,
    productImages: manifest.totals.productImages,
    brandLogos: manifest.totals.brandLogos,
    missingImages: manifest.totals.missingImages,
  };
}

async function uploadForPreview(zipPath) {
  const input = await page.$("[data-testid='product-library-import-catalogue-input']");
  await input.uploadFile(zipPath);
  await page.waitForSelector("[data-testid='product-library-package-import-preview']", { visible: true });
}
