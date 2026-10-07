import assert from "node:assert/strict";
import fs from "node:fs";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config({ path: ".env.local", quiet: true });
const authOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
const baseUrl = process.env.AUTH_TEST_URL || "http://localhost:3000/modules/estimate-builder?page=dataInput";
const storageKey = `sb-${new URL(authOrigin).hostname.split(".")[0]}-auth-token`;
const user = { id: "d267b1e8-2bcd-43d2-b4eb-9ec049d131e6", email: "support@gr8result.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const token = (expires) => [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: expires, role: "authenticated" })).toString("base64url"), "simulated-test-signature"].join(".");
const now = Math.floor(Date.now() / 1000);
const initial = { user, access_token: token(now - 60), refresh_token: "simulated-refresh-token", expires_at: now - 60, expires_in: 3600, token_type: "bearer" };
const refreshed = { ...initial, access_token: token(now + 3600), expires_at: now + 3600 };
const errors = [];
let refreshRequests = 0;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
async function prepare(page, seed = false) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = request.url();
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,x-client-info,content-type,x-supabase-api-version", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (url.startsWith(authOrigin)) {
      let body = [];
      if (request.method() === "OPTIONS") return request.respond({ status: 200, headers });
      if (url.includes("/auth/v1/token")) { refreshRequests++; body = refreshed; }
      else if (url.includes("/auth/v1/user")) body = user;
      else if (url.includes("/rest/v1/accounts")) body = { approved: true, is_approved: true, status: "active", subscription_status: "active", business_name: "Session test" };
      return request.respond({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
    }
    if (url.includes("/api/")) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ workspaces: [], allowed: true }) });
    return request.continue();
  });
  if (seed) await page.evaluateOnNewDocument(({ key, session }) => {
    if (!localStorage.getItem("auth-regression-seeded")) {
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem("auth-regression-seeded", "true");
    }
  }, { key: storageKey, session: initial });
}
try {
  const page = await browser.newPage();
  await prepare(page, true);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector("#estimate-builder-file-menu-button", { timeout: 180000 });
  assert.equal(refreshRequests, 1, "Expired session should refresh once without signing in again");
  console.log("Expired stored login restored");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector("#estimate-builder-file-menu-button", { timeout: 180000 });
  const second = await browser.newPage();
  await prepare(second);
  await second.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 180000 });
  await second.waitForSelector("#estimate-builder-file-menu-button", { timeout: 180000 });
  assert.equal(refreshRequests, 1, "Reloads and another tab reuse the refreshed stored session");
  assert.ok(!page.url().includes("/login") && !second.url().includes("/login"));
  assert.deepEqual(errors, []);
  const report = { passed: true, simulatedAuth: true, expiredSessionRefreshed: true, reloadPassed: true, secondTabPassed: true, refreshRequests, errors };
  fs.mkdirSync("test-artifacts/auth-session", { recursive: true });
  fs.writeFileSync("test-artifacts/auth-session/report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
