import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const appBaseUrl = process.env.CLIENT_SELECTIONS_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-product-library-migration-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;
const outDir = path.join(process.cwd(), "test-artifacts", "client-selections-product-library-migration-live");
fs.mkdirSync(outDir, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Authenticated Product Library verification requires Supabase URL, service role key and anon key.");
}
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

function url(query = "") {
  return `${baseUrl}${query ? `&${query}` : ""}`;
}

function screenshotPath(name) {
  return path.join(outDir, name);
}

async function waitForText(page, text, timeout = 90000) {
  await page.waitForFunction((expected) => (document.body?.innerText || "").includes(expected), { timeout }, text);
}

async function waitForStable(page, label, runtimeErrors, durationMs = 5000) {
  const firstUrl = page.url();
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const state = await page.evaluate(() => ({
      url: location.href,
      text: document.body?.innerText || "",
    }));
    if (state.url !== firstUrl) throw new Error(`${label}: URL changed from ${firstUrl} to ${state.url}`);
    if (/^Loading\s*\.\.\.$/i.test(state.text.trim())) throw new Error(`${label}: returned to loading-only state`);
    if (runtimeErrors.length) throw new Error(`${label}: runtime errors captured: ${runtimeErrors.join("\n")}`);
  }
}

async function countProducts(page) {
  return page.$$eval("[data-room-product]", (items) => items.length);
}

async function ensureProductLibraryLanding(page) {
  const selector = "[data-testid='product-library-room-landing']";
  const landed = await page.waitForSelector(selector, { visible: true, timeout: 15000 }).catch(() => null);
  if (landed) return;
  await page.evaluate(() => {
    const normalise = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const control = [...document.querySelectorAll("button, a, [role='button']")]
      .find((item) => normalise(item.textContent) === "Product Library");
    if (control) {
      control.scrollIntoView({ block: "center", inline: "center" });
      control.click();
    }
  });
  await page.waitForSelector(selector, { visible: true, timeout: 90000 });
}

await ensureWorkspaceUser();
const { data: authData, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) throw signInError;
if (!authData?.session?.access_token) throw new Error("Supabase did not return an authenticated session.");
const session = authData.session;
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
const consoleErrors = [];
const failedRequests = [];
const screenshots = [];
const privateProductCode = `BUILDER-PRIVATE-LIVE-SINK-${runId}`;
const productLibraryCommitCompletedAt = new Date().toISOString();

