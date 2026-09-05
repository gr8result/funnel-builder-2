import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const baseUrl = process.env.PRODUCT_LIBRARY_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=productLibrary";
const ownerEmail = process.env.PRODUCT_LIBRARY_TEST_EMAIL || "support@gr8result.com";
const outDir = path.join(process.cwd(), "test-artifacts", "product-library-runtime-stability");
fs.mkdirSync(outDir, { recursive: true });

async function mintSession() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Authenticated runtime verification requires Supabase URL, service role key and anon key.");
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
  defaultViewport: { width: 1440, height: 980 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
page.setDefaultTimeout(90000);
const runtimeErrors = [];
const urlSamples = [];
page.on("pageerror", (error) => runtimeErrors.push(error.stack || error.message));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error" && /Maximum update depth|ReferenceError|is not defined|Cannot read|Cannot access|Unhandled Runtime Error/i.test(text)) {
    runtimeErrors.push(text);
  }
});

await page.evaluateOnNewDocument(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: storageKey, value: session });

async function assertStable(label, durationMs = 15000) {
  const started = Date.now();
  const firstUrl = page.url();
  while (Date.now() - started < durationMs) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const state = await page.evaluate(() => ({
      url: location.href,
      text: document.body?.innerText || "",
    }));
    urlSamples.push({ label, url: state.url });
    if (state.url !== firstUrl) throw new Error(`${label}: URL changed from ${firstUrl} to ${state.url}`);
    if (/^Loading\s*\.\.\.$/i.test(state.text.trim())) throw new Error(`${label}: page returned to loading-only state`);
  }
}

async function waitForText(text) {
  await page.waitForFunction((expected) => (document.body?.innerText || "").includes(expected), {}, text);
}

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='product-library-room-landing']", { visible: true });
  await waitForText("Browse by Room");
  await assertStable("landing");
  await page.screenshot({ path: path.join(outDir, "runtime-landing-stable.png"), fullPage: false });

  await page.click("[data-room-key='kitchen']");
  await waitForText("Kitchen");
  await assertStable("kitchen", 5000);

  await page.goto(`${baseUrl}&catalogue=appliances`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-testid='appliance-brand-list']", { visible: true });
  await waitForText("Browse Appliance Brands");
  await assertStable("appliances", 5000);

  await page.goBack({ waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForText("Kitchen");
  await assertStable("browser-back", 5000);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForText("Kitchen");
  await assertStable("refresh", 5000);

  const bodyText = await page.evaluate(() => document.body?.innerText || "");
  if (/20mm Stone Tops/i.test(bodyText)) throw new Error("Old flat Product Library landing replaced the room route.");
  if (runtimeErrors.length) throw new Error(`Runtime errors captured: ${runtimeErrors.join("\n")}`);
  console.log(JSON.stringify({
    ok: true,
    screenshot: path.relative(process.cwd(), path.join(outDir, "runtime-landing-stable.png")),
    urlSamples: urlSamples.length,
  }, null, 2));
} finally {
  await browser.close();
}
