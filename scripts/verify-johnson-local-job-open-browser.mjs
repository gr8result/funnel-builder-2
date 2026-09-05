import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const baseUrl = process.env.JOHNSON_VERIFY_BASE_URL || "http://localhost:3000";
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const projectId = "896be24f-a7fb-4a8e-b652-495fdcaa7fe2";
const projectSearchText = "Johnson 07-123";
const johnsonPdfSha256 = "2a66a30ea0879629ac9d55b91a504705b9dae6c10ab3e7160d49a78b112b19d0";
const jobFilePath = "C:\\Users\\grant\\Downloads\\Johnson 123.gr8job";
const outDir = path.join(root, "test-results", "johnson-local-job-open");
const downloadDir = path.join(outDir, "downloads");

if (!fs.existsSync(jobFilePath)) throw new Error(`Missing recovered job file: ${jobFilePath}`);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });
for (const name of ["browser-console.log", "browser-network-errors.log"]) {
  fs.rmSync(path.join(outDir, name), { force: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing Supabase environment values.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `codex-johnson-local-${runId}@example.test`;
const password = `Codex-${runId}-Pass!`;

const user = await ensureWorkspaceUser();
const auth = await signIn();
const browser = await puppeteer.launch({
  headless: false,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  userDataDir: path.join(outDir, `.browser-profile-${runId}`),
  defaultViewport: { width: 1540, height: 1050 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1540,1050"],
});

const evidence = { workspaceId, projectId, localJobFile: jobFilePath, userId: user.id, screenshots: {} };

try {
  const page = await browser.newPage();
  await enableDownloads(page);
  page.setDefaultTimeout(120000);
  page.on("pageerror", (error) => fs.appendFileSync(path.join(outDir, "browser-console.log"), `pageerror ${error.stack || error.message}\n`));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) fs.appendFileSync(path.join(outDir, "browser-console.log"), `${message.type()} ${message.text()}\n`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) fs.appendFileSync(path.join(outDir, "browser-network-errors.log"), `${response.status()} ${response.url()}\n`);
  });

  await primeBrowserSession(page, auth.session);
  await goto(page, `${baseUrl}/modules/estimate-builder?page=projectEstimate`, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Project Estimate", 120000);

  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]', { timeout: 120000 });
  await input.uploadFile(jobFilePath);
  await waitForBodyText(page, projectSearchText, 120000);
  await waitForBodyText(page, "Bob & May Johnson", 120000);
  await waitForBodyText(page, "Issued Project Estimate PDF - 21 pages", 120000);
  await waitForImportedPage(page, 1);

  evidence.initialState = await projectEstimateRenderState(page);
  assertCleanState(evidence.initialState);
  evidence.navigatorCountInitial = await projectEstimateNavigatorCount(page);
  if (evidence.navigatorCountInitial !== 21) throw new Error(`Expected 21 Project Estimate pages, saw ${evidence.navigatorCountInitial}`);
  evidence.visiblePageInitial = await visibleImportedPageAlt(page);
  evidence.screenshots.page1 = await screenshot(page, "johnson-local-open-page-01.png");

  await clickExactPageButton(page, "Project Estimate 19");
  await waitForImportedPage(page, 19);
  evidence.visiblePage19 = await visibleImportedPageAlt(page);
  evidence.screenshots.page19 = await screenshot(page, "johnson-local-open-page-19-price.png");

  await clickExactPageButton(page, "Project Estimate 21");
  await waitForImportedPage(page, 21);
  evidence.visiblePage21 = await visibleImportedPageAlt(page);
  evidence.screenshots.page21 = await screenshot(page, "johnson-local-open-page-21-acknowledgement.png");

  await page.reload({ waitUntil: "networkidle2", timeout: 120000 });
  await waitForBodyText(page, "Issued Project Estimate PDF - 21 pages", 120000);
  await clickExactPageButton(page, "Project Estimate 1").catch(() => null);
  await waitForImportedPage(page, 1);
  evidence.afterRefreshState = await projectEstimateRenderState(page);
  assertCleanState(evidence.afterRefreshState);
  evidence.navigatorCountAfterRefresh = await projectEstimateNavigatorCount(page);
  if (evidence.navigatorCountAfterRefresh !== 21) throw new Error(`Refresh did not preserve 21 pages; saw ${evidence.navigatorCountAfterRefresh}`);
  evidence.visiblePageAfterRefresh = await visibleImportedPageAlt(page);
  evidence.screenshots.afterRefresh = await screenshot(page, "johnson-local-open-page-01-after-refresh.png");

  evidence.download = await verifyDownloadPdf(page);
  fs.writeFileSync(path.join(outDir, "browser-verification-result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  evidence.error = error?.stack || error?.message || String(error);
  try {
    const page = (await browser.pages()).at(-1);
    if (page) {
      evidence.failureUrl = page.url();
      evidence.failureBodyText = await page.evaluate(() => document.body.innerText.slice(0, 4000)).catch(() => "");
      evidence.screenshots.failure = await screenshot(page, "johnson-local-open-failure.png");
    }
  } catch {
    // Best-effort diagnostics only.
  }
  fs.writeFileSync(path.join(outDir, "browser-verification-result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}

async function ensureWorkspaceUser() {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await upsertWithFallback("accounts", {
    user_id: data.user.id,
    email,
    full_name: "Codex Johnson Local Verifier",
    business_name: "Johnson Local Verification",
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
    .insert({ workspace_id: workspaceId, user_id: data.user.id, role: "owner", status: "active" });
  if (memberError) throw memberError;
  return data.user;
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

async function signIn() {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function primeBrowserSession(page, authSession) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  await page.evaluateOnNewDocument(({ key, sessionObject, activeWorkspaceId }) => {
    localStorage.setItem(key, JSON.stringify(sessionObject));
    localStorage.setItem(`${key}-fallback`, JSON.stringify({ currentSession: sessionObject, expiresAt: sessionObject?.expires_at || null }));
    localStorage.setItem("active_workspace_id", activeWorkspaceId);
    localStorage.removeItem("builder-active-workspace-project");
  }, { key: `sb-${ref}-auth-token`, sessionObject: authSession, activeWorkspaceId: workspaceId });
}

async function goto(page, url, options = {}) {
  let response = null;
  try {
    response = await page.goto(url, options);
  } catch (error) {
    const message = String(error?.message || error);
    const detachedFrame = message.includes("Navigating frame was detached") || message.includes("detached Frame");
    if (!message.includes("net::ERR_ABORTED") && !detachedFrame) throw error;
    if (detachedFrame) {
      await sleep(1500);
      response = await page.goto(url, options).catch((retryError) => {
        const retryMessage = String(retryError?.message || retryError);
        if (retryMessage.includes("net::ERR_ABORTED") || retryMessage.includes("Navigating frame was detached") || retryMessage.includes("detached Frame")) return null;
        throw retryError;
      });
    }
    await page.waitForFunction(() => document.readyState !== "loading", { timeout: 30000 }).catch(() => null);
  }
  if (!response) {
    if (page.url().startsWith(url.split("#")[0])) return null;
    throw new Error(`Navigation failed ${response?.status()} ${url}`);
  }
  if (response.status() >= 400) throw new Error(`Navigation failed ${response.status()} ${url}`);
  return response;
}

async function enableDownloads(page) {
  const session = await page.createCDPSession();
  await session.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
}

async function verifyDownloadPdf(page) {
  for (const entry of fs.readdirSync(downloadDir)) fs.rmSync(path.join(downloadDir, entry), { force: true });
  await clickText(page, "button", "Download PDF");
  const downloadedPath = await waitForDownloadedPdf();
  const bytes = fs.readFileSync(downloadedPath);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return {
    path: downloadedPath,
    sha256: hash,
    pageCount: pdf.getPageCount(),
    matchesSuppliedJohnsonPdf: hash === johnsonPdfSha256,
  };
}

async function waitForDownloadedPdf(timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const files = fs.readdirSync(downloadDir)
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .map((name) => path.join(downloadDir, name));
    const active = fs.readdirSync(downloadDir).some((name) => name.endsWith(".crdownload"));
    if (files.length && !active) return files[0];
    await sleep(500);
  }
  throw new Error("Timed out waiting for downloaded PDF.");
}

async function clickText(page, selector, text) {
  await page.evaluate(({ selector: query, text: expected }) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const target = [...document.querySelectorAll(query)].find((element) => normalise(element.textContent).includes(expected));
    if (!target) throw new Error(`Could not find ${query} containing ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, { selector, text });
  await sleep(900);
}

async function clickExactPageButton(page, label) {
  await page.evaluate((expected) => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    const buttons = [...document.querySelectorAll("aside button")];
    const target = buttons.find((button) => normalise(button.querySelector("span")?.textContent || button.textContent) === expected);
    if (!target) throw new Error(`Could not find page button ${expected}`);
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
  }, label);
  await sleep(900);
}

async function waitForBodyText(page, text, timeout = 60000) {
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), { timeout }, text);
}

async function waitForImportedPage(page, pageNumber) {
  await page.waitForFunction((expected) => {
    const img = [...document.querySelectorAll("main img")].find((node) => node.alt === `Project Estimate ${expected}`);
    if (!img) return false;
    const rect = img.getBoundingClientRect();
    return rect.width > 300 && rect.height > 300 && img.complete && img.naturalWidth > 100;
  }, { timeout: 120000 }, pageNumber);
}

async function visibleImportedPageAlt(page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll("main img")].map((img) => {
      const rect = img.getBoundingClientRect();
      return { alt: img.alt, width: rect.width, height: rect.height, top: rect.top, left: rect.left };
    }).filter((item) => item.width > 300 && item.height > 300);
    return imgs[0]?.alt || "";
  });
}

async function projectEstimateNavigatorCount(page) {
  return page.evaluate(() => [...document.querySelectorAll("aside button")]
    .filter((button) => /Project Estimate\s+\d+/.test(button.textContent || ""))
    .length);
}

async function projectEstimateRenderState(page) {
  return page.evaluate(() => {
    const normalise = (value) => (value || "").replace(/\s+/g, " ").trim();
    return {
      url: window.location.href,
      bodyText: normalise(document.body.innerText).slice(0, 5000),
      pageButtons: [...document.querySelectorAll("aside button")].map((button) => normalise(button.textContent)).filter(Boolean).slice(0, 90),
      mainImages: [...document.querySelectorAll("main img")].map((img) => {
        const rect = img.getBoundingClientRect();
        return { alt: img.alt, complete: img.complete, naturalWidth: img.naturalWidth, width: rect.width, height: rect.height };
      }),
      mainText: normalise(document.querySelector("main")?.innerText || "").slice(0, 2500),
    };
  });
}

function assertCleanState(state) {
  const text = `${state.bodyText}\n${state.mainText}`;
  const bad = [
    "Estimate Builder Project",
    "NOT ENTERED",
    "New Premier Inclusions Schedule.pdf",
    "SAMPLE PLANS.pdf",
    "Local job file opened",
    "Keep Local",
    "Attach to Platform Project",
  ].filter((value) => text.includes(value));
  if (bad.length) throw new Error(`Invalid fallback/mixed document text still visible: ${bad.join(", ")}`);
}

async function screenshot(page, name) {
  const filePath = path.join(outDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