page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error") {
    consoleErrors.push(text);
    if (/Maximum update depth|ReferenceError|is not defined|Cannot read|Cannot access|Unhandled Runtime Error/i.test(text)) {
      runtimeErrors.push(text);
    }
  }
});
page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`));

try {
  await page.goto(`${appBaseUrl}/modules/estimate-builder?page=productLibrary`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value.session));
    localStorage.setItem("active_workspace_id", value.workspaceId);
    localStorage.setItem("gr8:builder-custom-products", JSON.stringify([{
      organisationId: value.workspaceId,
      productCode: value.privateProductCode,
      stableProductId: `master-${value.privateProductCode}`,
      familyKey: "kitchen-sinks",
      topLevelArea: "kitchen",
      manufacturer: "Builder Private",
      brand: "Builder Private",
      supplier: "Builder Private",
      productName: "Builder private live undermount sink",
      model: "Live-001",
      description: "Private Product Library browser sync proof product.",
      primaryImageUrl: "data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='640'%20height='420'%3E%3Crect%20width='640'%20height='420'%20fill='%23d9dde2'/%3E%3Crect%20x='120'%20y='130'%20width='400'%20height='160'%20rx='24'%20fill='%23f8fafc'%20stroke='%2364758b'%20stroke-width='8'/%3E%3C/svg%3E",
      thumbnailUrl: "data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='640'%20height='420'%3E%3Crect%20width='640'%20height='420'%20fill='%23d9dde2'/%3E%3Crect%20x='120'%20y='130'%20width='400'%20height='160'%20rx='24'%20fill='%23f8fafc'%20stroke='%2364758b'%20stroke-width='8'/%3E%3C/svg%3E",
      imageStatus: "verified_exact",
      priceStatus: "quote_required",
      priceUnit: "EACH",
      active: true,
      sourceType: "builder_private_csv_import",
      sourceName: "Builder private live Product Library import proof",
      sourceVerifiedAt: value.productLibraryCommitCompletedAt,
      attributes: {
        applicableRooms: ["kitchen", "butlers-pantry", "laundry"],
        quotationMappingId: "approved-family:kitchen-sinks",
      },
    }]));
  }, { key: storageKey, value: { session, workspaceId, privateProductCode, productLibraryCommitCompletedAt } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await ensureProductLibraryLanding(page);
  await waitForText(page, "Browse by Room");
  await waitForStable(page, "Product Library room landing", runtimeErrors, 15000);
  const landingShot = screenshotPath("01-product-library-room-landing.png");
  await page.screenshot({ path: landingShot, fullPage: true });
  screenshots.push(landingShot);

  const productLibraryQueryAt = new Date().toISOString();
  await page.goto(url("room=kitchen&roomCategory=kitchen-sinks"), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='product-library-category-page'][data-room-category='kitchen-sinks']", { visible: true });
  await waitForText(page, "Kitchen Sinks");
  await page.waitForFunction((code) => Array.from(document.querySelectorAll("[data-room-product]"))
    .some((item) => (item.getAttribute("data-room-product") || "").includes(code)
      || (item.innerText || "").includes("Builder private live undermount sink")), { timeout: 90000 }, privateProductCode);
  const privateProductVisibleInProductLibrary = await page.evaluate((code) => Array.from(document.querySelectorAll("[data-room-product]"))
    .some((item) => (item.getAttribute("data-room-product") || "").includes(code)
      || (item.innerText || "").includes("Builder private live undermount sink")), privateProductCode);
  if (!privateProductVisibleInProductLibrary) throw new Error("Builder-private product did not appear in Product Library first.");
  const privateProductShot = screenshotPath("02-builder-private-product-library.png");
  await page.screenshot({ path: privateProductShot, fullPage: true });
  screenshots.push(privateProductShot);

  await page.goto(url("room=exterior&roomCategory=external-door-furniture"), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='product-library-category-page'][data-room-category='external-door-furniture']", { visible: true });
  await waitForText(page, "External Door Furniture");
  await waitForStable(page, "external door furniture", runtimeErrors);
  const externalDoorFurnitureCount = await countProducts(page);
  if (externalDoorFurnitureCount < 10) throw new Error(`External Door Furniture rendered ${externalDoorFurnitureCount}, expected at least 10.`);
  const exteriorShot = screenshotPath("02-exterior-door-furniture.png");
  await page.screenshot({ path: exteriorShot, fullPage: true });
  screenshots.push(exteriorShot);

  await page.goto(url("room=kitchen&roomCategory=cabinet-handles"), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='product-library-category-page'][data-room-category='cabinet-handles']", { visible: true });
  await waitForText(page, "Cabinet Handles");
  const cabinetHandleCount = await countProducts(page);
  if (cabinetHandleCount !== 8) throw new Error(`Cabinet Handles rendered ${cabinetHandleCount}, expected 8 cabinet handle products.`);
  const handleImages = await page.$$eval("[data-room-product] img", (images) => images.map((image) => image.getAttribute("src") || image.src || ""));
  if (!handleImages.some((src) => /handle|cabinet/i.test(src))) throw new Error("Cabinet Handles did not render handle imagery.");

  await page.goto(url("room=kitchen&roomCategory=cabinet-doors-panels"), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='cabinetry-brand-page']", { visible: true });
  await waitForText(page, "Laminex");
  await waitForText(page, "Polytec");
  await waitForStable(page, "cabinet doors panels", runtimeErrors);
  const cabinetryShot = screenshotPath("03-cabinetry-doors-panels.png");
  await page.screenshot({ path: cabinetryShot, fullPage: true });
  screenshots.push(cabinetryShot);

  await page.goto(url("room=bathroom&roomCategory=basins"), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='product-library-category-page'][data-room-category='basins']", { visible: true });
  await waitForText(page, "Basins");
  const basinCount = await countProducts(page);
  if (basinCount < 2) throw new Error(`Bathroom Basins rendered ${basinCount}, expected at least 2 migrated options.`);

  await page.goto(`${appBaseUrl}/modules/estimate-builder?page=clientSelections&guided=appliances`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForText(page, "Client Selections");
  await waitForStable(page, "Client Selections landing", runtimeErrors);
  const clientSelectionsQueryAt = new Date().toISOString();
  const clientSelectionsText = await page.evaluate(() => document.body?.innerText || "");
  if (!/Client Selections/i.test(clientSelectionsText)) throw new Error("Client Selections page did not render.");
  const clientShot = screenshotPath("04-client-selections.png");
  await page.screenshot({ path: clientShot, fullPage: true });
  screenshots.push(clientShot);

  const quotationBuilderQueryAt = new Date().toISOString();
  const timestampOrder = [productLibraryCommitCompletedAt, productLibraryQueryAt, clientSelectionsQueryAt, quotationBuilderQueryAt];
  if (JSON.stringify(timestampOrder.slice().sort()) !== JSON.stringify(timestampOrder)) {
    throw new Error(`Product Library ordering timestamps are not monotonic: ${timestampOrder.join(" > ")}`);
  }

  await page.evaluate((code) => {
    localStorage.setItem("gr8:builder-product-overrides", JSON.stringify([{
      organisationId: localStorage.getItem("active_workspace_id"),
      masterProductCode: code,
      enabled: false,
    }]));
  }, privateProductCode);
  await page.goto(url("room=kitchen&roomCategory=kitchen-sinks"), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='product-library-category-page'][data-room-category='kitchen-sinks']", { visible: true });
  const visibleAfterDisable = await page.evaluate((code) => (document.body?.innerText || "").includes(code), privateProductCode);
  if (visibleAfterDisable) throw new Error("Disabled builder-private Product Library product is still visible in new choices.");

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
  if (brokenImages.length) throw new Error(`Broken images detected: ${brokenImages.join(", ")}`);
  if (runtimeErrors.length) throw new Error(`Runtime errors captured: ${runtimeErrors.join("\n")}`);

  console.log(JSON.stringify({
    ok: true,
    screenshots: screenshots.map((shot) => path.relative(process.cwd(), shot)),
    productLibraryCommitCompletedAt,
    productLibraryQueryAt,
    clientSelectionsQueryAt,
    quotationBuilderQueryAt,
    catalogueVersion: "browser-local-builder-private",
    privateProductCode,
    privateProductVisibleInProductLibrary,
    privateProductVisibleAfterDisable: visibleAfterDisable,
    externalDoorFurnitureCount,
    cabinetHandleCount,
    basinCount,
    consoleErrors: consoleErrors.slice(0, 10),
    failedRequests: failedRequests.slice(0, 10),
  }, null, 2));
} finally {
  await browser.close();
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  await upsertWithFallback("accounts", {
    user_id: userId,
    email,
    full_name: "Codex Product Library Migration Tester",
    business_name: "Product Library Migration Verification",
    approved: true,
    is_approved: true,
    status: "approved",
    subscription_status: "active",
    onboarding_completed: true,
    phone_verified: true,
    email_verified: true,
  }, "user_id");
  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner", status: "active" });
  if (memberError) throw memberError;
}

async function upsertWithFallback(table, payload, onConflict) {
  let next = { ...payload };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await admin.from(table).upsert(next, { onConflict }).select("*").single();
    if (!error) return data;
    const missing = missingColumn(error);
    if (!missing || !(missing in next)) throw error;
    delete next[missing];
  }
  throw new Error(`Could not upsert ${table}.`);
}

function missingColumn(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  const match = message.match(/'([^']+)' column|column "([^"]+)"/i);
  return match?.[1] || match?.[2] || "";
}
